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

// 社会・人口統計体系（市区町村データ - Ｈ　居住）の統計表ID
const HOUSING_STATS_ID = '0000020208';

// 総住宅数と空き家数の cat01 コード（起動時に動的に取得）
let TOTAL_HOUSING_CODE = '';
let VACANT_HOUSING_CODE = '';

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
                const backoffWaitTime = (retryCount + 1) * 10000;
                console.log(`  > [e-Stat API] HTTP Error: ${response.status}. ${backoffWaitTime / 1000}秒待機後にリトライします...`);
                await sleep(backoffWaitTime);
                return await fetchEstatWithRetry(url, retryCount + 1);
            }
            console.error(`  > [e-Stat API] 最終HTTP Error: ${response.status}. リトライ上限到達`);
            return null;
        }

        return await response.json();
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
// e-Stat: 空き家データ (市区町村単位)
// ==========================================
async function initHousingMetadata(): Promise<void> {
    const url = `${ESTAT_BASE_URL}/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${HOUSING_STATS_ID}`;
    console.log(`> [Init] 住宅・居住統計メタ情報を取得中...`);
    const json = await fetchEstatWithRetry(url);
    if (!json) throw new Error("メタ情報の取得に失敗しました");

    const cobjs = json.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ;
    const coarr = Array.isArray(cobjs) ? cobjs : [cobjs];

    for (const co of coarr) {
        const id = co?.['@id'];
        const cls = Array.isArray(co?.CLASS) ? co.CLASS : [co?.CLASS];
        if (id === 'cat01') {
            const totalEntry = cls.find((c: any) => c?.['@name']?.includes('総住宅数'));
            const vacantEntry = cls.find((c: any) => c?.['@code'] === 'H110202' || c?.['@name']?.includes('空き家数'));
            
            if (totalEntry) {
                TOTAL_HOUSING_CODE = totalEntry['@code'];
                console.log(`> [Init] 総住宅数 cat01コード: ${TOTAL_HOUSING_CODE} (${totalEntry['@name']})`);
            }
            if (vacantEntry) {
                VACANT_HOUSING_CODE = vacantEntry['@code'];
                console.log(`> [Init] 空き家数 cat01コード: ${VACANT_HOUSING_CODE} (${vacantEntry['@name']})`);
            }
        }
    }
    if (!TOTAL_HOUSING_CODE || !VACANT_HOUSING_CODE) {
        throw new Error(`cat01 の住宅コードが取得できませんでした。`);
    }
}

function extractLatestYearValue(json: any): number {
    if (!json) return 0;
    const sd = json?.GET_STATS_DATA;
    if (!sd) return 0;

    const status = sd.RESULT?.STATUS;
    if (status !== 0) return 0;

    const values = sd.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!values) return 0;

    const arr: any[] = Array.isArray(values) ? values : [values];
    if (arr.length === 0) return 0;

    let latestEntry: any = null;
    let latestTimeCode = '';

    // 年度順に降順ソートして最新を取得
    for (const v of arr) {
        const timeCode = v['@time'] || '';
        if (!latestTimeCode || timeCode.localeCompare(latestTimeCode) > 0) {
            latestTimeCode = timeCode;
            latestEntry = v;
        }
    }

    if (!latestEntry) return 0;

    const raw = latestEntry['$'];
    const num = parseFloat(raw);

    if (isNaN(num)) return 0;
    return num;
}

