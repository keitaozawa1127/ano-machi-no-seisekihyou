// @ts-nocheck
import fs from 'fs';
import path from 'path';

// .env から環境変数を読み込む簡易対応
const envPath = path.join(process.cwd(), '.env');
const localEnvPath = path.join(process.cwd(), '.env.local');

function loadEnv(filepath: string) {
    if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf-8');
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                    value = value.replace(/\\n/gm, '\n');
                }
                value = value.replace(/(^['"]|['"]$)/g, '');
                process.env[key] = value;
            }
        });
    }
}

loadEnv(envPath);
loadEnv(localEnvPath);

const BASE_URL = 'http://localhost:3000'; // Need to be running `npm run dev`

// 主要な駅のリスト（山手線など主要路線から抜粋、または任意）
const TARGET_STATIONS = [
    { name: "東京", pref: "13" },
    { name: "新宿", pref: "13" },
    { name: "渋谷", pref: "13" },
    { name: "池袋", pref: "13" },
    { name: "品川", pref: "13" },
    { name: "新橋", pref: "13" },
    { name: "秋葉原", pref: "13" },
    { name: "上野", pref: "13" },
    { name: "横浜", pref: "14" },
    { name: "川崎", pref: "14" },
    { name: "武蔵小杉", pref: "14" },
    { name: "大宮", pref: "11" },
    { name: "浦和", pref: "11" },
    { name: "千葉", pref: "12" },
    { name: "船橋", pref: "12" },
    { name: "梅田", pref: "27" },
    { name: "なんば", pref: "27" },
    { name: "天王寺", pref: "27" },
    { name: "京都", pref: "26" },
    { name: "三宮", pref: "28" },
    { name: "名古屋", pref: "23" },
    { name: "博多", pref: "40" },
    { name: "天神", pref: "40" },
    { name: "札幌", pref: "01" },
    { name: "仙台", pref: "04" },
];

async function run() {
    console.log(`Starting pre-computation for ${TARGET_STATIONS.length} stations...`);
    let successCount = 0;

    for (const st of TARGET_STATIONS) {
        console.log(`\n--- Processing: ${st.name} (Pref: ${st.pref}) ---`);
        try {
            const start = Date.now();
            const res = await fetch(`${BASE_URL}/api/diagnose`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stationName: st.name, prefCode: st.pref })
            });

            if (!res.ok) {
                console.error(`❌ HTTP Error for ${st.name}: ${res.status}`);
                continue;
            }

            const json = await res.json();

            if (json.ok) {
                console.log(`✅ Success for ${st.name} in ${Date.now() - start}ms`);
                successCount++;
            } else {
                console.error(`❌ Logical Error for ${st.name}:`, json.error);
            }

            // サーバー負荷軽減のためのスリープ
            await new Promise(r => setTimeout(r, 1000));

        } catch (e: any) {
            console.error(`❌ Exception for ${st.name}:`, e);
        }
    }

    console.log(`\n=== Pre-computation finished. Success: ${successCount} / ${TARGET_STATIONS.length} ===`);
}

run();
