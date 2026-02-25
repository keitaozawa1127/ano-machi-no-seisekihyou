import fs from 'fs';
import path from 'path';
import { PREFECTURES } from './constants';
import { fetchExtendedMetrics, ExtendedMetrics } from './mlitApi';
import { calcDistance, isInBoundingBox, Coordinates } from './geoUtils';
import { preloadDistrictCoordinates, filterTransactionsByLocation, StationCoords } from './diagnosisHelpers';

console.log("HELLO FROM MLIT SERVICE TS (UPDATED WITH CACHE)");

const API_KEY = process.env.MLIT_API_KEY;
const BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001";
const IS_VERCEL = process.env.VERCEL === "1";
const CACHE_DIR = IS_VERCEL ? '/tmp/cache' : path.join(process.cwd(), 'data', 'cache');
const CACHE_DIAG_DIR = path.join(CACHE_DIR, 'diagnosis');
const CACHE_GEO_FILE = path.join(CACHE_DIR, 'station_coords.json');
const POPULATION_DATA_FILE = path.join(process.cwd(), 'data', 'population_projection.json');

let populationDataCache: any = null;

try {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(CACHE_DIAG_DIR)) {
        fs.mkdirSync(CACHE_DIAG_DIR, { recursive: true });
    }
} catch (e) {
    console.warn("[CACHE] Could not create cache directories:", e);
}

export type Transaction = {
    Type: string;
    DistrictName: string;
    Municipality?: string;
    TradePrice: string;
    Period?: string;
    NearestStation?: string;
    PriceCategory?: string;
};

export type StationMetric = {
    name: string;
    count: number;
    lastPrice: number;
};



const HARDCODED_KEY = "2001ce8821b5494fbd7b8fdb4f974313";

export async function fetchMlitData(year: number, areaCode: string): Promise<Transaction[]> {
    const API_KEY = process.env.MLIT_API_KEY || HARDCODED_KEY;

    if (!API_KEY) {
        console.error("[MLIT API] Error: API_KEY is missing");
        return [];
    }

    const cacheFile = path.join(CACHE_DIR, `${areaCode}_${year}.json`);

    if (fs.existsSync(cacheFile)) {
        try { return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch { }
    }

    const url = `${BASE_URL}?year=${year}&area=${areaCode}`;
    const headers = { "Ocp-Apim-Subscription-Key": API_KEY };
    console.log(`[MLIT API] Request: GET ${url}`);

    try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const json = await res.json();
        if (json.status !== "OK") throw new Error(`API Status: ${json.status}`);

        if (json.data) {
            fs.writeFileSync(cacheFile, JSON.stringify(json.data));
            return json.data;
        } else {
            console.warn(`[MLIT API] Zero results`);
            fs.writeFileSync(cacheFile, JSON.stringify([]));
            return [];
        }
    } catch (e: any) {
        throw e;
    }
}

export async function getStationList(prefCode: string) {
    console.log(`[StationList] Fetching for PrefCode: ${prefCode}`);
    const pref = PREFECTURES.find(p => p.code === prefCode);
    if (!pref) return [];

    try {
        const linesUrl = `https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(pref.name)}`;
        const linesRes = await fetch(linesUrl, { next: { revalidate: 86400 } });
        if (!linesRes.ok) throw new Error(`API Error`);
        const linesJson = await linesRes.json();
        if (!linesJson.response || !linesJson.response.line) return [];

        const lines: string[] = linesJson.response.line;
        const allStations: any[] = [];

        for (const line of lines) {
            const stUrl = `https://express.heartrails.com/api/json?method=getStations&line=${encodeURIComponent(line)}`;
            const stRes = await fetch(stUrl, { next: { revalidate: 86400 } });
            if (stRes.ok) {
                const stJson = await stRes.json();
                if (stJson.response?.station) allStations.push(...stJson.response.station);
            }
        }

        const uniqueNames = Array.from(new Set(allStations.map(s => s.name)));
        return uniqueNames.map(name => ({ name: name as string, count: 0 }));
    } catch (e: any) {
        return [];
    }
}

