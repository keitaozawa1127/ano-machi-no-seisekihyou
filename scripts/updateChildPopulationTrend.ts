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

// クリティカルエラーのトラップ
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// コマンドライン引数 --test で先頭10件のみ処理するテストモード
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

// 社会・人口統計体系（市区町村統計指標 - A 人口・世帯）の統計表ID
const POPULATION_STATS_ID = '0000020201';
const CHILD_POP_CAT01_CODE = 'A1301'; // 15歳未満人口
const TIME_LATEST = '2020100000'; // 2020年度 (国勢調査)
const TIME_BASE = '2015100000';   // 2015年度 (国勢調査)

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

        const data = await response.json() as any;
        if (data.GET_STATS_DATA?.RESULT?.STATUS !== 0) {
            const msg = data.GET_STATS_DATA?.RESULT?.ERROR_MSG;
            if (msg && (
                msg.includes('データは存在しません') || 
                msg.includes('一致するデータは') || 
                msg.includes('該当データはありません')
            )) return null;
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

        const data = await response.json() as any;
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
// 年少人口データの取得
// ==========================================
async function fetchChildPopulation(cityCode: string, time: string, cache: Record<string, number>): Promise<number | null> {
    const cacheKey = `${cityCode}_${time}`;
    if (cache[cacheKey] !== undefined) {
        return cache[cacheKey];
    }

    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${POPULATION_STATS_ID}&cdCat01=${CHILD_POP_CAT01_CODE}&cdArea=${cityCode}&cdTime=${time}`;
    const json = await fetchEstatWithRetry(url);
    
    const valueStr = (json as any)?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE?.['$'];
    if (valueStr && valueStr !== '-') {
        const val = parseFloat(valueStr);
        cache[cacheKey] = val;
        return val;
    }
    
    cache[cacheKey] = -1; // 欠損
    return null;
}

// ==========================================
// メイン関数
// ==========================================
async function main() {
    if (TEST_MODE) {
        console.log(`=== [テストモード] 先頭 ${TEST_LIMIT} 駅のみ処理 ===`);
    }
    console.log("=== 将来性：年少人口増減率（街の若返り度） 自動取得・更新スクリプト開始 ===");

    let skipCoordMissingCount = 0;
    let processedCount = 0;
    let fallbackCount = 0;

    // --- 1. インメモリキャッシュ ---
    const cachePop: Record<string, number> = {};

    // --- 2. データの読み取りパス設定 ---
    const targetDir = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
    const stationsJsonPath = path.join(process.cwd(), 'data', 'stations.json');
    const coordsCacheFile = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');

    let stationsMap: Record<string, any> = {};
    let coordsCache: Record<string, any> = {};

    try {
        const stRaw = await fs.readFile(stationsJsonPath, 'utf-8');
        stationsMap = JSON.parse(stRaw);
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

    let currentFileIndex = 0;
    for (const file of jsonFiles) {
        currentFileIndex++;
        const filePath = path.join(targetDir, file);
        let stationName = file.replace('.json', '');
        if (stationName.includes('_')) stationName = stationName.split('_')[0];

        if (currentFileIndex % 10 === 0 || TEST_MODE) {
            console.log(`> [Progress] ${currentFileIndex} / ${jsonFiles.length} (${((currentFileIndex / jsonFiles.length) * 100).toFixed(1)}%)`);
        }

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

            // --- 年少人口データの取得（最新と過去） ---
            const popLatest = await fetchChildPopulation(cityCode, TIME_LATEST, cachePop);
            const popBase = await fetchChildPopulation(cityCode, TIME_BASE, cachePop);

            // ======================================
            // 評価ロジック
            // ======================================
            let scoreImpact = 0;
            let description = "";
            let evaluationValue = "";

            if (popLatest === null || popBase === null || popLatest < 0 || popBase < 0) {
                console.warn(`  > [Fallback] ${stationName}: データが取得できないため標準水準でフォールバックします。`);
                scoreImpact = 0;
                evaluationValue = "データなし（標準評価）";
                description = "全国的な少子化のトレンドに対し、標準的な推移を保っています。";
                fallbackCount++;
            } else {
                const growthRate = ((popLatest - popBase) / popBase) * 100;
                evaluationValue = `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(2)}%`;

                if (growthRate >= 0) {
                    scoreImpact = 2;
                    description = "年少人口が増加（または維持）しており、子育て世代の流入が目立つ活気ある街です。将来的な街の発展や資産価値の維持に強く期待できます。";
                } else if (growthRate >= -5.0) {
                    scoreImpact = 0;
                    description = "全国的な少子化のトレンドに対し、標準的な推移を保っています。";
                } else if (growthRate >= -10.0) {
                    scoreImpact = -1;
                    description = "年少人口の減少が比較的進んでおり、街の高齢化が進みつつある傾向が見られます。";
                } else {
                    scoreImpact = -2;
                    description = "年少人口の減少が顕著であり、将来的なインフラ維持や街の活気に関し、長期的な慎重さが求められます。";
                }
            }

            // ======================================
            // ファイル上書き保存 (dynamicAdditions)
            // ======================================
            const newItem = {
                category: "future",
                label: "年少人口増減率（街の若返り度）",
                ruleDescription: description,
                targetMode: ["future"],
                value: evaluationValue,
                scoreImpact: scoreImpact
            };

            if (!data.ext) data.ext = {};
            if (!Array.isArray(data.ext.dynamicAdditions)) {
                data.ext.dynamicAdditions = [];
            }

            const existingIndex = data.ext.dynamicAdditions.findIndex((item: any) => item.label === "年少人口増減率（街の若返り度）");
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
    console.log("=== 年少人口増減率 更新完了 ===");
    console.log(` [結果] 処理成功 : ${processedCount} 件`);
    console.log(` [結果] フォールバック適用 : ${fallbackCount} 件`);
    console.log(` [警告] データ欠損(cityCode不明) : ${skipCoordMissingCount} 件`);
    console.log("===========================================\n");
}

main().catch(err => {
    console.error("予期せぬクリティカルエラー:", err);
    process.exit(1);
});
