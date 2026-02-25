import { ExtendedMetrics } from '../mlitApi';

// GSI Elevation API
const BASE_URL = 'https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php';

type GsiResponse = {
    elevation: number;
    hsrc: string;
};

async function fetchElevation(lat: number, lon: number): Promise<number | null> {
    try {
        const url = `${BASE_URL}?lon=${lon}&lat=${lat}&outtype=JSON`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const json = (await res.json()) as GsiResponse;
        return typeof json.elevation === 'number' ? json.elevation : null;
    } catch (e) {
        console.error("GSI API Error:", e);
        return null;
    }
}

/**
 * 3点から傾斜角（度）を簡易計算
 */
async function calcSlope(lat: number, lon: number): Promise<number> {
    const delta = 0.0005; // approx 50m
    const [e0, e1, e2] = await Promise.all([
        fetchElevation(lat, lon),
        fetchElevation(lat + delta, lon),
        fetchElevation(lat, lon + delta)
    ]);

    if (e0 === null || e1 === null || e2 === null) return 0;

    // Simple gradient
    const dLatM = delta * 111000;
    const dLonM = delta * 111000 * Math.cos(lat * Math.PI / 180);

    const slopeLat = (e1 - e0) / dLatM;
    const slopeLon = (e2 - e0) / dLonM;

    const netSlope = Math.sqrt(slopeLat * slopeLat + slopeLon * slopeLon);
    return Math.atan(netSlope) * (180 / Math.PI);
}

/**
 * 標高・傾斜から災害リスクを算定
 */
export async function fetchHazardFromGSI(lat: number, lon: number): Promise<{ hazardRisk: { flood: number; landslide: number }; groundAmplification: number }> {
    const elev = await fetchElevation(lat, lon);
    const slope = await calcSlope(lat, lon);

    const e = elev ?? 10; // default safe

    // 1. Flood Risk (Low elevation = High risk)
    // 0m -> Level 5, 2m -> Level 4, 5m -> Level 3, 10m -> Level 1
    let flood = 0;
    if (e < 1.0) flood = 5;
    else if (e < 3.0) flood = 4;
    else if (e < 5.0) flood = 3;
    else if (e < 10.0) flood = 1;
    else flood = 0;

    // 2. Landslide Risk (Steep slope = High risk)
    // > 20 deg -> Level 3
    let landslide = 0;
    if (slope > 20) landslide = 3;
    else if (slope > 10) landslide = 1;

    // 3. Ground Amplification (Lowland/Reclaimed = High)
    // elevation < 3m -> 2.0 (Soft)
    // elevation > 20m -> 1.0 (Hard)
    let amp = 1.0;
    if (e < 3.0) amp = 2.2;
    else if (e < 8.0) amp = 1.6;
    else if (e < 15.0) amp = 1.3;
    else amp = 1.0;

    return {
        hazardRisk: { flood, landslide },
        groundAmplification: amp
    };
}
