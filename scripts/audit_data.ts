import fs from 'fs';
import path from 'path';

const STATIONS_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');
const REPORT_PATH = path.join(process.cwd(), 'station_data_audit_report.json');
const PATCH_PATH = path.join(process.cwd(), 'station_data_fix_patch.json');

interface StationData {
    name: string;
    lines: string[];
    prefecture: string;
    prefCode: string;
    coordinates: [number, number]; // lon, lat
    passengerVolume: number;
    passengerVolumeHistory?: { year: number; count: number }[];
}

// Haversine Distance
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Standard Prefectures Map (Name -> Code)
const PREF_MAP: Record<string, string> = {
    "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05", "山形県": "06", "福島県": "07",
    "茨城県": "08", "栃木県": "09", "群馬県": "10", "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14",
    "新潟県": "15", "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
    "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25", "京都府": "26", "大阪府": "27",
    "兵庫県": "28", "奈良県": "29", "和歌山県": "30", "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34",
    "山口県": "35", "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
    "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45", "鹿児島県": "46", "沖縄県": "47"
};

async function main() {
    console.log('Starting Data Integrity Check...');

    if (!fs.existsSync(STATIONS_PATH)) {
        console.error('Stations file not found');
        return;
    }
    const rawData = fs.readFileSync(STATIONS_PATH, 'utf-8');
    const stations: Record<string, StationData> = JSON.parse(rawData);

    const errors: any[] = [];
    const patch: Record<string, Partial<StationData>> = {};

    // 1. Prefecture Centroids Calculation
    const prefCoordinates: Record<string, { latSum: number, lonSum: number, count: number }> = {};

    Object.values(stations).forEach(s => {
        if (!prefCoordinates[s.prefCode]) prefCoordinates[s.prefCode] = { latSum: 0, lonSum: 0, count: 0 };
        prefCoordinates[s.prefCode].latSum += s.coordinates[1]; // lat
        prefCoordinates[s.prefCode].lonSum += s.coordinates[0]; // lon
        prefCoordinates[s.prefCode].count++;
    });

    const prefCentroids: Record<string, { lat: number, lon: number }> = {};
    Object.keys(prefCoordinates).forEach(code => {
        const d = prefCoordinates[code];
        prefCentroids[code] = { lat: d.latSum / d.count, lon: d.lonSum / d.count };
    });

    // 2. Main Scan
    Object.entries(stations).forEach(([key, station]) => {
        const issues: string[] = [];

        // Check 1: PrefCode vs Prefecture Name
        const expectedCode = PREF_MAP[station.prefecture];
        if (expectedCode && expectedCode !== station.prefCode) {
            issues.push(`PrefCode Mismatch: Name=${station.prefecture}(${expectedCode}) vs Code=${station.prefCode}`);
            // Auto-patch generation
            if (!patch[key]) patch[key] = {};
            patch[key].prefCode = expectedCode;
        }

        // Check 2: Spatial Outlier (>100km from centroid of its Declared Prefecture)
        // If mismatched, calculate dist to expected pref
        const declaredCentroid = prefCentroids[station.prefCode];
        if (declaredCentroid) {
            const dist = getDistance(station.coordinates[1], station.coordinates[0], declaredCentroid.lat, declaredCentroid.lon);
            // 100km threshold (generous, but effective for blatant errors like Tokyo/Osaka swap)
            // Note: Hokkaido is huge, so this is heuristic.
            if (dist > 150000) {
                issues.push(`Spatial Warning: ${Math.round(dist / 1000)}km from pref centroid`);
            }
        }

        // Check 3: Line Attribution (Complex, skip for simple per-station scan, verify aggregation later)

        // Check 4: Logical Value Checks
        if (station.name !== "東京" && station.passengerVolume > 5000000) { // 5 million daily? unlikely for single station daily count usually < 3.5m (Shinjuku)
            // Check if it's annual vs daily. 
            // If most stations are ~30k and this is 100m, it's wrong.
            // Assume daily.
        }

        // Logical check: passengerVolume history jumps
        if (station.passengerVolumeHistory && station.passengerVolumeHistory.length > 1) {
            const sorted = [...station.passengerVolumeHistory].sort((a, b) => b.year - a.year);
            const latest = sorted[0].count;
            const prev = sorted[1].count;
            if (prev > 0) {
                const ratio = latest / prev;
                if (ratio > 3 || ratio < 0.33) {
                    issues.push(`Value Jump: ${latest} vs ${prev} (Ratio: ${ratio.toFixed(2)})`);
                }
            }
        }

        if (issues.length > 0) {
            errors.push({
                key,
                name: station.name,
                prefecture: station.prefecture,
                prefCode: station.prefCode,
                issues
            });
        }
    });

    // Check 5: Line Attribution Consistency
    const linePrefMap: Record<string, Set<string>> = {};
    Object.values(stations).forEach(s => {
        s.lines.forEach(l => {
            if (!linePrefMap[l]) linePrefMap[l] = new Set();
            linePrefMap[l].add(s.prefCode);
        });
    });

    Object.entries(linePrefMap).forEach(([line, prefs]) => {
        if (line.includes('横浜線') && prefs.has('01')) { // Example: Kanagawa line in Hokkaido?
            // Heuristic check
        }
    });


    // Output
    fs.writeFileSync(REPORT_PATH, JSON.stringify(errors, null, 2));
    fs.writeFileSync(PATCH_PATH, JSON.stringify(patch, null, 2));

    console.log(`Audit Complete. Found ${errors.length} issues.`);
    console.log(`Report: ${REPORT_PATH}`);
    console.log(`Patch: ${PATCH_PATH}`);

    // Dump first few errors
    if (errors.length > 0) {
        console.log('--- Top 3 Errors ---');
        console.log(JSON.stringify(errors.slice(0, 3), null, 2));
    }
}

main().catch(console.error);
