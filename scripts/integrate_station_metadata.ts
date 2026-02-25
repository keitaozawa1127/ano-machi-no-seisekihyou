import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { geoContains } from 'd3-geo';

/**
 * Station Metadata Integration Script
 * Fetches station data and integrates into existing GeoJSON files
 */

interface Station {
    name: string;
    line: string;
    lon: number;
    lat: number;
}

const PREFECTURE_NAMES: { [key: string]: string } = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県'
};

async function fetchStationsForPrefecture(prefName: string): Promise<Station[]> {
    try {
        const url = `https://express.heartrails.com/api/json?method=getStations&prefecture=${encodeURIComponent(prefName)}`;
        console.log(`    Fetching from: ${url}`);

        const response = await fetch(url);
        const data: any = await response.json();

        if (data.response && data.response.station) {
            const stations = data.response.station.map((s: any) => ({
                name: s.name,
                line: s.line,
                lon: parseFloat(s.x),
                lat: parseFloat(s.y)
            }));
            console.log(`    ✓ Received ${stations.length} stations`);
            return stations;
        }

        console.log(`    ⚠️  No station data in response`);
        return [];
    } catch (error) {
        console.error(`    ❌ Error fetching stations:`, error);
        return [];
    }
}

function integrateStationMetadata(geoData: any, stations: Station[]): number {
    let totalStations = 0;

    geoData.features.forEach((feature: any) => {
        const stationsInArea: Station[] = [];
        const uniqueLines = new Set<string>();

        stations.forEach(station => {
            try {
                // const point = { type: 'Point', coordinates: [station.lon, station.lat] };
                if (geoContains(feature, [station.lon, station.lat])) {
                    stationsInArea.push(station);
                    uniqueLines.add(station.line);
                }
            } catch (e) {
                // Skip invalid geometries
            }
        });

        // Enhanced metadata
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

        totalStations += stationsInArea.length;
    });

    return totalStations;
}

async function processFile(filePath: string) {
    const prefCode = path.basename(filePath, '.json');
    const prefName = PREFECTURE_NAMES[prefCode];

    console.log(`\n📍 ${prefCode} - ${prefName}`);

    // Load GeoJSON
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Fetch stations
    console.log(`  🚉 Fetching station data...`);
    const stations = await fetchStationsForPrefecture(prefName);

    if (stations.length === 0) {
        console.log(`  ⚠️  No stations found - skipping metadata integration`);
        return { prefCode, prefName, stations: 0, areas: 0 };
    }

    // Integrate metadata
    console.log(`  🔧 Integrating metadata...`);
    const totalStations = integrateStationMetadata(data, stations);
    const stationAreas = data.features.filter((f: any) => f.properties.hasStation).length;

    // Save
    fs.writeFileSync(filePath, JSON.stringify(data));

    console.log(`  ✅ Complete: ${totalStations} stations in ${stationAreas} municipalities`);

    return { prefCode, prefName, stations: totalStations, areas: stationAreas };
}

async function processAllPrefectures() {
    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
        .filter(f => f.match(/^\d{2}\.json$/))
        .sort()
        .map(f => path.join(dataDir, f));

    console.log('\n🚉 Station Metadata Integration');
    console.log('═'.repeat(80));
    console.log(`Processing ${files.length} prefectures\n`);

    const results = [];
    for (const file of files) {
        const result = await processFile(file);
        results.push(result);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n\n📊 INTEGRATION SUMMARY');
    console.log('═'.repeat(80));

    const totalStations = results.reduce((sum, r) => sum + r.stations, 0);
    const totalAreas = results.reduce((sum, r) => sum + r.areas, 0);
    const successfulPrefs = results.filter(r => r.stations > 0).length;

    console.log(`✅ Prefectures Processed: ${results.length}/47`);
    console.log(`🚉 Total Stations: ${totalStations}`);
    console.log(`📍 Station Areas: ${totalAreas} municipalities`);
    console.log(`✓  Successful: ${successfulPrefs}/47 prefectures`);
    console.log('═'.repeat(80));

    // Save report
    fs.writeFileSync(
        path.join(process.cwd(), 'station_integration_report.json'),
        JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
    );

    console.log('\n✨ Station metadata integration complete!\n');
}

processAllPrefectures().catch(console.error);
