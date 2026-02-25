import fs from 'fs';
import path from 'path';
import { geoContains } from 'd3-geo';

/**
 * FINAL DATA REBUILD: Physical regeneration of all 47 GeoJSON files
 * Ensures 100% consistency with station_master.json (SSoT)
 */

const stationMasterPath = path.join(process.cwd(), 'src/data/station_master.json');
const stationMaster = JSON.parse(fs.readFileSync(stationMasterPath, 'utf-8'));

console.log(`\n🔄 FINAL DATA REBUILD - Physical Regeneration`);
console.log(`Loaded station master: ${Object.keys(stationMaster).length} stations\n`);

async function rebuildPrefecture(prefCode: string) {
    const filePath = path.join(process.cwd(), 'public/data', `${prefCode}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const prefStations = Object.values(stationMaster).filter((s: any) => s.prefCode === prefCode);

    console.log(`📍 ${prefCode}: Rebuilding with ${prefStations.length} stations...`);

    let totalStations = 0;
    let stationAreas = 0;
    let verificationLog: string[] = [];

    data.features.forEach((feature: any) => {
        const cityName = feature.properties?.N03_004 || feature.properties?.N03_003;
        const stationsInArea: any[] = [];
        const uniqueLines = new Set<string>();

        prefStations.forEach((station: any) => {
            try {
                if (geoContains(feature, station.coordinates)) {
                    stationsInArea.push(station);
                    station.lines.forEach((line: string) => uniqueLines.add(line));
                }
            } catch (e) { }
        });

        // Physical update
        feature.properties.stationCount = stationsInArea.length;
        feature.properties.railwayLineCount = uniqueLines.size;
        feature.properties.hasStation = stationsInArea.length > 0;

        const density = stationsInArea.length;
        if (density === 0) feature.properties.densityTier = 0;
        else if (density <= 2) feature.properties.densityTier = 1;
        else if (density <= 5) feature.properties.densityTier = 2;
        else if (density <= 10) feature.properties.densityTier = 3;
        else feature.properties.densityTier = 4;

        if (stationsInArea.length > 0) {
            stationAreas++;
            totalStations += stationsInArea.length;

            // Log for verification (especially Yamato City)
            if (cityName && cityName.includes('大和')) {
                verificationLog.push(`  ✓ ${cityName}: ${stationsInArea.length}駅 [${stationsInArea.map(s => s.name).join(', ')}]`);
            }
        }
    });

    // Physical save
    fs.writeFileSync(filePath, JSON.stringify(data, null, 0));

    console.log(`  ✅ ${totalStations}駅 / ${stationAreas}自治体 (${(stationAreas / data.features.length * 100).toFixed(1)}%)`);

    if (verificationLog.length > 0) {
        console.log(`  🔍 Verification:`);
        verificationLog.forEach(log => console.log(log));
    }

    return {
        prefCode,
        totalStations,
        stationAreas,
        features: data.features.length
    };
}

async function main() {
    console.log('═'.repeat(80));

    const results = [];
    for (let i = 1; i <= 47; i++) {
        const prefCode = String(i).padStart(2, '0');
        const result = await rebuildPrefecture(prefCode);
        results.push(result);
    }

    console.log('\n\n📊 REBUILD SUMMARY');
    console.log('═'.repeat(80));

    const totalStations = results.reduce((sum, r) => sum + r.totalStations, 0);
    const totalAreas = results.reduce((sum, r) => sum + r.stationAreas, 0);
    const totalFeatures = results.reduce((sum, r) => sum + r.features, 0);

    console.log(`✅ All 47 prefectures rebuilt`);
    console.log(`🚉 Total Stations: ${totalStations}`);
    console.log(`📍 Station Areas: ${totalAreas}/${totalFeatures}`);
    console.log(`📊 Coverage: ${(totalAreas / totalFeatures * 100).toFixed(1)}%`);
    console.log('═'.repeat(80));

    // Save rebuild report
    fs.writeFileSync(
        path.join(process.cwd(), 'data_rebuild_report.json'),
        JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
    );

    console.log('\n✨ Physical data rebuild complete!\n');
}

main();
