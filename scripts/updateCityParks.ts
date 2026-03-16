
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// 1. 環境設定
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
if (!ESTAT_APP_ID) {
    console.error("エラー: .env に ESTAT_APP_ID が設定されていません。");
    process.exit(1);
}

// コマンドライン引数 --test で先頭10件のみ処理するテストモード
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

// 社会・人口統計体系（都道府県統計指標 - Ｈ 居住）の統計表ID
const PARK_STATS_ID = '0000010208';
const PARK_CAT01_CODE = '#H08101'; // 1人当たり都市公園面積
const TARGET_TIME = '2023100000'; // 2023年度（最新の報告値）

// ==========================================
// ユーティリティ: スリープ関数
// ==========================================
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// e-Stat API用 エクスポネンシャル・バックオフ＋最大3回リトライ
async function fetchEstatWithRetry(url: string, retryCount = 0): Promise<any> {
    console.log(`  > [e-Stat API] Fetching: ${url.replace(ESTAT_APP_ID!, '***')} (Retry: ${retryCount})`);
    try {
        const response = await fetch(url);
        await sleep(1500); // 厳格な 1500ms スリープ
        
        if (!response.ok) {
            if (retryCount < 3) {
                const backoffWaitTime = (retryCount + 1) * 10000; // 10s, 20s, 30s
                console.log(`  > [e-Stat API] HTTP Error: ${response.status}. ${backoffWaitTime / 1000}秒待機後にリトライします...`);
                await sleep(backoffWaitTime);
                return await fetchEstatWithRetry(url, retryCount + 1);
            }
            console.error(`  > [e-Stat API] 最終HTTP Error: ${response.status}. リトライ上限到達`);
            return null;
        }

        const data = await response.json();
        if (data.GET_STATS_DATA?.RESULT?.STATUS !== 0) {
            const msg = data.GET_STATS_DATA?.RESULT?.ERROR_MSG;
            if (msg && msg.includes('データは存在しません')) return null;
            throw new Error(`e-Stat API Error: ${msg}`);
        }
        return data;
    } catch (err: any) {
        console.error(`  > [e-Stat API] 通信エラー: ${err.message}`);
        await sleep(1500);
        
        if (retryCount < 3) {
            const backoffWaitTime = (retryCount + 1) * 10000;
            console.log(`  > [e-Stat API] ネットワークエラー。${backoffWaitTime / 1000}秒待機後にリトライします...`);
            await sleep(backoffWaitTime);
            return await fetchEstatWithRetry(url, retryCount + 1);
        }
        
        console.error(`  > [e-Stat API] 最終通信エラー. リトライ上限到達`);
        return null;
    }
}