function normalizeStation(s: string): string {
    if (!s) return "";
    return s.replace(/[ 　]/g, '').replace(/駅$/, '').trim();
}

const STATION_ALIASES: Record<string, string[]> = {
    "梅田": ["大阪", "東梅田", "西梅田", "北新地", "芝田", "茶屋町", "角田町", "大深町"],
    "川崎": ["京急川崎"],
    "札幌": ["さっぽろ"],
    "仙台": ["あおば通"],
    "博多": ["祇園"],
    "天王寺": ["大阪阿部野橋"],
    "武蔵小杉": ["小杉", "小杉町", "新丸子", "中丸子", "市ノ坪", "木月", "下沼部", "上平間"],
    "渋谷": ["宇田川", "道玄坂", "円山町", "神南", "桜丘町"],
    "新宿": ["西新宿", "歌舞伎町", "百人町", "北新宿", "新宿"]
};

export async function getStationLines(stationName: string) {
    try {
        const url = `https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(stationName)}`;
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return [];
        const json = await res.json();
        const stations = json.response?.station;
        if (!stations || !Array.isArray(stations)) return [];

        const lines = new Set<string>();
        stations.forEach(s => {
            if (s.line) lines.add(s.line);
        });

        return Array.from(lines).map(line => ({ name: line }));
    } catch {
        return [];
    }
}

let coordsCache: Record<string, any> = {};

function loadCoordsCache() {
    if (Object.keys(coordsCache).length > 0) return;
    try { if (fs.existsSync(CACHE_GEO_FILE)) coordsCache = JSON.parse(fs.readFileSync(CACHE_GEO_FILE, 'utf-8')); } catch { }
}

function saveCoordsCache() {
    try { fs.writeFileSync(CACHE_GEO_FILE, JSON.stringify(coordsCache, null, 2)); } catch { }
}

export async function getStationCoords(stationName: string): Promise<StationCoords | null> {
    loadCoordsCache();
    if (coordsCache[stationName]) return coordsCache[stationName];

    try {
        const url = `https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(stationName)}`;
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;

        const json = await res.json();
        const stations = json.response?.station;
        if (!stations || !Array.isArray(stations) || stations.length === 0) return null;

        const station = stations[0];
        const coords = { lat: parseFloat(station.y), lon: parseFloat(station.x), name: station.name };

        coordsCache[stationName] = coords;
        saveCoordsCache();
        return coords;
    } catch {
        return null;
    }
}

const DISTRICT_COORDS_FILE = path.join(process.cwd(), 'data', 'district_coords.json');
const GEOCODE_CACHE_FILE = path.join(CACHE_DIR, 'geocode_cache.json');

let districtCoords: any = {};
let geocodeCache: any = {};

function loadDistrictCoords() {
    if (Object.keys(districtCoords).length > 0) return;
    try { if (fs.existsSync(DISTRICT_COORDS_FILE)) districtCoords = JSON.parse(fs.readFileSync(DISTRICT_COORDS_FILE, 'utf-8')); } catch { }
}

const geocodePromiseCache: Record<string, Promise<any>> = {};

