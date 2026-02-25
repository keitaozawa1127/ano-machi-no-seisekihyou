// @ts-nocheck
import fs from 'fs';
import path from 'path';

/**
 * Remove stationCount from all GeoJSON files
 * Forces 100% reliance on cityStationLookup
 */

const dataDir = path.join(process.cwd(), 'public/data');
const files = fs.readdirSync(dataDir).filter(f => f.match(/^\d{2}\.json$/));

console.log('\n🗑️  REMOVING STATIC STATION COUNTS FROM ALL GEOJSON FILES\n');
console.log('═'.repeat(80));

let totalFiles = 0;
let totalFeatures = 0;

files.forEach(file => {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    let removedCount = 0;
    data.features.forEach((feature: any) => {
        if (feature.properties) {
            if ('stationCount' in feature.properties) {
                delete feature.properties.stationCount;
                removedCount++;
            }
            if ('railwayLineCount' in feature.properties) {
                delete feature.properties.railwayLineCount;
            }
            if ('hasStation' in feature.properties) {
                delete feature.properties.hasStation;
            }
            if ('densityTier' in feature.properties) {
                delete feature.properties.densityTier;
            }
        }
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 0));

    if (removedCount > 0) {
        console.log(`✅ ${file}: Removed static counts from ${removedCount} features`);
        totalFiles++;
        totalFeatures += removedCount;
    }
});

console.log('═'.repeat(80));
console.log(`\n✨ Cleanup complete!`);
console.log(`   Files processed: ${totalFiles}`);
console.log(`   Features cleaned: ${totalFeatures}`);
console.log(`\n🎯 All GeoJSON files now rely 100% on cityStationLookup\n`);
