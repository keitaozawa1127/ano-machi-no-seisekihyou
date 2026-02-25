import fs from 'fs';
import config from 'dotenv';
config.config({ path: '.env.local' });
import { getFullDiagnosisData } from './lib/mlitServiceCore';

async function run() {
    const testStations = ["武蔵小杉", "横浜", "新宿", "渋谷", "東戸塚", "保土ヶ谷", "川崎", "大宮", "品川", "東京", "新橋"];

    const errorStations = [];
    console.log(`Testing ${testStations.length} stations...`);

    for (const station of testStations) {
        try {
            await getFullDiagnosisData(station, "13"); // Pref 13/14 fetched automatically where applicable based on API lookup logic internally
            console.log(`[OK] ${station}`);
        } catch (e: any) {
            console.log(`[ERROR] ${station}: ${e.message}`);
            if (e.message.includes("直近")) {
                errorStations.push(station);
            }
        }
    }

    fs.writeFileSync('error_stations_list_quick.txt', errorStations.join("\n"));
    console.log(`Found ${errorStations.length} stations with data error.`);
}

run();