async function geocodeDistrict(prefecture: string, municipality: string, district: string): Promise<Coordinates | null> {
    if (!prefecture || !municipality || !district) return null;

    const cacheKey = `${prefecture}_${municipality}`;

    // Return the requested district if found in memory (previously loaded)
    if (districtCoords[prefecture]?.[municipality]?.[district]) {
        return districtCoords[prefecture][municipality][district];
    }

    try {
        if (!geocodePromiseCache[cacheKey]) {
            geocodePromiseCache[cacheKey] = (async () => {
                // Fetch all towns in the municipality at once using HeartRails Geo API
                const url = `https://geoapi.heartrails.com/api/json?method=getTowns&prefecture=${encodeURIComponent(prefecture)}&city=${encodeURIComponent(municipality)}`;
                console.log(`[GEOCODE] Fetching towns for ${prefecture} ${municipality}`);

                const res = await fetch(url, { next: { revalidate: 86400 * 7 } }); // Cache for 7 days
                if (!res.ok) return null;

                const json = await res.json();
                const locations = json.response?.location;

                if (locations && Array.isArray(locations)) {
                    // Initialize prefecture and municipality in districtCoords if not present
                    if (!districtCoords[prefecture]) districtCoords[prefecture] = {};
                    if (!districtCoords[prefecture][municipality]) districtCoords[prefecture][municipality] = {};

                    // Cache all towns for this municipality
                    locations.forEach((loc: any) => {
                        const townName = loc.town;
                        districtCoords[prefecture][municipality][townName] = {
                            lat: parseFloat(loc.y),
                            lon: parseFloat(loc.x)
                        };
                    });

                    // Save to local cache file
                    try {
                        fs.writeFileSync(DISTRICT_COORDS_FILE, JSON.stringify(districtCoords, null, 2));
                    } catch (e) {
                        console.error("[GEOCODE] Failed to write cache file", e);
                    }
                    return locations;
                }
                return null;
            })();
        }

        // Wait for the actual fetch to complete if it was ongoing by another parallel request
        await geocodePromiseCache[cacheKey];

        if (districtCoords[prefecture]?.[municipality]) {
            // Return the requested district if found
            if (districtCoords[prefecture][municipality][district]) {
                return districtCoords[prefecture][municipality][district];
            }

            const partialMatch = Object.keys(districtCoords[prefecture][municipality]).find(t => district.includes(t) || t.includes(district));
            if (partialMatch) {
                return districtCoords[prefecture][municipality][partialMatch];
            }
        }
    } catch (e) {
        console.error(`[GEOCODE] Error geocoding ${municipality}`, e);
    }
    return null;
}

export async function getDistrictCoords(prefecture: string, municipality: string, district: string): Promise<Coordinates | null> {
    if (!district || !prefecture) return null;
    loadDistrictCoords();
    const prefData = districtCoords[prefecture];
    if (prefData) {
        for (const muniKey of Object.keys(prefData)) {
            if (municipality && municipality.includes(muniKey)) {
                if (prefData[muniKey][district]) return prefData[muniKey][district];
            }
        }
    }
    return await geocodeDistrict(prefecture, municipality, district);
}

function loadPopulationData() {
    if (populationDataCache) return;
    try {
        if (fs.existsSync(POPULATION_DATA_FILE)) {
            populationDataCache = JSON.parse(fs.readFileSync(POPULATION_DATA_FILE, 'utf-8'));
        } else {
            populationDataCache = {};
        }
    } catch {
        populationDataCache = {};
    }
}

export function getCityPopulationProjection(prefecture: string, municipality: string) {
    loadPopulationData();
    if (!populationDataCache) return null;

    const strictKey = `${prefecture}_${municipality}`;
    if (populationDataCache[strictKey]) {
        const d = populationDataCache[strictKey];
        d._metadata = populationDataCache._metadata;
        return d;
    }

    // fallback: check by municipality name only (for backwards compatibility if needed)
    if (populationDataCache[municipality]) {
        const d = populationDataCache[municipality];
        if (d.prefecture === prefecture) {
            d._metadata = populationDataCache._metadata;
            return d;
        }
    }

    for (const key of Object.keys(populationDataCache)) {
        if (key === '_metadata') continue;
        const cityData = populationDataCache[key];
        if (cityData.prefecture === prefecture && (municipality.includes(cityData.city) || cityData.city.includes(municipality))) {
            cityData._metadata = populationDataCache._metadata;
            return cityData;
        }
    }

    // If no matching city is found in the official data, return null instead of generating random dummy data
    return null;
}

const STRICT_CITY_FILTER: Record<string, string> = {
    "梅田": "大阪市北区",
    "博多": "福岡市博多区",
    "札幌": "札幌市北区",
    "仙台": "仙台市青葉区",
    "名古屋": "名古屋市中村区",
    "川崎": "川崎市川崎区",
    "横浜": "横浜市西区",
    "武蔵小杉": "川崎市中原区"
};