async function fetchHousingData(cityCode: string, catCode: string, cache: Record<string, number>): Promise<number> {
    const cacheKey = `${cityCode}_${catCode}`;
    if (cache[cacheKey] !== undefined) return cache[cacheKey];

    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${HOUSING_STATS_ID}&cdArea=${cityCode}&cdCat01=${catCode}`;
    const json = await fetchEstatWithRetry(url);
    const count = extractLatestYearValue(json);
    cache[cacheKey] = count;
    return count;
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
// メイン関数
// ==========================================
async function main() {
    if (TEST_MODE) {
        console.log(`=== [テストモード] 先頭 ${TEST_LIMIT} 駅のみ処理 ===`);
    }
    console.log("=== 資産性：空き家率 自動取得・更新スクリプト開始（差分更新モード） ===");

    let skipCoordMissingCount = 0;
    let skipAlreadyExistsCount = 0;
    let processedCount = 0;

    // --- 1. 起動時初期化 ---
    await initHousingMetadata();

    // --- 2. インメモリキャッシュ ---
    const cacheHousing: Record<string, number> = {};

    // --- 3. データの読み取り ---
    const targetDir = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
    const stationsJsonPath = path.join(process.cwd(), 'data', 'stations.json');
    const coordsCacheFile = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');

    let stationsMap: Record<string, any> = {};
    let coordsCache: Record<string, any> = {};

    try {
        const stRaw = await fs.readFile(stationsJsonPath, 'utf-8');
        const stData = JSON.parse(stRaw);
        if (stData.stations || Array.isArray(stData)) {
            const arr = stData.stations || stData;
            for (const s of arr) {
                const name = s.station_name || s.name;
                if (name) stationsMap[name] = s;
            }
        }
        console.log(`> [Info] 駅マスターから ${Object.keys(stationsMap).length} 件の情報をロード`);
    } catch (e) {
        console.warn("> [Warn] stations.json を読み込めませんでした。");
    }

    try {
        const coordsRaw = await fs.readFile(coordsCacheFile, 'utf-8');
        coordsCache = JSON.parse(coordsRaw);
        console.log(`> [Info] 座標キャッシュから ${Object.keys(coordsCache).length} 件の情報をロード`);
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

            // 【差分スキップ判定】
            if (
                !Array.isArray(data) &&
                data.ext &&
                Array.isArray(data.ext.dynamicAdditions) &&
                data.ext.dynamicAdditions.some((item: any) => item.label === "空き家率")
            ) {
                console.log(`[Skip] ${stationName}: 既に空き家率データが存在します`);
                skipAlreadyExistsCount++;
                continue;
            }

            let lat: number | undefined;
            let lon: number | undefined;
            let cityCode: string | undefined;

            if (!Array.isArray(data)) {
                lat = data.lat || data.ext?.hazardRisk?.lat || data.extendedMetrics?.hazardRisk?.lat || data.debug?.lat;
                lon = data.lon || data.ext?.hazardRisk?.lon || data.extendedMetrics?.hazardRisk?.lon || data.debug?.lon;
                cityCode = data.cityCode;
            }

            if (stationsMap[stationName]) {
                if (!lat) lat = stationsMap[stationName].lat;
                if (!lon) lon = stationsMap[stationName].lon;
                if (!cityCode) cityCode = stationsMap[stationName].cityCode || stationsMap[stationName].city_code;
            }

            if (coordsCache[stationName]) {
                if (!lat) lat = coordsCache[stationName].lat;
                if (!lon) lon = coordsCache[stationName].lon;
            }

            if (typeof lat === 'number' && typeof lon === 'number' && !cityCode) {
                console.log(`  > [Info] ${stationName} の cityCode が見つからないため逆ジオコーディングを実行します`);
                const fetchedCityCode = await getCityCodeFromLatLng(lat, lon);
                if (fetchedCityCode) {
                    cityCode = fetchedCityCode;
                }
            }

            if (typeof lat !== 'number' || typeof lon !== 'number' || !cityCode) {
                console.error(`- [Error] ${file}: 座標または市区町村コード(cityCode)が完全に欠損しているためスキップします。`);
                skipCoordMissingCount++;
                continue;
            }

            cityCode = cityCode.toString().padStart(5, '0');

            // --- A. 総住宅数の取得 ---
            const totalHousing = await fetchHousingData(cityCode, TOTAL_HOUSING_CODE, cacheHousing);
            // --- B. 空き家数の取得 ---
            const vacantHousing = await fetchHousingData(cityCode, VACANT_HOUSING_CODE, cacheHousing);


            // ======================================
            // 評価ロジック（フォールバック対応）
            // ======================================
            let scoreImpact = 0;
            let description = "";
            let evaluationValue = "";
            let formattedRate = "";

            if (totalHousing === 0) {
                console.warn(`  > [Warn] ${stationName}: 総住宅数が0のため全国平均水準(13.8%)でフォールバックします。`);
                formattedRate = "13.8%";
                scoreImpact = 0;
                evaluationValue = formattedRate + " (標準)";
                description = "該当エリアの詳細データが取得できないため、全国平均水準（13.8%）として仮評価しています。";
            } else {
                const vacancyRate = (vacantHousing / totalHousing) * 100;
                formattedRate = vacancyRate.toFixed(1) + "%";

                if (vacancyRate < 10) {
                    scoreImpact = 2;
                    evaluationValue = formattedRate + " (低スコア)";
                    description = `該当エリアの空き家率は${formattedRate}と低く、住宅需要が高い活発な地域と考えられます。資産価値の維持が期待できます。`;
                } else if (vacancyRate < 15) {
                    scoreImpact = 0;
                    evaluationValue = formattedRate + " (標準)";
                    description = `該当エリアの空き家率は${formattedRate}で、全国的な平均と同等水準の市場環境です。`;
                } else {
                    scoreImpact = -2;
                    evaluationValue = formattedRate + " (注意水準)";
                    description = `該当エリアの空き家率は${formattedRate}とやや高く、供給過多や人口減少の兆しがあるため、不動産の流動性に一定の注意が必要です。`;
                }
            }

            // ======================================
            // ファイル上書き保存
            // ======================================
            const newItem = {
                category: "asset",
                label: "空き家率",
                ruleDescription: description,
                targetMode: ["asset"],
                value: evaluationValue,
                scoreImpact: scoreImpact
            };

            if (!data.ext) data.ext = {};
            if (!Array.isArray(data.ext.dynamicAdditions)) {
                data.ext.dynamicAdditions = [];
            }

            const existingIndex = data.ext.dynamicAdditions.findIndex((item: any) => item.label === "空き家率");
            if (existingIndex >= 0) {
                data.ext.dynamicAdditions[existingIndex] = newItem;
                console.log(`  -> [Update] 駅:${stationName}, 空き家率=${formattedRate}, Impact=${scoreImpact}`);
            } else {
                data.ext.dynamicAdditions.push(newItem);
                console.log(`  -> [Add] 駅:${stationName}, 空き家率=${formattedRate}, Impact=${scoreImpact}`);
            }

            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            processedCount++;

        } catch (err: any) {
            console.error(`- [Error] ${file} (${stationName}) 処理中エラー: ${err.message}`);
        }
    }

    console.log("\n===========================================");
    console.log("=== 直列バッチ処理・完了（差分更新） ===");
    console.log("===========================================");
    if (TEST_MODE) {
        console.log(`=== [テストモード] 処理終了 ===`);
    }
    console.log(` [結果] 処理成功 : ${processedCount} 件`);
    console.log(` [スキップ] 既存データ : ${skipAlreadyExistsCount} 件`);
    console.log(` [警告] データ欠損 : ${skipCoordMissingCount} 件`);
    console.log("===========================================\n");
}

main().catch(err => {
    console.error("予期せぬクリティカルエラー:", err);
    process.exit(1);
});
