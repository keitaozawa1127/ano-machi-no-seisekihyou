// @ts-nocheck
import fs from 'fs';
import path from 'path';

/**
 * ATTRIBUTE-BASED STATION INTEGRATION
 * Uses city names from station_master.json as the single source of truth
 * Abandons geometric geoContains in favor of string matching
 */

const stationMasterPath = path.join(process.cwd(), 'src/data/station_master.json');
const stationMaster = JSON.parse(fs.readFileSync(stationMasterPath, 'utf-8'));

console.log(`\n🔄 ATTRIBUTE-BASED INTEGRATION - String Matching`);
console.log(`Station Master: ${Object.keys(stationMaster).length} stations\n`);

async function rebuildWithAttributeMatching(prefCode: string) {
    const filePath = path.join(process.cwd(), 'public/data', `${prefCode}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const allPrefStations = Object.values(stationMaster).filter((s: any) => s.prefCode === prefCode);

    console.log(`📍 ${prefCode}: Processing ${allPrefStations.length} stations with attribute matching...`);

    let totalStations = 0;
    let stationAreas = 0;
    const verificationLog: { city: string; count: number; stations: string[] }[] = [];

    data.features.forEach((feature: any) => {
        const cityName = feature.properties?.N03_004 || feature.properties?.N03_003;
        if (!cityName) return;

        const stationsInArea: any[] = [];
        const uniqueLines = new Set<string>();

        // ATTRIBUTE-BASED MATCHING: Use city name from station master
        allPrefStations.forEach((station: any) => {
            if (!station.city) return;

            // Normalize and match city names
            const stationCity = station.city.replace(/市$/, '').replace(/区$/, '').replace(/町$/, '').replace(/村$/, '');
            const featureCity = cityName.replace(/市$/, '').replace(/区$/, '').replace(/町$/, '').replace(/村$/, '');

            if (stationCity === featureCity || station.city === cityName) {
                stationsInArea.push(station);
                station.lines.forEach((line: string) => uniqueLines.add(line));
            }
        });

        const fullCount = stationsInArea.length;
        feature.properties.stationCount = fullCount;
        feature.properties.railwayLineCount = uniqueLines.size;
        feature.properties.hasStation = fullCount > 0;

        if (fullCount === 0) feature.properties.densityTier = 0;
        else if (fullCount <= 2) feature.properties.densityTier = 1;
        else if (fullCount <= 5) feature.properties.densityTier = 2;
        else if (fullCount <= 10) feature.properties.densityTier = 3;
        else feature.properties.densityTier = 4;

        if (fullCount > 0) {
            stationAreas++;
            totalStations += fullCount;

            if (cityName && (cityName.includes('大和') || cityName.includes('東京') || cityName.includes('大阪') || cityName.includes('福島') || cityName.includes('千代田'))) {
                verificationLog.push({
                    city: cityName,
                    count: fullCount,
                    stations: stationsInArea.slice(0, 10).map(s => s.name)
                });
            }
        }
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 0));

    console.log(`  ✅ ${totalStations}駅 / ${stationAreas}自治体`);

    if (verificationLog.length > 0) {
        verificationLog.forEach(log => {
            console.log(`    🔍 ${log.city}: ${log.count}駅 [${log.stations.join(', ')}${log.count > 10 ? '...' : ''}]`);
        });
    }

    return { prefCode, totalStations, stationAreas, features: data.features.length };
}

async function main() {
    console.log('═'.repeat(80));

    const results = [];
    for (let i = 1; i <= 47; i++) {
        const prefCode = String(i).padStart(2, '0');
        const result = await rebuildWithAttributeMatching(prefCode);
        results.push(result);
    }

    console.log('\n\n📊 ATTRIBUTE-BASED INTEGRATION SUMMARY');
    console.log('═'.repeat(80));

    const totalStations = results.reduce((sum, r) => sum + r.totalStations, 0);
    const totalAreas = results.reduce((sum, r) => sum + r.stationAreas, 0);
    const totalFeatures = results.reduce((sum, r) => sum + r.features, 0);

    console.log(`✅ All 47 prefectures rebuilt with ATTRIBUTE matching`);
    console.log(`🚉 Total Stations: ${totalStations}`);
    console.log(`📍 Station Areas: ${totalAreas}/${totalFeatures}`);
    console.log(`📊 Coverage: ${(totalAreas / totalFeatures * 100).toFixed(1)}%`);
    console.log('═'.repeat(80));
    console.log('\n✨ Practical business truth achieved!\n');
}

main();
