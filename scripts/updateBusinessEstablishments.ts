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

// 社会・人口統計体系（市区町村データ - Ｃ 経済基盤）の統計表ID
const BUSINESS_STATS_ID = '0000020203';

// 事業所数の cat01 コード（起動時に動的に取得）
let BUSINESS_ESTAB_CODE = '';

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
// e-Stat: メタデータ初期化
// ==========================================
async function initBusinessMetadata(): Promise<void> {
    const url = `${ESTAT_BASE_URL}/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${BUSINESS_STATS_ID}`;
    console.log(`> [Init] 経済基盤（事業所数等）メタ情報を取得中...`);
    const json = await fetchEstatWithRetry(url);
    if (!json) throw new Error("メタ情報の取得に失敗しました");

    const cobjs = json.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ;
    const coarr = Array.isArray(cobjs) ? cobjs : [cobjs];

    for (const co of coarr) {
        const id = co?.['@id'];
        const cls = Array.isArray(co?.CLASS) ? co.CLASS : [co?.CLASS];
        if (id === 'cat01') {
            // C2108: 事業所数（民営）を優先して探す
            const bizEntry = cls.find((c: any) => c?.['@code'] === 'C2108' || c?.['@name']?.includes('事業所数（民営）'));
            
            if (bizEntry) {
                BUSINESS_ESTAB_CODE = bizEntry['@code'];
                console.log(`> [Init] 事業所数 cat01コード: ${BUSINESS_ESTAB_CODE} (${bizEntry['@name']})`);
            }
        }
    }
    if (!BUSINESS_ESTAB_CODE) {
        throw new Error(`cat01 の事業所数コードが取得できませんでした。`);
    }
}

// ==========================================
// 事業所数データの抽出（過去と最新）
// ==========================================
type BizData = { past: number; latest: number; diffRate: number } | null;

function extractBusinessTrend(json: any): BizData {
    if (!json) return null;
    const sd = json?.GET_STATS_DATA;
    if (!sd) return null;

    const status = sd.RESULT?.STATUS;
    if (status !== 0) return null;

    const values = sd.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!values) return null;

    const arr: any[] = Array.isArray(values) ? values : [values];
    if (arr.length === 0) return null;

    // 年度順（@time）に昇順ソートして過去と最新を取得
    arr.sort((a, b) => {
        const timeA = a['@time'] || '';
        const timeB = b['@time'] || '';
        return timeA.localeCompare(timeB);
    });

    // 有効な数値を持つものだけ抽出
    const validEntries = arr.filter(v => {
        const raw = v['$'];
        const num = parseFloat(raw);
        return !isNaN(num) && num > 0;
    });

    if (validEntries.length < 2) {
        console.warn(`  > [Warn] 比較可能な年度データが不足しています（取得件数: ${validEntries.length}）`);
        return null;
    }

    const pastEntry = validEntries[0];
    const latestEntry = validEntries[validEntries.length - 1];

    const pastVal = parseFloat(pastEntry['$']);
    const latestVal = parseFloat(latestEntry['$']);

    const diffRate = ((latestVal - pastVal) / pastVal) * 100;

    console.log(`  > [Data] 過去(${pastEntry['@time']}): ${pastVal}所 -> 最新(${latestEntry['@time']}): ${latestVal}所 (増減率: ${diffRate > 0 ? '+' : ''}${diffRate.toFixed(1)}%)`);

    return { past: pastVal, latest: latestVal, diffRate };
}

