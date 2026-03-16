import fs from 'fs';
import path from 'path';
import { diagnoseAsync } from '../lib/diagnoseLogic';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'stations');

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log(`🚀 Starting Refreshed Static Diagnosis Generation...`);
    console.log(`📂 Scanning cache directory: ${CACHE_DIR}`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created directory: ${OUTPUT_DIR}`);
    }

    // Get all *_full_v8.json files from cache
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('_full_v8.json'));
    console.log(`📊 Found ${files.length} cached stations.`);

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
        // Filename format: [StationName]_[PrefCode]_full_v8.json
        const parts = file.split('_');
        if (parts.length < 2) continue;

        const stationName = parts[0];
        const prefCode = parts[1];
        const outputFilePath = path.join(OUTPUT_DIR, `${stationName}.json`);

        // Fully overwrite (Force Update) as requested

        console.log(`\n--- [${successCount + failCount + 1}/${files.length}] Processing: ${stationName} (Pref: ${prefCode}) ---`);
        
        try {
            const start = Date.now();
            
            // Execute diagnosis logic to get the formatted result
            // This will use the cache internally in most cases
            const result = await diagnoseAsync(stationName, prefCode, 2024) as any;
            
            if (result.ok || result.partialSuccess) {
                const filePath = path.join(OUTPUT_DIR, `${stationName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
                console.log(`✅ Saved: ${filePath} (${Date.now() - start}ms)${result.partialSuccess ? ' [Partial]' : ''}`);
                successCount++;
            } else {
                console.error(`❌ Diagnosis Failed for ${stationName}: ${result.error}`);
                failCount++;
            }
        } catch (error) {
            console.error(`❌ Unexpected Error for ${stationName}:`, error);
            failCount++;
        }

        // Mandatory Sleep to avoid API Rate Limit (just in case some parts trigger new API calls)
        // Using a shorter sleep (500ms) because most are cached
        await sleep(500);
    }

    console.log(`\n✨ Generation Finished!`);
    console.log(`Total Found: ${files.length}, Success: ${successCount}, Fail: ${failCount}`);
    console.log(`Outputs are located in: ${OUTPUT_DIR}`);
}

run().catch(err => {
    console.error('Fatal Error during generation:', err);
    process.exit(1);
});
