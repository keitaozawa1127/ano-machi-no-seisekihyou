import fs from 'fs';
import path from 'path';
import { geoContains } from 'd3-geo';

/**
 * Terminal test: Verify cityStationLookup logic returns 8 for Yamato City
 */

const geoPath = path.join(process.cwd(), 'public/data/14.json');
const masterPath = path.join(process.cwd(), 'src/data/station_master.json');

const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf-8'));
const stationMaster = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));

console.log('\n🧪 TESTING CITY LOOKUP LOGIC (Terminal)\n');
console.log('═'.repeat(80));

// Build city lookup exactly as InteractiveMap.tsx does
const cityLookup = new Map<string, { count: number; stations: any[] }>();
const prefStations = Object.values(stationMaster).filter((s: any) => s.prefCode === '14');

console.log(`📊 Total stations in Kanagawa: ${prefStations.length}`);

geoData.features.forEach((feature: any) => {
    const cityName = feature.properties?.N03_004 || feature.properties?.N03_003;
    if (!cityName) return;

    const stationsInCity: any[] = [];
    prefStations.forEach((station: any) => {
        try {
            if (geoContains(feature, station.coordinates)) {
                stationsInCity.push(station);
            }
        } catch (e) { }
    });

    cityLookup.set(cityName, { count: stationsInCity.length, stations: stationsInCity });
});

console.log(`\n🗺️  Cities mapped: ${cityLookup.size}`);
console.log('═'.repeat(80));

// Test Yamato City specifically
const yamatoData = cityLookup.get('大和市');
console.log('\n🎯 YAMATO CITY TEST RESULT:');
console.log(`   cityStationLookup.get("大和市")?.count = ${yamatoData?.count}`);
console.log(`   Station names: ${yamatoData?.stations.map(s => s.name).join(', ')}`);

console.log('\n═'.repeat(80));
if (yamatoData?.count === 8) {
    console.log('✅ SUCCESS: Yamato City returns 8 stations');
} else {
    console.log(`❌ FAILURE: Expected 8, got ${yamatoData?.count}`);
}
console.log('═'.repeat(80) + '\n');