export async function getStationDiagnosis(stationName: string, prefCode: string) {
    const currentYear = new Date().getFullYear();
    const LIMIT_YEAR = currentYear - 15;
    let latestDataYear = 0;
    let reliableDataYear = 0;

    const targetNorm = normalizeStation(stationName);
    const matchTargets = [targetNorm];
    if (STATION_ALIASES[targetNorm]) matchTargets.push(...STATION_ALIASES[targetNorm].map(normalizeStation));
    const requiredCity = STRICT_CITY_FILTER[targetNorm] || "";

    const stationCoords = await getStationCoords(stationName);
    const RADIUS_KM = 2.0;
    const pref = PREFECTURES.find(p => p.code === prefCode);
    const prefectureName = pref ? pref.name : "";

    const targetYearsToTry = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

    // 1-Pass Parallel Algorithm for Fetching and Filtering
    const yearPromises = targetYearsToTry.map(async (testYear) => {
        try {
            const data = await fetchMlitData(testYear, prefCode);
            const coordsMap = stationCoords ? await preloadDistrictCoordinates(data, prefectureName, getDistrictCoords as any) : new Map();
            const yearTxs = filterTransactionsByLocation(data, stationName, stationCoords, RADIUS_KM, coordsMap, matchTargets, requiredCity);
            return { y: testYear, yearTxs };
        } catch (e: any) {
            return { y: testYear, yearTxs: [] };
        }
    });

    const results = await Promise.all(yearPromises);

    // Filter valid results and find latest
    const validResults = results.filter(r => r.yearTxs.length > 0);
    validResults.sort((a, b) => b.y - a.y); // Descending

    if (validResults.length === 0) {
        throw new Error(`直近5年間にデータが見つかりませんでした (${stationName})`);
    }

    latestDataYear = validResults[0].y;
    reliableDataYear = latestDataYear;

    const metrics: StationMetric[] = [];
    const allRawTxs: Transaction[] = [];

    // Sort ascending to build charts chronologically
    validResults.sort((a, b) => a.y - b.y);

    for (const res of validResults) {
        const { y, yearTxs } = res;
        if (yearTxs.length > 0) {
            const prices = yearTxs.map(t => parseInt(t.TradePrice)).filter(p => !isNaN(p));
            prices.sort((a, b) => a - b);
            let validPrices = prices;
            if (prices.length >= 10) {
                const cut = Math.floor(prices.length * 0.05);
                validPrices = prices.slice(cut, prices.length - cut);
            }
            let median = 0;
            if (validPrices.length > 0) {
                const mid = Math.floor(validPrices.length / 2);
                median = validPrices.length % 2 !== 0 ? validPrices[mid] : (validPrices[mid - 1] + validPrices[mid]) / 2;
            }
            metrics.push({ name: `${y}年`, count: yearTxs.length, lastPrice: Math.round(median) });
            allRawTxs.push(...yearTxs);
        }
    }

    const totalPrices = allRawTxs.map(t => parseInt(t.TradePrice)).filter(p => !isNaN(p));
    totalPrices.sort((a, b) => a - b);
    let globalMedian = 0;
    if (totalPrices.length > 0) {
        let validGlobal = totalPrices;
        if (totalPrices.length >= 10) {
            const cut = Math.floor(totalPrices.length * 0.05);
            validGlobal = totalPrices.slice(cut, totalPrices.length - cut);
        }
        const mid = Math.floor(validGlobal.length / 2);
        globalMedian = validGlobal.length % 2 !== 0 ? validGlobal[mid] : (validGlobal[mid - 1] + validGlobal[mid]) / 2;
    }
    globalMedian = Math.round(globalMedian);

    const priceCurrent = metrics.find(m => parseInt(m.name) === reliableDataYear)?.lastPrice || 0;
    const pricePrev = metrics.find(m => parseInt(m.name) === reliableDataYear - 1)?.lastPrice || 0;
    const price2Ago = metrics.find(m => parseInt(m.name) === reliableDataYear - 2)?.lastPrice || 0;

    const yoy = (pricePrev > 0 && priceCurrent > 0) ? ((priceCurrent - pricePrev) / pricePrev) * 100 : 0;
    const up2y = (price2Ago > 0 && priceCurrent > 0) ? ((priceCurrent - price2Ago) / price2Ago) * 100 : 0;

    return {
        stationName,
        score: getRiskScore(globalMedian),
        marketPrice: Math.floor(globalMedian),
        trend: calculateTrend(metrics),
        chartData: metrics,
        rawTransactions: allRawTxs,
        tx5y: allRawTxs.length,
        yoy: parseFloat(yoy.toFixed(1)),
        up2y: parseFloat(up2y.toFixed(1)),
        trendData: metrics.map(m => ({ year: parseInt(m.name), price: m.lastPrice, txCount: m.count })),
        dataYear: reliableDataYear,
        latestYear: latestDataYear
    };
}

