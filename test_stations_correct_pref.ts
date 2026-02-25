import fs from 'fs';
import config from 'dotenv';
config.config({ path: '.env.local' });
import { getFullDiagnosisData, getStationCoords } from './lib/mlitServiceCore';
import { PREFECTURES } from './lib/constants';

async function run() {
    const testStations = ["武蔵小杉", "横浜", "新宿", "渋谷", "東戸塚", "保土ヶ谷", "川崎", "大宮", "品川", "東京", "新橋"];

    console.log(`Testing ${testStations.length} stations with automatic prefCode...`);

    for (const station of testStations) {
        try {
            // First get coords to find the prefecture
            const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(station)}`);
            const json = await res.json();
            const prefName = json.response?.station[0]?.prefecture;
            let prefCode = "13";
            if (prefName) {
                const pref = PREFECTURES.find(p => p.name === prefName);
                if (pref) prefCode = pref.code;
            }

            console.log(`[START] ${station} (${prefName}, ${prefCode})`);
            const data = await getFullDiagnosisData(station, prefCode);
            console.log(`[OK] ${station} - txCount: ${data.mlit.rawTransactions.length}`);
        } catch (e: any) {
            console.log(`[ERROR] ${station}: ${e.message}`);
        }
    }
}

run();