// ==========================================
// 逆ジオコーディング (GSI API)
// ==========================================
async function getCityCodeFromLatLng(lat: number, lon: number): Promise<string | null> {
    try {
        const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`;
        console.log(`  > [GSI API] 逆ジオコーディング取得中... (lat:${lat}, lon:${lon})`);

        const response = await fetch(url);
        await sleep(1500);

        if (!response.ok) return null;

        const data = await response.json();
        if (data && data.results && data.results.muniCd) {
            return data.results.muniCd;
        }
        return null;
    } catch (err) {
        console.error(`  > [GSI API] 通信エラー: ${err}`);
        await sleep(1500);
        return null;
    }
}

// ==========================================
// 公園データの取得
// ==========================================
async function fetchParkData(cityCode: string, cache: Record<string, number>): Promise<number | null> {
    // 都道府県コード (先頭2桁 + 000) を解決
    const prefCode = cityCode.substring(0, 2).padStart(2, '0') + '000';
    
    if (cache[prefCode] !== undefined) {
        return cache[prefCode];
    }

    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${PARK_STATS_ID}&cdCat01=${encodeURIComponent(PARK_CAT01_CODE)}&cdArea=${prefCode}&cdTime=${TARGET_TIME}`;
    const json = await fetchEstatWithRetry(url);
    
    const valueStr = json?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE?.['$'];
    if (valueStr) {
        const val = parseFloat(valueStr);
        cache[prefCode] = val;
        return val;
    }
    
    cache[prefCode] = -1; // 欠損
    return null;
}

// ==========================================
// メイン関数
// ==========================================
async function main() {
    if (TEST_MODE) {
        console.log(`=== [テストモード] 先頭 ${TEST_LIMIT} 駅のみ処理 ===`);
    }
    console.log("=== 利便性：一人当たり都市公園面積 自動取得・更新スクリプト開始 ===");

    let skipCoordMissingCount = 0;
    let processedCount = 0;
    let fallbackCount = 0;

    // --- 1. インメモリキャッシュ ---
    const cachePark: Record<string, number> = {};

    // --- 2. データの読み取りパス設定 ---
    const targetDir = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
    const stationsJsonPath = path.join(process.cwd(), 'data', 'stations.json');
    const coordsCacheFile = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');

    let stationsMap: Record<string, any> = {};
    let coordsCache: Record<string, any> = {};

    // 注意: stations.json などの読み込みはプロジェクトの実際の設定に合わせる
    try {
        const stRaw = await fs.readFile(stationsJsonPath, 'utf-8');
        const stData = JSON.parse(stRaw);
        // stations.json がフラットな Map 構造の場合
        stationsMap = stData;
        console.log(`> [Info] 各駅データ(stations.json)をロード`);
    } catch (e) {
        console.warn("> [Warn] stations.json を読み込めませんでした。");
    }

    try {
        const coordsRaw = await fs.readFile(coordsCacheFile, 'utf-8');
        coordsCache = JSON.parse(coordsRaw);
        console.log(`> [Info] 座標キャッシュからロード`);
    } catch (e) {
        console.warn("> [Warn] station_coords.json を読み込めませんでした。");
    }

    let files: string[] = [];
    try {
        files = await fs.readdir(targetDir);
    } catch (e) {
        console.error(`エラー: ${targetDir} を読み込めませんでした。`);
        process.exit(1);
    }

    let jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('_v2'));

    if (TEST_MODE) {
        jsonFiles = jsonFiles.slice(0, TEST_LIMIT);
        console.log(`> [テスト] 処理対象: ${jsonFiles.length} ファイル`);
    } else {
        console.log(`> [Info] 処理対象ファイル数: ${jsonFiles.length} ファイル`);
    }

    for (const file of jsonFiles) {
        const filePath = path.join(targetDir, file);
        let stationName = file.replace('.json', '');
        if (stationName.includes('_')) stationName = stationName.split('_')[0];

        try {
            const rawData = await fs.readFile(filePath, 'utf-8');
            let data = JSON.parse(rawData);

            let lat: number | undefined;
            let lon: number | undefined;
            let cityCode: string | undefined;

            // 1) 自身のJSON
            if (!Array.isArray(data)) {
                lat = data.lat || data.ext?.hazardRisk?.lat || data.extendedMetrics?.hazardRisk?.lat || data.debug?.lat;
                lon = data.lon || data.ext?.hazardRisk?.lon || data.extendedMetrics?.hazardRisk?.lon || data.debug?.lon;
                cityCode = data.cityCode;
            }

            // 2) stations.json / coordsCache から補充
            if (stationsMap[stationName]) {
                if (!lat) lat = stationsMap[stationName].lat;
                if (!lon) lon = stationsMap[stationName].lon;
                if (!cityCode) cityCode = stationsMap[stationName].cityCode || stationsMap[stationName].city_code;
            }
            if (coordsCache[stationName]) {
                if (!lat) lat = coordsCache[stationName].lat;
                if (!lon) lon = coordsCache[stationName].lon;
            }

            // 三重フォールバック: 逆ジオコーディング
            if (typeof lat === 'number' && typeof lon === 'number' && !cityCode) {
                console.log(`  > [Info] ${stationName} の cityCode が見つからないため逆ジオコーディングを実行します`);
                const fetchedCityCode = await getCityCodeFromLatLng(lat, lon);
                if (fetchedCityCode) {
                    cityCode = fetchedCityCode;
                }
            }

            if (!cityCode) {
                console.error(`- [Error] ${file}: cityCodeが完全に欠損しているためスキップします。`);
                skipCoordMissingCount++;
                continue;
            }

            // cityCodeの正規化 (5桁 ゼロパディング)
            cityCode = cityCode.toString().padStart(5, '0');

            // --- 公園データの取得 ---
            const parkArea = await fetchParkData(cityCode, cachePark);

            // ======================================
            // 評価ロジック
            // ======================================
            let scoreImpact = 0;
            let description = "";
            let evaluationValue = "";

            if (!parkArea || parkArea < 0) {
                console.warn(`  > [Fallback] ${stationName}: データが取得できないため標準水準でフォールバックします。`);
                scoreImpact = 0;
                evaluationValue = "データなし（標準評価）";
                description = "該当エリアの詳細な公園面積データが取得できないため、標準的な緑地環境として評価しています。";
                fallbackCount++;
            } else {
                evaluationValue = `${parkArea.toFixed(2)}㎡/人`;
                if (parkArea >= 15.0) {
                    scoreImpact = 2;
                    description = `一人当たりの都市公園面積が${evaluationValue}と非常に広く、自然豊かな環境が整っています。`;
                } else if (parkArea >= 7.0) {
                    scoreImpact = 1;
                    description = `一人当たりの都市公園面積は${evaluationValue}です。都市部としては十分な緑地が確保されています。`;
                } else if (parkArea >= 4.0) {
                    scoreImpact = 0;
                    description = `一人当たりの都市公園面積は${evaluationValue}です。公園は整備されていますが、都市部特有の密集度が見られます。`;
                } else {
                    scoreImpact = -1;
                    description = `一人当たりの都市公園面積が${evaluationValue}と限定的です。近隣の大型公園や緑地へのアクセスを確認することをお勧めします。`;
                }
            }

            // ======================================
            // ファイル上書き保存 (dynamicAdditions)
            // ======================================
            const newItem = {
                category: "convenience",
                label: "一人当たり都市公園面積",
                ruleDescription: description,
                targetMode: ["convenience"],
                value: evaluationValue,
                scoreImpact: scoreImpact
            };

            if (Array.isArray(data)) {
                // 配列（プロジェクトリスト）形式の場合は、先頭またはメタデータ用のオブジェクトが必要だが、
                // このスクリプトは単一オブジェクトの stations/*.json を想定。
                // data/cache/diagnosis/ 以下のファイルは通常単一オブジェクトのはず。
                console.warn(`  > [Warn] ${file} は配列形式です。適切なプロパティへの挿入を試みます。`);
                // 配列の場合はスキップするか、特定のルールで処理する。
                // 今回は updateBusinessEstablishments.ts に倣い単一オブジェクトとして扱う。
            }

            if (!data.ext) data.ext = {};
            if (!Array.isArray(data.ext.dynamicAdditions)) {
                data.ext.dynamicAdditions = [];
            }

            const existingIndex = data.ext.dynamicAdditions.findIndex((item: any) => item.label === "一人当たり都市公園面積");
            if (existingIndex >= 0) {
                data.ext.dynamicAdditions[existingIndex] = newItem;
                console.log(`  -> [Update] 駅:${stationName}, ${evaluationValue}, Impact=${scoreImpact}`);
            } else {
                data.ext.dynamicAdditions.push(newItem);
                console.log(`  -> [Add] 駅:${stationName}, ${evaluationValue}, Impact=${scoreImpact}`);
            }

            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            processedCount++;

        } catch (err: any) {
            console.error(`- [Error] ${file} (${stationName}) 処理中エラー: ${err.message}`);
        }
    }

    console.log("\n===========================================");
    console.log("=== 都市公園面積 更新完了 ===");
    console.log(` [結果] 処理成功 : ${processedCount} 件`);
    console.log(` [結果] フォールバック適用 : ${fallbackCount} 件`);
    console.log(` [警告] データ欠損(cityCode不明) : ${skipCoordMissingCount} 件`);
    console.log("===========================================\n");
}

main().catch(err => {
    console.error("予期せぬクリティカルエラー:", err);
    process.exit(1);
});
