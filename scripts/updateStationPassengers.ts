import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// 1. 環境設定
dotenv.config();

const PASSENGER_API_URL = process.env.PASSENGER_API_URL;
const GEOJSON_PATH = path.join(process.cwd(), 'data', 'geojson', 'station_passengers.geojson');

// コマンドライン引数 --test で先頭10件のみ処理するテストモード
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

// ==========================================
// ユーティリティ: スリープ関数
// ==========================================
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// テキスト正規化（ひらがな化、括弧除去等）
// ==========================================
function normalizeStationName(name: string): string {
    if (!name) return "";
    return name
        // 全角括弧などを半角に置換
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/［/g, '[')
        .replace(/］/g, ']')
        // 括弧内テキストを除去（例: 霞ヶ関(東京都) -> 霞ヶ関）
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        // ケ・ヶ・ヵ・カの表記ゆれ吸収
        .replace(/[ヶヵ]/g, 'ケ')
        .replace(/[ツッ]/g, 'ツ')
        // 一般的な不要な接尾語（駅）等がついている場合
        .replace(/駅$/g, '')
        // 連続スペースや前後の空白を除去
        .replace(/\s+/g, '')
        .trim();
}

// ==========================================
// API通信: エクスポネンシャル・バックオフ＋最大3回リトライ
// ==========================================
async function fetchPassengerWithRetry(url: string, retryCount = 0): Promise<any> {
    console.log(`  > [Passenger API] Fetching... (Retry: ${retryCount})`);
    try {
        const response = await fetch(url);
        await sleep(1500); // 厳格な 1500ms スリープ
        
        if (!response.ok) {
            if (retryCount < 3) {
                const backoffWaitTime = (retryCount + 1) * 10000; // 10s, 20s, 30s
                console.log(`  > [Passenger API] HTTP Error: ${response.status}. ${backoffWaitTime / 1000}秒待機後にリトライします...`);
                await sleep(backoffWaitTime);
                return await fetchPassengerWithRetry(url, retryCount + 1);
            }
            console.error(`  > [Passenger API] 最終HTTP Error: ${response.status}. リトライ上限到達`);
            return null;
        }

        return await response.json();
    } catch (err: any) {
        console.error(`  > [Passenger API] 通信エラー: ${err.message}`);
        await sleep(1500);
        
        if (retryCount < 3) {
            const backoffWaitTime = (retryCount + 1) * 10000;
            console.log(`  > [Passenger API] ネットワークエラー。${backoffWaitTime / 1000}秒待機後にリトライします...`);
            await sleep(backoffWaitTime);
            return await fetchPassengerWithRetry(url, retryCount + 1);
        }
        
        console.error(`  > [Passenger API] 最終通信エラー. リトライ上限到達`);
        return null;
    }
}

// ==========================================
// 乗降客数データ取得のハイブリッドロジック
// ==========================================
type PassengerData = { past: number; latest: number } | null;

async function getPassengerData(stationName: string, localGeoJson: any): Promise<PassengerData> {
    let pastVal = 0;
    let latestVal = 0;
    let found = false;

    const targetName = normalizeStationName(stationName);

    // 1. ローカルGeoJSONからの取得を試みる
    if (localGeoJson && localGeoJson.features) {
        for (const feature of localGeoJson.features) {
            const props = feature.properties;
            if (!props) continue;

            // S12_001 または汎用の station_name プロパティをチェック
            const rawGeoName = props.S12_001 || props.station_name || props.N02_005 || "";
            const geoStationName = normalizeStationName(rawGeoName);

            if (geoStationName && geoStationName === targetName) {
                // プロパティ (例えば S12_0xx に数値が入っている) から時系列の乗降客数を自動抽出
                // 国土数値情報（駅別乗降客数）は通常 S12_023〜（またはそれ以降など）に年度別の乗降客数が格納される
                const passengerValues: { key: string, val: number }[] = [];

                for (const key of Object.keys(props)) {
                    // S12_018, S12_023 などから始まる、あるいは数値として有効なものを抽出
                    // ※仕様に依存するため簡易チェックとして、"S12_"で始まり、値が数値であるものを抽出する。
                    // 実際には S12_023 が H23年度、S12_024 が H24年度など順番に並んでいることが多い。
                    if (key.startsWith("S12_") && typeof props[key] === 'number') {
                        const val = props[key];
                        const keyNum = parseInt(key.replace("S12_", ""), 10);
                        // 国土数値情報の乗降客数は S12_009, S12_013, S12_017... と4間隔で各年のデータが格納される
                        if (keyNum >= 9 && (keyNum - 9) % 4 === 0 && val > 0) {
                            passengerValues.push({ key, val });
                        }
                    } else if (key.startsWith("p_") && typeof props[key] === 'number') {
                        // 独自の汎用プロパティ（p_2018など）に対応
                        if (props[key] > 0) {
                            passengerValues.push({ key, val: props[key] });
                        }
                    }
                }

                if (passengerValues.length >= 2) {
                    // キー名でソート（S12_020 < S12_024 など、年度順を仮定）
                    passengerValues.sort((a, b) => a.key.localeCompare(b.key));
                    
                    // 最も古い有効な値
                    pastVal = passengerValues[0].val;
                    // 最も新しい有効な値
                    latestVal = passengerValues[passengerValues.length - 1].val;

                    if (latestVal > 0 && pastVal > 0) {
                        found = true;
                        console.log(`  > [Local] ${stationName} の乗降客データをGeoJSONから動的抽出 (Past:${pastVal}, Latest:${latestVal}).`);
                        break;
                    }
                } else if (passengerValues.length === 1) {
                    // 単年しかない場合は過去=最新で増減なし（0%）とするか、フォールバックするか。
                    // 今回は単年では増減率が出せないため、フォールバック扱いのままとする。
                }
            }
        }
    }

    // 2. ローカルに無く、APIのURLが設定されていればフォールバックしてAPIを叩く
    if (!found && PASSENGER_API_URL) {
        const url = `${PASSENGER_API_URL}?station=${encodeURIComponent(targetName)}`;
        const json = await fetchPassengerWithRetry(url);
        
        if (json && typeof json.latest === 'number' && typeof json.past === 'number') {
            pastVal = json.past;
            latestVal = json.latest;
            if (latestVal > 0 && pastVal > 0) {
                found = true;
                console.log(`  > [API] ${stationName} の乗降客データを取得.`);
            }
        }
    }

    if (!found || pastVal <= 0 || latestVal <= 0) {
        return null;
    }

    return { past: pastVal, latest: latestVal };
}


