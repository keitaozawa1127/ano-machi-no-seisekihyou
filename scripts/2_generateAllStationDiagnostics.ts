import fs from 'fs';
import path from 'path';
import config from 'dotenv';
config.config({ path: '.env.local' });
import { PREFECTURES } from '../lib/constants';
import { getFullDiagnosisData, getStationList } from '../lib/mlitServiceCore';

// Directories
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const CACHE_DIAG_DIR = path.join(CACHE_DIR, 'diagnosis');

try {
    if (!fs.existsSync(CACHE_DIAG_DIR)) {
        fs.mkdirSync(CACHE_DIAG_DIR, { recursive: true });
    }
} catch (e) {
    console.error("Failed to create cache directories:", e);
}

// ---------------------------------------------------------
// NOTE: MLIT API calls (fetchMlitData) are offline-capable
// inside getFullDiagnosisData *if* data/cache/*.json exists.
// Be sure to run 1_downloadAllMlitRawData.ts beforehand.
// ---------------------------------------------------------

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("=== STARTING BATCH: GENERATE ALL STATION DIAGNOSTICS ===");

    // Step 1: Collect ALL stations across Japan
    console.log("Fetching global station list from HeartRails...");
    let allTargetStations: { name: string, prefCode: string }[] = [];

    for (const pref of PREFECTURES) {
        try {
            // Retrieve station list for this prefecture
            console.log(`Getting stations for ${pref.name}...`);
            const stations = await getStationList(pref.code);
            if (stations && stations.length > 0) {
                // Remove duplicates in current prefecture
                const uniqueNames = Array.from(new Set(stations.map((s: any) => s.name)));
                uniqueNames.forEach(name => {
                    allTargetStations.push({ name: name as string, prefCode: pref.code });
                });
            }

            // Wait 200ms to avoid overloading HeartRails API
            await sleep(200);
        } catch (e: any) {
            console.error(`[ERROR] Failed to fetch station list for ${pref.name}: ${e.message}`);
        }
    }

    console.log(`Total target stations collected: ${allTargetStations.length}`);

    // Step 2: Extract 'missing' stations by checking existing files
    let remainingStations = [];

    for (const target of allTargetStations) {
        // Name normalization matches lib/mlitServiceCore.ts normalizeStation()
        const safeName = target.name.replace(/[ 　]/g, '').replace(/駅$/, '').trim();
        const cacheKey = `${safeName}_${target.prefCode}_full_v8.json`;
        const cachePath = path.join(CACHE_DIAG_DIR, cacheKey);

        if (!fs.existsSync(cachePath)) {
            remainingStations.push(target);
        }
    }

    console.log(`Stations left to generate off-line: ${remainingStations.length} / ${allTargetStations.length}`);

    // Step 3: Loop and generate missing station diagnostics
    let count = 0;
    const TOTAL = remainingStations.length;

    for (const target of remainingStations) {
        count++;
        try {
            console.log(`[${count}/${TOTAL}] Generating JSON for ${target.name} (Pref Code: ${target.prefCode})...`);

            // Runs local algorithm (will read MLIT data directly from cache avoiding network calls)
            await getFullDiagnosisData(target.name, target.prefCode);

            // As a precaution against overwhelming memory or internal Promises, a soft ~50ms tick
            await sleep(50);

        } catch (e: any) {
            console.error(`[ERROR] Generation failed for ${target.name} (${target.prefCode}): ${e.message}`);
        }
    }

    console.log("=== ALL DONE. RE-RUN TO RETRY FAILURES ==");
}

run();
