const fs = require('fs');
const path = require('path');

// CONFIG
const STATION = { name: "東京", lat: 35.6812, lon: 139.7640, prefCode: "13" };
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

function normalizeStation(s) {
    if (!s) return "";
    return s.replace(/[ \u3000]/g, '').replace(/駅$/, '').trim();
}

function getDistrictCoord(prefecture, municipality, district) {
    // 1. Check Geocode Cache (Exact Match)
    const cacheKey = `${prefecture}-${municipality}-${district}`;
    if (geocodeCache[cacheKey]) {
        return geocodeCache[cacheKey];
    }

    // 2. Check District Coords (Static Master)
    const prefData = districtCoords[prefecture];
    if (prefData) {
        let muniData = prefData[municipality];
        if (!muniData) {
            // Fuzzy Match Muni
            for (const key in prefData) {
                if (municipality.includes(key) || key.includes(municipality)) {
                    muniData = prefData[key];
                    break;
                }
            }
        }

        if (muniData) {
            // Exact Match District
            if (muniData[district]) return muniData[district];

            // StartsWith Match (e.g. "丸の内１丁目" -> "丸の内")
            for (const key in muniData) {
                if (district.startsWith(key)) {
                    return muniData[key];
                }
            }
        }
    }

    return null;
}

function main() {
    let allTxs = [];
    const prefectureName = "東京都"; // Hardcoded for this script

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
        let aliasMatch = 0;
        let failedStats = {};

        data.forEach(t => {
            // Type Filter
            const type = t.Type || "";
            if (!type.includes("中古マンション等") && !type.includes("宅地(土地と建物)")) {
                return;
            }

            let isMatch = false;

            // A. Get Coords
            const coord = getDistrictCoord(prefectureName, t.Municipality, t.DistrictName);

            if (coord) {
                coordFound++;
                const dist = getDistance(STATION.lat, STATION.lon, coord.lat, coord.lon);
                if (dist <= RADIUS_KM) {
                    distMatch++;
                    isMatch = true;
                }
            } else {
                // Log failure reason (Top 5)
                const key = `${t.Municipality} ${t.DistrictName}`;
                failedStats[key] = (failedStats[key] || 0) + 1;

                // B. Alias Fallback (ONLY if coords missing, per diagnosisHelpers.ts logic)
                // Note: The original logic says "if !districtCoord return false" when stationCoords are present.
                // Tokyo Station DOES have coords. So alias fallback is NOT used?
                // Wait, diagnosisHelpers.ts:
                // if (stationCoords) { ... if (!districtCoord) return false; ... }
                // So if coord is missing, it returns false immediately!
                // It does NOT fall back to alias match if stationCoords are known.
                // This means missing coords = missing data.
            }

            if (isMatch) {
                if (t.TradePrice && !isNaN(parseInt(t.TradePrice))) {
                    allTxs.push(t);
                    matched++;
                }
            }
        });

        console.log(`[${year}] Total:${data.length} -> CoordFound:${coordFound} -> DistMatch:${distMatch} -> Final(incl. price):${matched}`);

        // Show Top 5 Missing Coords
        const sortedFailures = Object.entries(failedStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (sortedFailures.length > 0) {
            console.log(`   Top Missing Coords: ${sortedFailures.map(e => `${e[0]}(${e[1]})`).join(', ')}`);
        }
    }

    console.log(`\nTotal Matched Transactions: ${allTxs.length}`);

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

    console.log(`\n=== RESULT FOR TOKYO STATION ===`);
    console.log(`Tx Count (5y): ${allTxs.length}`);
    console.log(`Median Price : ${Math.round(median).toLocaleString()} Yen`);
    console.log(`             : ${Math.round(median / 10000)} Man Yen`);
}

main();

export {};
