import fs from 'fs';
import path from 'path';
import config from 'dotenv';
config.config({ path: '.env.local' });

// Load hardcoded MLIT API Key logic from existing mlitServiceCore if env not set
const HARDCODED_KEY = "2001ce8821b5494fbd7b8fdb4f974313";
const API_KEY = process.env.MLIT_API_KEY || HARDCODED_KEY;
const BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001";
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');

// Prepare caching directory
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export const PREFECTURES = [
    { code: "01", name: "北海道" }, { code: "02", name: "青森県" }, { code: "03", name: "岩手県" }, { code: "04", name: "宮城県" }, { code: "05", name: "秋田県" },
    { code: "06", name: "山形県" }, { code: "07", name: "福島県" }, { code: "08", name: "茨城県" }, { code: "09", name: "栃木県" }, { code: "10", name: "群馬県" },
    { code: "11", name: "埼玉県" }, { code: "12", name: "千葉県" }, { code: "13", name: "東京都" }, { code: "14", name: "神奈川県" }, { code: "15", name: "新潟県" },
    { code: "16", name: "富山県" }, { code: "17", name: "石川県" }, { code: "18", name: "福井県" }, { code: "19", name: "山梨県" }, { code: "20", name: "長野県" },
    { code: "21", name: "岐阜県" }, { code: "22", name: "静岡県" }, { code: "23", name: "愛知県" }, { code: "24", name: "三重県" }, { code: "25", name: "滋賀県" },
    { code: "26", name: "京都府" }, { code: "27", name: "大阪府" }, { code: "28", name: "兵庫県" }, { code: "29", name: "奈良県" }, { code: "30", name: "和歌山県" },
    { code: "31", name: "鳥取県" }, { code: "32", name: "島根県" }, { code: "33", name: "岡山県" }, { code: "34", name: "広島県" }, { code: "35", name: "山口県" },
    { code: "36", name: "徳島県" }, { code: "37", name: "香川県" }, { code: "38", name: "愛媛県" }, { code: "39", name: "高知県" }, { code: "40", name: "福岡県" },
    { code: "41", name: "佐賀県" }, { code: "42", name: "長崎県" }, { code: "43", name: "熊本県" }, { code: "44", name: "大分県" }, { code: "45", name: "宮崎県" },
    { code: "46", name: "鹿児島県" }, { code: "47", name: "沖縄県" }
];

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndCacheMlitData(year: number, areaCode: string) {
    const cacheFile = path.join(CACHE_DIR, `${areaCode}_${year}.json`);

    // ① キャッシュが存在するかどうかをチェック
    if (fs.existsSync(cacheFile)) {
        console.log(`[SKIP] Area: ${areaCode}, Year: ${year} (Cache exists)`);
        return true;
    }

    console.log(`[FETCH] Downloading... Area: ${areaCode}, Year: ${year}`);
    const url = `${BASE_URL}?year=${year}&area=${areaCode}`;
    const headers = { "Ocp-Apim-Subscription-Key": API_KEY };

    try {
        const res = await fetch(url, { headers, cache: 'no-store' });

        if (!res.ok) {
            console.error(`[ERROR] API Returned Status ${res.status} for Area: ${areaCode}, Year: ${year}`);
            // エラーの場合、一旦リタイアするなど運用次第だが進める
            return false;
        }

        const json = await res.json();

        if (json.status !== "OK") {
            console.error(`[ERROR] API Returned Status ${json.status} for Area: ${areaCode}, Year: ${year}`);
            return false;
        }

        if (json.data) {
            fs.writeFileSync(cacheFile, JSON.stringify(json.data));
            console.log(`[SUCCESS] Saved ${json.data.length} records to ${cacheFile}`);
        } else {
            fs.writeFileSync(cacheFile, JSON.stringify([]));
            console.log(`[SUCCESS] Saved 0 records to ${cacheFile}`);
        }

        return true;
    } catch (e: any) {
        console.error(`[EXCEPTION] Area: ${areaCode}, Year: ${year} - ${e.message}`);
        return false;
    }
}

async function run() {
    console.log("=== STARTING MLIT RAW DATA DOWNLOAD BATCH ===");
    const currentYear = new Date().getFullYear();
    const targetYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

    for (const pref of PREFECTURES) {
        for (const year of targetYears) {
            const cacheFile = path.join(CACHE_DIR, `${pref.code}_${year}.json`);

            // ファイルが存在しなければフェッチする（Sleepが必要）
            if (!fs.existsSync(cacheFile)) {
                // ② 1分あたり60回の制限を遵守するため、リクエスト直前(または直後)に必ず1500msのSleepを入れる
                const success = await fetchAndCacheMlitData(year, pref.code);

                // 次のループへ行く前に「APIを叩いた場合のみ」1.5秒待機
                console.log("[WAIT] Sleeping for 1500ms to respect rate limit...");
                await sleep(1500);
            } else {
                // ファイルがあればSleep不要でスキップ
                console.log(`[SKIP] Area: ${pref.code}, Year: ${year} (Cache exists)`);
            }
        }
    }

    console.log("=== DONE DOWNLOADING MLIT RAW DATA ===");
}

run();