// ==========================================
// メイン関数
// ==========================================
async function main() {
    if (TEST_MODE) {
        console.log(`=== [テストモード] 先頭 ${TEST_LIMIT} 駅のみ処理 ===`);
    }
    console.log("=== 資産性：駅乗降客数推移 自動取得・更新スクリプト開始（全件上書きモード） ===");

    let processedCount = 0;
    let fallbackCount = 0;

    // --- 1. ローカルGeoJSONの読み込み（エラーは無視してnullにする） ---
    let localGeoData: any = null;
    try {
        const geoRaw = await fs.readFile(GEOJSON_PATH, 'utf-8');
        localGeoData = JSON.parse(geoRaw);
        console.log(`> [Info] ローカルGeoJSON (${GEOJSON_PATH}) をロードしました`);
    } catch (e) {
        console.log(`> [Info] ローカルGeoJSONが見つからない、または読み込めません。取得はAPIおよびフォールバックに依存します。`);
        console.log(`> [提示] 国土数値情報（駅別乗降客数データ S12）の最新GeoJSONをダウンロードし、`);
        console.log(`>       'data/geojson/station_passengers.geojson' に配置してください。`);
    }

    if (!PASSENGER_API_URL && !localGeoData) {
        console.warn(`> [Warn] PASSENGER_API_URL も設定されておらず、ローカルGeoJSONも存在しません。全件フォールバック処理となります。`);
    }

    // --- 2. ターゲットパスの設定とファイル一覧取得 ---
    const targetDir = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
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

            // --- 乗降客データの取得 ---
            const passengerData = await getPassengerData(stationName, localGeoData);

            // ======================================
            // 評価ロジック（フォールバック対応）
            // ======================================
            let scoreImpact = 0;
            let description = "";
            let evaluationValue = "";
            let diffRate = 0;

            if (!passengerData) {
                console.log(`  > [Fallback] ${stationName}: データが取得できないため標準水準(0%)でフォールバックします。`);
                scoreImpact = 0;
                diffRate = 0;
                evaluationValue = "安定エリア（データ欠損・仮評価）";
                description = "該当エリアの詳細データが取得できないため、標準水準として仮評価しています。";
                fallbackCount++;
            } else {
                // 増減率(%)の算出 (最新 - 過去) / 過去 * 100
                diffRate = ((passengerData.latest - passengerData.past) / passengerData.past) * 100;
                const formattedRate = (diffRate > 0 ? "+" : "") + diffRate.toFixed(1) + "%";

                if (diffRate >= 5.0) {
                    scoreImpact = 2;
                    evaluationValue = `成長エリア（乗降客数増加 ${formattedRate}）`;
                    description = "駅利用者が増加傾向にあり、街の発展と不動産需要の拡大が期待できます。";
                } else if (diffRate <= -5.0) {
                    scoreImpact = -2;
                    evaluationValue = `衰退懸念エリア（乗降客数減少 ${formattedRate}）`;
                    description = "駅利用者の減少が見られ、将来的な不動産需要の縮小に注意が必要です。";
                } else {
                    scoreImpact = 0;
                    evaluationValue = `安定エリア（乗降客数横ばい ${formattedRate}）`;
                    description = "駅利用者は安定しており、成熟した住環境が維持されています。";
                }
            }

            // ======================================
            // ファイル上書き保存（差分スキップなし・全件上書き）
            // ======================================
            const newItem = {
                category: "asset",
                label: "駅乗降客数推移",
                ruleDescription: description,
                targetMode: ["asset"],
                value: evaluationValue,
                scoreImpact: scoreImpact
            };

            if (!data.ext) data.ext = {};
            if (!Array.isArray(data.ext.dynamicAdditions)) {
                data.ext.dynamicAdditions = [];
            }

            const existingIndex = data.ext.dynamicAdditions.findIndex((item: any) => item.label === "駅乗降客数推移");
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
    console.log("===========================================\n");
}

main().catch(err => {
    console.error("予期せぬクリティカルエラー:", err);
    process.exit(1);
});
