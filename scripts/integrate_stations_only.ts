// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { geoContains } from 'd3-geo';

/**
 * Station Integration ONLY - No Simplification
 * Preserve original geometries to ensure Point-in-Polygon works
 */

const stationMasterPath = path.join(process.cwd(), 'src/data/station_master.json');
const stationMaster = JSON.parse(fs.readFileSync(stationMasterPath, 'utf-8'));

console.log(`Loaded station master: ${Object.keys(stationMaster).length} unique stations\n`);

async function processFile(filePath: string) {
    const prefCode = path.basename(filePath, '.json');
    console.log(`📍 ${prefCode}`);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const prefStations = Object.values(stationMaster).filter((s: any) => s.prefCode === prefCode);

    console.log(`  Found ${prefStations.length} stations in master`);

    let totalStations = 0;
    let stationAreas = 0;
    let successfulMatches = 0;

    data.features.forEach((feature: any, idx: number) => {
        const stationsInArea: any[] = [];
        const uniqueLines = new Set<string>();

        prefStations.forEach((station: any) => {
            try {
                // const point = { type: 'Point', coordinates: station.coordinates };
                if (geoContains(feature, station.coordinates)) {
                    stationsInArea.push(station);
                    station.lines.forEach((line: string) => uniqueLines.add(line));
                    successfulMatches++;
                }
            } catch (e: any) {
                // Geometry error - log first occurrence only
                if (idx === 0) {
                    console.log(`  ⚠️  geoContains error on feature 0:`, (e as Error).message);
                }
            }
        });

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
        }
    });

    fs.writeFileSync(filePath, JSON.stringify(data));

    console.log(`  ✅ ${totalStations} stations in ${stationAreas}/${data.features.length} municipalities`);
    console.log(`  📊 Coverage: ${(stationAreas / data.features.length * 100).toFixed(1)}%`);
    console.log(`  🔗 Successful matches: ${successfulMatches}\n`);

    return {
        prefCode,
        features: data.features.length,
        totalStations,
        stationAreas,
        coverage: (stationAreas / data.features.length * 100).toFixed(1),
        successfulMatches
    };
}

async function main() {
    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
        .filter(f => f.match(/^\d{2}\.json$/))
        .sort()
        .map(f => path.join(dataDir, f));

    console.log('🚉 Station Integration (No Simplification)');
    console.log('═'.repeat(80));
    console.log(`Processing ${files.length} prefectures\n`);

    const results = [];
    for (const file of files) {
        const result = await processFile(file);
        results.push(result);
    }

    console.log('\n📊 FINAL SUMMARY');
    console.log('═'.repeat(80));

    const totalStations = results.reduce((sum, r) => sum + r.totalStations, 0);
    const totalAreas = results.reduce((sum, r) => sum + r.stationAreas, 0);
    const totalMunicipalities = results.reduce((sum, r) => sum + r.features, 0);
    const totalMatches = results.reduce((sum, r) => sum + r.successfulMatches, 0);
    const avgCoverage = results.reduce((sum, r) => sum + parseFloat(r.coverage), 0) / results.length;

    console.log(`✅ Prefectures: ${results.length}/47`);
    console.log(`🚉 Total Stations: ${totalStations}`);
    console.log(`📍 Station Areas: ${totalAreas}/${totalMunicipalities}`);
    console.log(`📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
    console.log(`🔗 Total Point-in-Polygon Matches: ${totalMatches}`);
    console.log('═'.repeat(80));

    const tokyo = results.find(r => r.prefCode === '13');
    const fukushima = results.find(r => r.prefCode === '07');
    const kumamoto = results.find(r => r.prefCode === '43');

    console.log('\n🔍 PROOF POINTS:');
    if (tokyo) {
        console.log(`\n東京都 (13):`);
        console.log(`  Stations: ${tokyo.totalStations}`);
        console.log(`  Coverage: ${tokyo.stationAreas}/${tokyo.features} (${tokyo.coverage}%)`);
        console.log(`  Matches: ${tokyo.successfulMatches}`);
    }

    if (fukushima) {
        console.log(`\n福島県 (07):`);
        console.log(`  Stations: ${fukushima.totalStations}`);
        console.log(`  Coverage: ${fukushima.stationAreas}/${fukushima.features} (${fukushima.coverage}%)`);
        console.log(`  Matches: ${fukushima.successfulMatches}`);
    }

    if (kumamoto) {
        console.log(`\n熊本県 (43):`);
        console.log(`  Stations: ${kumamoto.totalStations}`);
        console.log(`  Coverage: ${kumamoto.stationAreas}/${kumamoto.features} (${kumamoto.coverage}%)`);
        console.log(`  Matches: ${kumamoto.successfulMatches}`);
    }

    fs.writeFileSync(
        path.join(process.cwd(), 'station_integration_success_report.json'),
        JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
    );

    console.log('\n✨ Integration complete!\n');
}

main();
