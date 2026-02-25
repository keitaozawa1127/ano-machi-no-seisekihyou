
const fs = require('fs');
const path = require('path');

// CONFIG
const TARGETS = [
    { name: '大橋', prefCode: '40', prefName: '福岡県', lat: 33.5594, lon: 130.4276 },
    { name: '琴似', prefCode: '01', prefName: '北海道', lat: 43.0784, lon: 141.3069 }, // JR琴似
    { name: '熊本', prefCode: '43', prefName: '熊本県', lat: 32.7896, lon: 130.6896 }
];

const DISTRICT_COORDS_FILE = path.join(__dirname, '../data/district_coords.json');
const CACHE_DIR = path.join(__dirname, '../data/cache/');
const LOG_FILE = path.join(__dirname, 'debug_output_safe.txt');

let logBuffer = '';
function log(msg) {
    console.log(msg);
    logBuffer += msg + '\n';
}

console.log('Loading district_coords.json from', DISTRICT_COORDS_FILE);
let districtCoords = {};
try {
    districtCoords = JSON.parse(fs.readFileSync(DISTRICT_COORDS_FILE, 'utf-8'));
    console.log(`Loaded coords for ${Object.keys(districtCoords).length} prefectures`);
} catch (e) {
    console.error('Failed to load district_coords:', e.message);
    process.exit(1);
}

// Mock getDistrictCoords
function getDistrictCoords(prefecture, municipality, district) {
    if (!district || !prefecture) return null;
    const prefData = districtCoords[prefecture];
    if (prefData) {
        for (const muniKey of Object.keys(prefData)) {
            if (municipality && municipality.includes(muniKey)) {
                const districts = prefData[muniKey];
                if (districts[district]) {
                    return districts[district];
                }
            }
        }
    }
    return null;
}

// Mock Geo Utils
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Main Debug Logic
TARGETS.forEach(target => {
    console.log(`\n=== DEBUG TARGET: ${target.name} (${target.prefName}) ===`);

    // Use target coords
    let stationLat = target.lat;
    let stationLon = target.lon;

    console.log(`Station Coords: ${stationLat}, ${stationLon}`);

    // Load Cache
    const cacheFile = path.join(CACHE_DIR, `${target.prefCode}_2024.json`);
    let data = [];
    try {
        if (fs.existsSync(cacheFile)) {
            data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            log(`Loaded ${data.length} txs from ${cacheFile}`);
        } else {
            log(`Cache file not found: ${cacheFile}`);
            return;
        }
    } catch (e) { console.log('Error loading cache:', e.message); return; }


    // Debug keys
    log(`Top keys: ${JSON.stringify(Object.keys(districtCoords))}`);
    const kData = districtCoords['神奈川県'];
    if (kData) {
        log(`Kanagawa keys: ${JSON.stringify(Object.keys(kData))}`);
    } else {
        log('Kanagawa data MISSING in district_coords');
    }

    let countInMuni = 0;
    let countCoordsFound = 0;
    let countDistanceOk = 0;

    // Sample fails
    let sampleMuniFail = [];
    let sampleCoordsFail = [];

    data.forEach((tx) => {
        const muni = tx.Municipality;
        const dist = tx.DistrictName;

        // Check Municipality Match
        let muniMatch = false;
        const prefData = districtCoords[target.prefName];
        if (prefData) {
            for (const mk of Object.keys(prefData)) {
                if (muni && muni.includes(mk)) { muniMatch = true; break; }
            }
        }

        if (muniMatch) {
            countInMuni++;
            const coords = getDistrictCoords(target.prefName, muni, dist);
            if (coords) {
                countCoordsFound++;
                const d = calcDistance(stationLat, stationLon, coords.lat, coords.lon);

                // Debug typical distance
                if (countCoordsFound <= 3) {
                    log(`[SAMPLE] ${muni} ${dist} -> dist=${d.toFixed(2)}km`);
                }

                if (d <= 2.0) {
                    countDistanceOk++;
                }
            } else {
                if (sampleCoordsFail.length < 5) sampleCoordsFail.push(`${muni} ${dist}`);
            }
        } else {
            if (sampleMuniFail.length < 3 && muni) {
                const buf = Buffer.from(muni);
                sampleMuniFail.push(`${muni} [HEX:${buf.toString('hex')}]`);
            }
        }
    });


    log(`Stats for ${target.name}:`);
    log(`  Total Txs: ${data.length}`);
    log(`  Muni Match: ${countInMuni}`);
    if (sampleMuniFail.length > 0) log(`  (Sample Muni Fail: ${sampleMuniFail.join(', ')})`);
    log(`  Coords Found: ${countCoordsFound}`);
    if (sampleCoordsFail.length > 0) log(`  (Sample Coords Fail: ${sampleCoordsFail.join(', ')})`);
    log(`  Distance OK (<=2km): ${countDistanceOk}`);
});

fs.writeFileSync(LOG_FILE, logBuffer, 'utf-8');
console.log('Log saved to', LOG_FILE);
