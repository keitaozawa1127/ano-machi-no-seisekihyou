import fs from 'fs';
import path from 'path';
import { geoContains } from 'd3-geo';
import { PREFECTURES } from '../lib/constants';

/**
 * Comprehensive Station Master Dictionary Builder
 * Multi-source approach to ensure complete station coverage
 */

interface Station {
    name: string;
    line: string;
    prefecture: string;
    prefCode: string;
    municipality?: string;
    lon: number;
    lat: number;
}

interface StationMasterEntry {
    name: string;
    lines: string[];
    prefecture: string;
    prefCode: string;
    municipalities: string[];
    coordinates: [number, number];
}

/**
 * Fetch stations using HeartRails API (line-based approach)
 */
async function fetchStationsViaHeartRails(prefName: string): Promise<Station[]> {
    try {
        console.log(`    Fetching lines for ${prefName}...`);
        const linesUrl = `https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(prefName)}`;
        const linesRes = await fetch(linesUrl);

        if (!linesRes.ok) {
            console.log(`    ⚠️  Lines API error: ${linesRes.status}`);
            return [];
        }

        const linesJson: any = await linesRes.json();

        if (!linesJson.response || !linesJson.response.line) {
            console.log(`    ⚠️  No lines found`);
            return [];
        }

        const lines: string[] = linesJson.response.line;
        console.log(`    Found ${lines.length} lines, fetching stations...`);

        const allStations: Station[] = [];

        for (const line of lines) {
            const stUrl = `https://express.heartrails.com/api/json?method=getStations&line=${encodeURIComponent(line)}`;
            const stRes = await fetch(stUrl);

            if (stRes.ok) {
                const stJson: any = await stRes.json();
                if (stJson.response?.station) {
                    stJson.response.station.forEach((s: any) => {
                        allStations.push({
                            name: s.name,
                            line: line,
                            prefecture: s.prefecture,
                            prefCode: '', // Will be filled later
                            lon: parseFloat(s.x),
                            lat: parseFloat(s.y)
                        });
                    });
                }
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`    ✓ Fetched ${allStations.length} station records`);
        return allStations;
    } catch (error) {
        console.error(`    ❌ Error:`, error);
        return [];
    }
}

/**
 * Build comprehensive station master dictionary
 */
async function buildStationMaster() {
    console.log('\n🚉 Building Comprehensive Station Master Dictionary');
    console.log('═'.repeat(80));

    const stationMaster: { [key: string]: StationMasterEntry } = {};
    const allStations: Station[] = [];

    // Fetch stations for all prefectures
    for (const pref of PREFECTURES) {
        console.log(`\n📍 ${pref.code} - ${pref.name}`);

        const stations = await fetchStationsViaHeartRails(pref.name);

        stations.forEach(station => {
            station.prefCode = pref.code;
            allStations.push(station);

            // Build master entry
            const key = `${station.name}_${station.prefecture}`;
            if (!stationMaster[key]) {
                stationMaster[key] = {
                    name: station.name,
                    lines: [],
                    prefecture: station.prefecture,
                    prefCode: pref.code,
                    municipalities: [],
                    coordinates: [station.lon, station.lat]
                };
            }

            if (!stationMaster[key].lines.includes(station.line)) {
                stationMaster[key].lines.push(station.line);
            }
        });

        // Rate limiting between prefectures
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n📊 Station Master Summary');
    console.log('═'.repeat(80));
    console.log(`Total Station Records: ${allStations.length}`);
    console.log(`Unique Stations: ${Object.keys(stationMaster).length}`);

    // Save station master
    const masterPath = path.join(process.cwd(), 'src/data/station_master.json');
    fs.mkdirSync(path.dirname(masterPath), { recursive: true });
    fs.writeFileSync(masterPath, JSON.stringify(stationMaster, null, 2));

    console.log(`✓ Station master saved: ${masterPath}`);

    return { stationMaster, allStations };
}

/**
 * Integrate station metadata into GeoJSON files
 */
async function integrateStationMetadata(stationMaster: { [key: string]: StationMasterEntry }) {
    console.log('\n\n🔧 Integrating Station Metadata into GeoJSON');
    console.log('═'.repeat(80));

    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
        .filter(f => f.match(/^\d{2}\.json$/))
        .sort();

    const results = [];

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const prefCode = file.replace('.json', '');
        const pref = PREFECTURES.find(p => p.code === prefCode);

        if (!pref) continue;

        console.log(`\n📍 ${prefCode} - ${pref.name}`);

        // Load GeoJSON
        const geoData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Get stations for this prefecture
        const prefStations = Object.values(stationMaster).filter(s => s.prefCode === prefCode);
        console.log(`  Found ${prefStations.length} stations in master`);

        // Integrate metadata using Point-in-Polygon
        let totalStations = 0;
        let stationAreas = 0;

        geoData.features.forEach((feature: any) => {
            const stationsInArea: StationMasterEntry[] = [];
            const uniqueLines = new Set<string>();

            prefStations.forEach(station => {
                try {
                    // const point = { type: 'Point', coordinates: station.coordinates };
                    if (geoContains(feature, station.coordinates)) {
                        stationsInArea.push(station);
                        station.lines.forEach(line => uniqueLines.add(line));

                        // Update station master with municipality info
                        const cityName = feature.properties.N03_004 || feature.properties.N03_003;
                        if (cityName && !station.municipalities.includes(cityName)) {
                            station.municipalities.push(cityName);
                        }
                    }
                } catch (e) {
                    // Skip invalid geometries
                }
            });

            // Set metadata
            feature.properties.stationCount = stationsInArea.length;
            feature.properties.railwayLineCount = uniqueLines.size;
            feature.properties.hasStation = stationsInArea.length > 0;

            // Calculate density tier (0-4) for choropleth
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

        // Save updated GeoJSON
        fs.writeFileSync(filePath, JSON.stringify(geoData));

        console.log(`  ✓ ${totalStations} stations in ${stationAreas}/${geoData.features.length} municipalities`);
        console.log(`  📊 hasStation coverage: ${(stationAreas / geoData.features.length * 100).toFixed(1)}%`);

        results.push({
            prefCode,
            prefName: pref.name,
            totalMunicipalities: geoData.features.length,
            stationAreas,
            totalStations,
            coverage: (stationAreas / geoData.features.length * 100).toFixed(1)
        });
    }

    return results;
}

/**
 * Validate critical areas
 */
function validateCriticalAreas(stationMaster: { [key: string]: StationMasterEntry }) {
    console.log('\n\n🔍 Validating Critical Areas');
    console.log('═'.repeat(80));

    // Tokyo Yamanote Line
    const yamanoteStations = [
        '東京', '有楽町', '新橋', '浜松町', '田町', '品川', '大崎', '五反田',
        '目黒', '恵比寿', '渋谷', '原宿', '代々木', '新宿', '新大久保', '高田馬場',
        '目白', '池袋', '大塚', '巣鴨', '駒込', '田端', '西日暮里', '日暮里',
        '鶯谷', '上野', '御徒町', '秋葉原', '神田'
    ];

    console.log('\n1. Tokyo Yamanote Line (29 stations):');
    let foundCount = 0;
    yamanoteStations.forEach(name => {
        const found = Object.values(stationMaster).some(s =>
            s.name === name && s.prefecture === '東京都'
        );
        if (found) {
            foundCount++;
            console.log(`  ✓ ${name}`);
        } else {
            console.log(`  ✗ ${name} - MISSING`);
        }
    });
    console.log(`  Result: ${foundCount}/29 found (${(foundCount / 29 * 100).toFixed(1)}%)`);

    // Fukushima major stations
    const fukushimaStations = ['福島', '郡山'];
    console.log('\n2. Fukushima Major Stations:');
    fukushimaStations.forEach(name => {
        const found = Object.values(stationMaster).some(s =>
            s.name === name && s.prefecture === '福島県'
        );
        console.log(`  ${found ? '✓' : '✗'} ${name}`);
    });

    // Kumamoto
    const kumamotoStations = ['熊本'];
    console.log('\n3. Kumamoto Major Stations:');
    kumamotoStations.forEach(name => {
        const found = Object.values(stationMaster).some(s =>
            s.name === name && s.prefecture === '熊本県'
        );
        console.log(`  ${found ? '✓' : '✗'} ${name}`);
    });
}

/**
 * Main execution
 */
async function main() {
    try {
        // Step 1: Build station master
        const { stationMaster, allStations } = await buildStationMaster();

        // Step 2: Validate critical areas
        validateCriticalAreas(stationMaster);

        // Step 3: Integrate into GeoJSON
        const results = await integrateStationMetadata(stationMaster);

        // Step 4: Final summary
        console.log('\n\n📊 FINAL INTEGRATION SUMMARY');
        console.log('═'.repeat(80));

        const totalStations = results.reduce((sum, r) => sum + r.totalStations, 0);
        const totalAreas = results.reduce((sum, r) => sum + r.stationAreas, 0);
        const totalMunicipalities = results.reduce((sum, r) => sum + r.totalMunicipalities, 0);
        const avgCoverage = results.reduce((sum, r) => sum + parseFloat(r.coverage), 0) / results.length;

        console.log(`✅ Prefectures Processed: ${results.length}/47`);
        console.log(`🚉 Total Stations Integrated: ${totalStations}`);
        console.log(`📍 Municipalities with Stations: ${totalAreas}/${totalMunicipalities}`);
        console.log(`📊 Average hasStation Coverage: ${avgCoverage.toFixed(1)}%`);
        console.log('═'.repeat(80));

        // Save detailed report
        fs.writeFileSync(
            path.join(process.cwd(), 'station_integration_final_report.json'),
            JSON.stringify({
                timestamp: new Date().toISOString(),
                summary: {
                    totalStations,
                    totalAreas,
                    totalMunicipalities,
                    avgCoverage
                },
                details: results
            }, null, 2)
        );

        console.log('\n✨ Station metadata integration complete!\n');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();
