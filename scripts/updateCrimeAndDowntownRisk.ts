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
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// 社会・人口統計体系（市区町村データ）の統計表ID
const CRIME_STATS_ID = '0000020111';

// 刑法犯認知件数の cat01 コード（起動時に動的に取得）
let CRIME_CAT01_CODE = '';

// ==========================================
// ユーティリティ: スリープ関数
// ==========================================
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// e-Stat API用 (1.5秒待機)
async function fetchEstatWithSleep(url: string) {
    try {
        const response = await fetch(url);
        await sleep(1500);
        return response;
    } catch (err) {
        console.error(`e-Stat API Fetch Error: ${err}`);
        await sleep(1500);
        throw err;
    }
}

// ==========================================
// e-Stat: 治安データ (市区町村単位)
// ==========================================
async function initCrimeMetadata(): Promise<void> {
    const url = `${ESTAT_BASE_URL}/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${CRIME_STATS_ID}`;
    console.log(`> [Init] 犯罪統計メタ情報を取得中... URL: ${url}`);
    const res = await fetchEstatWithSleep(url);
    const json = await res.json();

    const cobjs = json.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ;
    const coarr = Array.isArray(cobjs) ? cobjs : [cobjs];

    for (const co of coarr) {
        const id = co?.['@id'];
        const cls = Array.isArray(co?.CLASS) ? co.CLASS : [co?.CLASS];
        if (id === 'cat01') {
            const crimeEntry = cls.find((c: any) => c?.['@name']?.includes('刑法犯'));
            if (crimeEntry) {
                CRIME_CAT01_CODE = crimeEntry['@code'];
                console.log(`> [Init] 刑法犯認知件数 cat01コード: ${CRIME_CAT01_CODE} (${crimeEntry['@name']})`);
            }
        }
    }
    if (!CRIME_CAT01_CODE) {
        throw new Error(`cat01 の刑法犯コードが取得できませんでした。`);
    }
}

function extractLatestYearValue(json: any, label: string, fetchedUrl: string): number {
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

    if (isNaN(num) || num >= 100000) return 0;
    return num;
}

