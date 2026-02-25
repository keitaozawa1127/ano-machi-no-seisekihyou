import fs from 'fs';
import path from 'path';
import { geoContains } from 'd3-geo';

// Load Tokyo data and station master
const tokyoPath = path.join(process.cwd(), 'public/data/13.json');
const stationMasterPath = path.join(process.cwd(), 'src/data/station_master.json');

const tokyoData = JSON.parse(fs.readFileSync(tokyoPath, 'utf-8'));
const stationMaster = JSON.parse(fs.readFileSync(stationMasterPath, 'utf-8'));

console.log('🔍 Debugging Tokyo Station Integration\n');
console.log(`Tokyo GeoJSON features: ${tokyoData.features.length}`);
console.log(`First feature type: ${tokyoData.features[0].geometry.type}`);
console.log(`First feature properties:`, tokyoData.features[0].properties);

// Get Tokyo stations
const tokyoStations = Object.values(stationMaster).filter((s: any) => s.prefCode === '13');
console.log(`\nTokyo stations in master: ${tokyoStations.length}`);

if (tokyoStations.length > 0) {
    const firstStation: any = tokyoStations[0];
    console.log(`\nFirst station:`, {
        name: firstStation.name,
        coordinates: firstStation.coordinates,
        lines: firstStation.lines.slice(0, 2)
    });

    // Test Point-in-Polygon
    console.log(`\n🧪 Testing geoContains...`);

    let foundIn = -1;
    for (let i = 0; i < tokyoData.features.length; i++) {
        try {
            if (geoContains(tokyoData.features[i], firstStation.coordinates)) {
                foundIn = i;
                console.log(`✓ Station "${firstStation.name}" found in feature ${i}`);
                console.log(`  Municipality: ${tokyoData.features[i].properties.N03_004 || tokyoData.features[i].properties.N03_003}`);
                break;
            }
        } catch (e) {
            console.log(`✗ Error on feature ${i}:`, (e as Error).message);
            if (i === 0) {
                console.log(`  Geometry:`, JSON.stringify(tokyoData.features[i].geometry).substring(0, 200));
            }
        }
    }

    if (foundIn === -1) {
        console.log(`✗ Station not found in any feature`);
        console.log(`\nChecking coordinate ranges...`);

        // Check if coordinates are in reasonable range
        const [lon, lat] = firstStation.coordinates;
        console.log(`Station coords: [${lon}, ${lat}]`);

        // Sample a few features to see their bounds
        for (let i = 0; i < Math.min(3, tokyoData.features.length); i++) {
            const feature = tokyoData.features[i];
            console.log(`\nFeature ${i} (${feature.properties.N03_004 || feature.properties.N03_003}):`);
            console.log(`  Type: ${feature.geometry.type}`);

            if (feature.geometry.type === 'Polygon') {
                const coords = feature.geometry.coordinates[0];
                const lons = coords.map((c: number[]) => c[0]);
                const lats = coords.map((c: number[]) => c[1]);
                console.log(`  Lon range: [${Math.min(...lons).toFixed(3)}, ${Math.max(...lons).toFixed(3)}]`);
                console.log(`  Lat range: [${Math.min(...lats).toFixed(3)}, ${Math.max(...lats).toFixed(3)}]`);
            }
        }
    }
}
