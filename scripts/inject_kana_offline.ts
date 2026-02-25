// @ts-nocheck

import fs from 'fs';
import path from 'path';
import * as wanakana from 'wanakana';

const STATION_MASTER_PATH = path.join(process.cwd(), 'src/data/station_master.json');
const STATIONS_JSON_PATH = path.join(process.cwd(), 'public/data/stations.json');
const REF_PATH = path.join(process.cwd(), 'temp_reference_stations.json');

async function main() {
    console.log('🚀 Starting Offline Kana Injection Process...');

    if (!fs.existsSync(REF_PATH)) {
        console.error('❌ temp_reference_stations.json not found');
        return;
    }

    const refData = JSON.parse(fs.readFileSync(REF_PATH, 'utf-8'));
    const stationMaster = JSON.parse(fs.readFileSync(STATION_MASTER_PATH, 'utf-8'));
    const publicData = JSON.parse(fs.readFileSync(STATIONS_JSON_PATH, 'utf-8'));

    // Create a generic JP -> Kana map from reference
    const nameToKana: Map<string, string> = new Map();

    function traverse(node: any) {
        if (Array.isArray(node)) {
            node.forEach(traverse);
        } else if (typeof node === 'object' && node !== null) {
            if (node.stations) traverse(node.stations);
            if (node.lines) traverse(node.lines);

            // Extract station info
            if (node.name && node.name.ja && node.name.en) {
                const ja = node.name.ja;
                let en = node.name.en;

                // Cleanup English name
                // "JR ...", "Station" etc? Usually just Name.
                // "Tokyo"
                // "Shinjuku"
                // If it contains spaces, it might be "Shin-Something" or "New Something".
                // Wanakana matches "Shin-Osaka" -> "しん-おさか"?
                // Let's remove hyphens.
                en = en.replace(/-/g, '').replace(/ /g, '').toLowerCase();

                // Convert to Hiragana
                const kana = wanakana.toHiragana(en);
                // Validation: kana should not contain latin letters if successful
                if (!/[a-z]/.test(kana)) {
                    // Avoid overriding if we have a shorter/better one? No key collision is by name.
                    // Just store.
                    nameToKana.set(ja, kana);
                }
            }
        }
    }

    console.log('Building Kanji->Kana map from reference...');
    traverse(refData);
    console.log(`Mapped ${nameToKana.size} unique station names.`);

    // Inject into Station Master
    let updatedCount = 0;
    Object.keys(stationMaster).forEach(key => {
        const s = stationMaster[key];
        if (!s.kana && nameToKana.has(s.name)) {
            s.kana = nameToKana.get(s.name);
            updatedCount++;
        }
    });

    console.log(`Injected Kana into ${updatedCount} stations in station_master.`);

    // Save Station Master
    fs.writeFileSync(STATION_MASTER_PATH, JSON.stringify(stationMaster, null, 2));

    // Update public data
    let publicCount = 0;
    Object.keys(publicData).forEach(key => {
        const s = publicData[key];
        // match by name (stations.json keys are unique IDs or similar, values are station objects)
        // Actually public/data/stations.json structure: "id": { ... }
        if (s.name && nameToKana.has(s.name)) {
            s.kana = nameToKana.get(s.name);
            publicCount++;
        }
    });

    console.log(`Injected Kana into ${publicCount} stations in public/data/stations.json.`);
    fs.writeFileSync(STATIONS_JSON_PATH, JSON.stringify(publicData, null, 2));

    // Verify Tokyo
    const tokyo = publicData[Object.keys(publicData).find(k => publicData[k].name === "東京") || ""];
    if (tokyo) {
        console.log(`Verification: 東京 -> ${tokyo.kana}`);
    }
}

main();