function getRiskScore(price: number): number {
    let s = Math.floor((price / 120000000) * 100);
    return s > 100 ? 100 : s;
}

function calculateTrend(metrics: StationMetric[]): "UP" | "DOWN" | "FLAT" {
    if (metrics.length < 2) return "FLAT";
    const start = metrics[0].lastPrice;
    const end = metrics[metrics.length - 1].lastPrice;
    if (end > start * 1.05) return "UP";
    if (end < start * 0.95) return "DOWN";
    return "FLAT";
}

export type FullDiagnosisData = {
    mlit: any;
    lines: any;
    ext: ExtendedMetrics;
};

export async function getFullDiagnosisData(stationName: string, prefCode: string): Promise<FullDiagnosisData> {
    const safeName = normalizeStation(stationName);
    const cacheKey = `${safeName}_${prefCode}_full_v8.json`;
    const cachePath = path.join(CACHE_DIAG_DIR, cacheKey);

    if (fs.existsSync(cachePath)) {
        try { return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as FullDiagnosisData; } catch (e: any) { }
    }

    const coords = await getStationCoords(stationName);
    let [mlit, lines, ext] = await Promise.all([
        getStationDiagnosis(stationName, prefCode),
        getStationLines(stationName),
        fetchExtendedMetrics(stationName, coords?.lat, coords?.lon)
    ]);

    const pref = PREFECTURES.find(p => String(p.code) === String(prefCode));
    if (pref) {
        let targetCity = STRICT_CITY_FILTER[stationName] || "";
        if (!targetCity && mlit.rawTransactions.length > 0) {
            const counts: Record<string, number> = {};
            mlit.rawTransactions.forEach(t => { if (t.Municipality) counts[t.Municipality] = (counts[t.Municipality] || 0) + 1; });
            const sortedCities = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
            if (sortedCities.length > 0) targetCity = sortedCities[0];
        }
        if (!targetCity) {
            if (stationName.includes("新宿")) targetCity = "新宿区";
            if (stationName.includes("渋谷")) targetCity = "渋谷区";
            if (stationName.includes("池袋")) targetCity = "豊島区";
            if (stationName.includes("横浜")) targetCity = "横浜市西区";
            if (stationName.includes("武蔵小杉")) targetCity = "川崎市中原区";
            if (stationName.includes("大宮")) targetCity = "さいたま市大宮区";
        }
        if (targetCity) {
            const proj = getCityPopulationProjection(pref.name, targetCity);
            if (proj) {
                ext.populationProjection = proj.data;
                ext.sourceCity = proj.city;
                const p2020 = proj.data.find((d: any) => d.year === 2020)?.total || 1;
                const p2050 = proj.data.find((d: any) => d.year === 2050)?.total || 1;
                ext.futurePopulationRate = Math.round((p2050 / p2020) * 100);
            }
        }
    }

    const fullData: FullDiagnosisData = { mlit: { ...mlit, trend: mlit.trend as "UP" | "DOWN" | "FLAT" }, lines, ext };
    try { fs.writeFileSync(cachePath, JSON.stringify(fullData, null, 2)); } catch (e: any) { }
    return fullData;
}
// Force Next.js to recompile 2