async function fetchCrimeCount(cityCode: string, cache: Record<string, number>): Promise<number> {
    if (cache[cityCode] !== undefined) return cache[cityCode];

    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${CRIME_STATS_ID}&cdArea=${cityCode}&cdCat01=${CRIME_CAT01_CODE}`;
    console.log(`  > [e-Stat API] 刑法犯認知件数取得 (cityCode: ${cityCode})`);

    const res = await fetchEstatWithSleep(url);
    const json = await res.json();
    const count = extractLatestYearValue(json, `刑法犯[${cityCode}]`, url);
    cache[cityCode] = count;
    return count;
}


// ==========================================
// Overpass API: 繁華街リスク (半径500m以内の飲食店カウント)
// ==========================================
// 負荷に弱いため強制2000msスリープ、最大3回のリトライ機構（エクスポネンシャル・バックオフ）
async function fetchOverpassRestaurantCount(lat: number, lon: number, retryCount = 0): Promise<number | null> {
    const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:500,${lat},${lon}););out count;`;

    console.log(`  > [Overpass API] 飲食店集積データ取得 (lat:${lat}, lon:${lon}) Retry:${retryCount}`);

    try {
        const res = await fetch(OVERPASS_API_URL, {
            method: 'POST',
            body: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'AnoMachiApp/1.0 (local batch script)'
            }
        });

        await sleep(2000); // 厳格な2000msスリープ

        if (!res.ok) {
            // 429 (Too Many Requests), 504 (Gateway Timeout) 等すべてのHTTPエラーに対してリトライを実行する
            if (retryCount < 3) {
                // リトライ回数に応じて待機時間を長くする (1回目:10秒, 2回目:20秒, 3回目:30秒)
                const backoffWaitTime = (retryCount + 1) * 10000;
                console.log(`  > [Overpass API] HTTP Error: ${res.status}. ${backoffWaitTime / 1000}秒待機後にリトライします...`);
                await sleep(backoffWaitTime);
                return await fetchOverpassRestaurantCount(lat, lon, retryCount + 1);
            }
            // 3回リトライしても失敗した場合はエラーログを出力し、0としてフォールバック(上位で0を返す)
            console.error(`  > [Overpass API] 最終HTTP Error: ${res.status}. リトライ上限到達`);
            return null;
        }

        const data = await res.json();
        if (data && data.elements && data.elements.length > 0) {
            const count = data.elements[0].tags?.total || "0";
            return parseInt(count, 10);
        }
        return 0;

    } catch (err: any) {
        // fetch自体の根本的なネットワーク失敗時の処理
        console.error(`  > [Overpass API] 通信エラー: ${err.message}`);
        await sleep(2000);

        if (retryCount < 3) {
            const backoffWaitTime = (retryCount + 1) * 10000;
            console.log(`  > [Overpass API] ネットワークエラー。${backoffWaitTime / 1000}秒待機後にリトライします...`);
            await sleep(backoffWaitTime);
            return await fetchOverpassRestaurantCount(lat, lon, retryCount + 1);
        }

        console.error(`  > [Overpass API] 最終通信エラー. リトライ上限到達`);
        return null; // リトライ限界
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
        await sleep(1500); // GSI APIも1.5秒待機

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
    console.log("=== 治安・繁華街リスク [ハイブリッド・アーキテクチャ] 自動取得・更新スクリプト開始（差分更新モード） ===");

    let skipCoordMissingCount = 0;
    let skipAlreadyExistsCount = 0;

    // --- 1. 起動時初期化 ---
    await initCrimeMetadata();

    // --- 2. インメモリキャッシュ ---
    const cacheCrime: Record<string, number> = {};

    // --- 3. データの読み取り ---
    const targetDir = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
    const stationsJsonPath = path.join(process.cwd(), 'data', 'stations.json');
    const coordsCacheFile = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');

    let stationsMap: Record<string, any> = {};
    let coordsCache: Record<string, any> = {};

    // フォールバック1: stations.json
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

    // フォールバック2: station_coords.json
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

            // ===================================================
            // 【差分スキップ判定】
            // 既に "治安・犯罪リスク（ハイブリッド評価）" が存在する場合はスキップ
            // ===================================================
            if (
                !Array.isArray(data) &&
                data.ext &&
                Array.isArray(data.ext.dynamicAdditions) &&
                data.ext.dynamicAdditions.some((item: any) => item.label === "治安・犯罪リスク（ハイブリッド評価）")
            ) {
                console.log(`[Skip] ${stationName}: 既にデータが存在します`);
                skipAlreadyExistsCount++;
                continue;
            }

            let lat: number | undefined;
            let lon: number | undefined;
            let cityCode: string | undefined;

            // 第1優先: 対象JSON
            if (!Array.isArray(data)) {
                lat = data.lat || data.ext?.hazardRisk?.lat || data.extendedMetrics?.hazardRisk?.lat || data.debug?.lat;
                lon = data.lon || data.ext?.hazardRisk?.lon || data.extendedMetrics?.hazardRisk?.lon || data.debug?.lon;
                cityCode = data.cityCode;
            }

            // 第2優先: stations.json 
            if (stationsMap[stationName]) {
                if (!lat) lat = stationsMap[stationName].lat;
                if (!lon) lon = stationsMap[stationName].lon;
                if (!cityCode) cityCode = stationsMap[stationName].cityCode || stationsMap[stationName].city_code;
            }

            // 第3優先: station_coords.json 
            if (coordsCache[stationName]) {
                if (!lat) lat = coordsCache[stationName].lat;
                if (!lon) lon = coordsCache[stationName].lon;
            }

            // 逆ジオコーディング補完
            if (typeof lat === 'number' && typeof lon === 'number' && !cityCode) {
                console.log(`  > [Info] ${stationName} の cityCode が見つからないため逆ジオコーディングを実行します`);
                const fetchedCityCode = await getCityCodeFromLatLng(lat, lon);
                if (fetchedCityCode) {
                    cityCode = fetchedCityCode;
                    console.log(`  > [Success] 逆ジオコーディング成功: ${stationName} -> cityCode: ${cityCode}`);
                }
            }

            if (typeof lat !== 'number' || typeof lon !== 'number' || !cityCode) {
                console.error(`- [Error] ${file}: 座標または市区町村コード(cityCode)が完全に欠損しているためスキップします。`);
                skipCoordMissingCount++;
                continue;
            }

            cityCode = cityCode.toString().padStart(5, '0');

            // --- A. e-Stat 治安データ (市区町村単位) ---
            const crimeCount = await fetchCrimeCount(cityCode, cacheCrime);

            // --- B. Overpass API 飲食店データ (半径500m) ---
            let restaurantCount = await fetchOverpassRestaurantCount(lat, lon);

            // エラー等で null が返った場合は評価に影響させないため 0 扱いとする
            if (restaurantCount === null) restaurantCount = 0;


            // ======================================
            // ハイブリッド評価ロジック
            // ======================================
            let scoreImpact = 0;
            let description = "";
            let baseScoreFlag = 0;

            if (crimeCount < 300) {
                baseScoreFlag = 1;
                scoreImpact += 2;
                description = "該当エリア（市区町村）の犯罪発生率は低く、治安の面で比較的安心できる地域です。";
            } else if (crimeCount < 1000) {
                baseScoreFlag = 0;
                scoreImpact += 0;
                description = "該当エリア（市区町村）の犯罪発生率は平均的です。";
            } else {
                baseScoreFlag = -1;
                scoreImpact -= 2;
                description = "該当エリア（市区町村）の犯罪件数はやや多めであり、防犯への意識が必要です。";
            }

            // 繁華街リスク判定 (半径500m OSMノード数で判定)
            // OSMデータは網羅性が高いため閾値を調整 (50件以上で繁華街リスク)
            let isDowntown = false;
            if (restaurantCount >= 50) {
                isDowntown = true;
                scoreImpact -= 3;
                description += ` ただし、駅周辺は飲食店やバーが密集する(${restaurantCount}件)ため、夜間のトラブルや騒音リスクに注意が必要です。`;
            } else if (restaurantCount > 0 && restaurantCount < 50) {
                description += ` 駅周辺の飲食店数は適度(${restaurantCount}件)であり、過度な繁華街リスクは低いです。`;
            } else {
                description += ` 駅近の飲食店は少なく、閑静な環境と言えます。`;
            }

            // ======================================
            // ファイル上書き保存（全件上書き）
            // ======================================
            const newItem = {
                category: "safety",
                label: "治安・犯罪リスク（ハイブリッド評価）",
                ruleDescription: description,
                targetMode: ["default", "family", "asset"],
                value: isDowntown ? "繁華街エリア" : (baseScoreFlag === 1 ? "評価高" : (baseScoreFlag === 0 ? "標準" : "注意")),
                scoreImpact: scoreImpact
            };

            if (!data.ext) data.ext = {};
            if (!Array.isArray(data.ext.dynamicAdditions)) {
                data.ext.dynamicAdditions = [];
            }

            const existingIndex = data.ext.dynamicAdditions.findIndex((item: any) => item.label === "治安・犯罪リスク（ハイブリッド評価）");
            if (existingIndex >= 0) {
                data.ext.dynamicAdditions[existingIndex] = newItem;
                console.log(`  -> [Update] 駅:${stationName}, 刑法犯認知件数=${crimeCount}件, OSM飲食店=${restaurantCount}件, Impact=${scoreImpact}`);
            } else {
                data.ext.dynamicAdditions.push(newItem);
                console.log(`  -> [Add] 駅:${stationName}, 刑法犯認知件数=${crimeCount}件, OSM飲食店=${restaurantCount}件, Impact=${scoreImpact}`);
            }

            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`  -> [Saved] ${file}`);

        } catch (err: any) {
            console.error(`- [Error] ${file} (${stationName}) 処理中エラー: ${err.message}`);
        }
    }

    console.log("\n===========================================");
    console.log("=== 直列バッチ処理・完了（差分更新） ===");
    console.log("===========================================");
    if (TEST_MODE) {
        console.log(`=== [テストモード] ${jsonFiles.length} 駅の処理が終了しました。 ===`);
    }
    console.log(` [結果] 既存データによるスキップ : ${skipAlreadyExistsCount} 件`);
    console.log(` [警告] データ欠損によるスキップ : ${skipCoordMissingCount} 件`);
    console.log("===========================================\n");
}

main().catch(err => {
    console.error("予期せぬクリティカルエラー:", err);
    process.exit(1);
});