// キャッシュを活用したデータ取得
async function fetchBusinessData(cityCode: string, cache: Record<string, BizData>): Promise<BizData> {
    if (cache[cityCode] !== undefined) {
        return cache[cityCode];
    }

    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${BUSINESS_STATS_ID}&cdArea=${cityCode}&cdCat01=${BUSINESS_ESTAB_CODE}`;
    const json = await fetchEstatWithRetry(url);
    const trend = extractBusinessTrend(json);
    cache[cityCode] = trend;
    return trend;
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
    console.log("=== 資産性：事業所数推移 自動取得・更新スクリプト開始（全件上書きモード） ===");

    let skipCoordMissingCount = 0;
    let processedCount = 0;
    let fallbackCount = 0;

    // --- 1. 起動時初期化 ---
    await initBusinessMetadata();

    // --- 2. インメモリキャッシュ ---
    const cacheBusiness: Record<string, BizData> = {};

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

            let lat: number | undefined;
            let lon: number | undefined;
            let cityCode: string | undefined;

            // 1) 自身のJSON
            if (!Array.isArray(data)) {
                lat = data.lat || data.ext?.hazardRisk?.lat || data.extendedMetrics?.hazardRisk?.lat || data.debug?.lat;
                lon = data.lon || data.ext?.hazardRisk?.lon || data.extendedMetrics?.hazardRisk?.lon || data.debug?.lon;
                cityCode = data.cityCode;
            }

            // 2) stations.json
            if (stationsMap[stationName]) {
                if (!lat) lat = stationsMap[stationName].lat;
                if (!lon) lon = stationsMap[stationName].lon;
                if (!cityCode) cityCode = stationsMap[stationName].cityCode || stationsMap[stationName].city_code;
            }

            // 3) station_coords.json
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

            if (typeof lat !== 'number' || typeof lon !== 'number' || !cityCode) {
                console.error(`- [Error] ${file}: 座標または市区町村コード(cityCode)が完全に欠損しているためスキップします。`);
                skipCoordMissingCount++;
                continue;
            }

            // cityCodeの正規化 (5桁 ゼロパディング)
            cityCode = cityCode.toString().padStart(5, '0');

            // --- A. 事業所数推移の取得 ---
            const bizTrend = await fetchBusinessData(cityCode, cacheBusiness);


            // ======================================
            // 評価ロジック（フォールバック対応）
            // ======================================
            let scoreImpact = 0;
            let description = "";
            let evaluationValue = "";

            if (!bizTrend) {
                console.warn(`  > [Fallback] ${stationName}: データが取得できないため標準水準(0%)でフォールバックします。`);
                scoreImpact = 0;
                evaluationValue = "安定エリア（データ欠損・仮評価）";
                description = "該当エリアの詳細データが取得できないため、標準水準として仮評価しています。";
                fallbackCount++;
            } else {
                const diffRate = bizTrend.diffRate;
                const formattedRate = (diffRate > 0 ? "+" : "") + diffRate.toFixed(1) + "%";

                if (diffRate >= 5.0) {
                    scoreImpact = 2;
                    evaluationValue = `企業集積エリア（事業所増加 ${formattedRate}）`;
                    description = "事業所数が増加しており、雇用と経済活動が活発化しています。不動産需要の底堅さが期待できます。";
                } else if (diffRate <= -5.0) {
                    scoreImpact = -2;
                    evaluationValue = `経済活動縮小懸念（事業所減少 ${formattedRate}）`;
                    description = "事業所数の減少が見られ、将来的な地域経済の縮小に注意が必要です。";
                } else {
                    scoreImpact = 0;
                    evaluationValue = `安定エリア（事業所数横ばい ${formattedRate}）`;
                    description = "事業所数は安定しており、既存の経済基盤が維持されています。";
                }
            }

            // ======================================
            // ファイル上書き保存（差分スキップなし・全件上書き）
            // ======================================
            const newItem = {
                category: "asset",
                label: "事業所数推移",
                ruleDescription: description,
                targetMode: ["asset"],
                value: evaluationValue,
                scoreImpact: scoreImpact
            };

            if (!data.ext) data.ext = {};
            if (!Array.isArray(data.ext.dynamicAdditions)) {
                data.ext.dynamicAdditions = [];
            }

            const existingIndex = data.ext.dynamicAdditions.findIndex((item: any) => item.label === "事業所数推移");
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
    console.log("=== 直列バッチ処理・完了（全件上書き） ===");
    console.log("===========================================");
    if (TEST_MODE) {
        console.log(`=== [テストモード] 処理終了 ===`);
    }
    console.log(` [結果] 処理成功 : ${processedCount} 件`);
    console.log(` [結果] フォールバック適用 : ${fallbackCount} 件`);
    console.log(` [警告] データ欠損(cityCode不明) : ${skipCoordMissingCount} 件`);
    console.log("===========================================\n");
}

main().catch(err => {
    console.error("予期せぬクリティカルエラー:", err);
    process.exit(1);
});
