const fs = require('fs');
const path = require('path');

// CONFIG (KOTONI)
const STATION = { name: "琴似", lat: 43.0784, lon: 141.3069, prefCode: "01" };
const YEARS = [2024, 2023, 2022, 2021, 2020];
const RADIUS_KM = 2.0;

// PATHS
const CACHE_DIR = path.join(__dirname, '../data/cache');
const DISTRICT_COORDS_FILE = path.join(__dirname, '../data/district_coords.json');
const GEOCODE_CACHE_FILE = path.join(__dirname, '../data/cache/geocode_cache.json');

// LOAD DATA
let districtCoords = {};
try {
    if (fs.existsSync(DISTRICT_COORDS_FILE)) {
        districtCoords = JSON.parse(fs.readFileSync(DISTRICT_COORDS_FILE, 'utf-8'));
        console.log("Loaded district_coords.json");
    }
} catch (e) { console.warn("Failed to load district_coords"); }

let geocodeCache = {};
try {
    if (fs.existsSync(GEOCODE_CACHE_FILE)) {
        geocodeCache = JSON.parse(fs.readFileSync(GEOCODE_CACHE_FILE, 'utf-8'));
        console.log("Loaded geocode_cache.json: " + Object.keys(geocodeCache).length + " entries");
    }
} catch (e) { console.warn("Failed to load geocode_cache"); }

// UTILS
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getDistrictCoord(prefecture, municipality, district) {
    const cacheKey = `${prefecture}-${municipality}-${district}`;
    if (geocodeCache[cacheKey]) return geocodeCache[cacheKey];

    const prefData = districtCoords[prefecture]; // 北海道
    if (prefData) {
        let muniData = prefData[municipality]; // 札幌市西区
        if (!muniData) {
            for (const key in prefData) {
                if (municipality.includes(key) || key.includes(municipality)) {
                    muniData = prefData[key];
                    break;
                }
            }
        }

        if (muniData) {
            if (muniData[district]) return muniData[district];
            for (const key in muniData) {
                if (district.startsWith(key)) return muniData[key];
            }
        }
    }
    return null;
}

function main() {
    let allTxs = [];
    const prefectureName = "北海道";

    console.log(`Analyzing ${STATION.name} (Radius ${RADIUS_KM}km) Coords: ${STATION.lat}, ${STATION.lon}`);

    for (const year of YEARS) {
        const file = path.join(CACHE_DIR, `${STATION.prefCode}_${year}.json`);
        if (!fs.existsSync(file)) {
            console.log(`Skipping ${year}: File not found`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

        let matched = 0;
        let coordFound = 0;
        let distMatch = 0;

        data.forEach(t => {
            const type = t.Type || "";
            if (!type.includes("中古マンション等") && !type.includes("宅地(土地と建物)")) return;

            // Debug: Log if Kotoni
            // if (t.DistrictName && t.DistrictName.includes("琴似")) {
            //      console.log(`Debug: ${t.Municipality} ${t.DistrictName} -> ${getDistrictCoord(prefectureName, t.Municipality, t.DistrictName) ? 'Found' : 'Missing'}`);
            // }

            const coord = getDistrictCoord(prefectureName, t.Municipality, t.DistrictName);
            if (coord) {
                coordFound++;
                const dist = getDistance(STATION.lat, STATION.lon, coord.lat, coord.lon);
                if (dist <= RADIUS_KM) {
                    if (t.TradePrice && !isNaN(parseInt(t.TradePrice))) {
                        allTxs.push(t);
                        matched++;
                        distMatch++;
                    }
                }
            }
        });
        console.log(`[${year}] Total:${data.length} -> CoordFound:${coordFound} -> DistMatch:${matched}`);
    }

    // Calculate Median
    const prices = allTxs.map(t => parseInt(t.TradePrice)).sort((a, b) => a - b);
    let validPrices = prices;
    if (prices.length >= 10) {
        const cut = Math.floor(prices.length * 0.05);
        validPrices = prices.slice(cut, prices.length - cut);
    }

    let median = 0;
    if (validPrices.length > 0) {
        const mid = Math.floor(validPrices.length / 2);
        if (validPrices.length % 2 !== 0) {
            median = validPrices[mid];
        } else {
            median = (validPrices[mid - 1] + validPrices[mid]) / 2;
        }
    }

    console.log(`\n=== RESULT FOR ${STATION.name} STATION ===`);
    console.log(`Tx Count (5y): ${allTxs.length}`);
    console.log(`Median Price : ${Math.round(median).toLocaleString()} Yen`);
    console.log(`             : ${Math.round(median / 10000)} Man Yen`);
}

main();

export {};
