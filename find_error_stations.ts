import fs from 'fs';
import config from 'dotenv';
config.config({ path: '.env.local' });
import { getFullDiagnosisData } from './lib/mlitServiceCore';
import { PREFECTURES } from './lib/constants';

async function run() {
    let allStationNames = new Set<string>();

    // Read from existing cache to get a realistic list of stations
    try {
        const coords = JSON.parse(fs.readFileSync('./data/cache/station_coords.json', 'utf8'));
        Object.keys(coords).forEach(s => allStationNames.add(s));
    } catch (e) { }

    // Add Tokyo & Kanagawa stations manually or from a known list to be safe
    const testStations = Array.from(allStationNames).slice(0, 100); // Test first 100 for speed
    if (testStations.length === 0) {
        testStations.push("武蔵小杉", "横浜", "新宿", "渋谷", "東戸塚", "保土ヶ谷", "川崎", "大宮", "品川", "東京", "新橋");
    }

    const errorStations = [];
    console.log(`Testing ${testStations.length} stations...`);

    for (const station of testStations) {
        try {
            await getFullDiagnosisData(station, "13"); // Pref doesn't matter much for this check as MLIT will fetch 13/14
        } catch (e: any) {
            if (e.message.includes("直近")) {
                errorStations.push(station);
            }
        }
    }

    fs.writeFileSync('error_stations_list.txt', errorStations.join("\n"));
    console.log(`Found ${errorStations.length} stations with data error.`);
}

run();
