// @ts-nocheck

import { PngDecoder } from '../lib/external/miniPng';

function lonLatToTile(lon: number, lat: number, z: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y, z };
}

async function checkUrl(url: string, description: string): Promise<boolean> {
    try {
        const res = await fetch(url);
        if (res.ok) {
            console.log(`[OK] ${description} -> ${url}`);
            return true;
        } else {
            console.log(`[${res.status}] ${description} -> ${url}`);
            return false;
        }
    } catch (e: any) {
        console.log(`[ERR] ${description} -> ${e.message}`);
        return false;
    }
}

async function main() {
    console.log("=== 1. Verify Coordinate Calculation (GSI Standard Map) ===");
    // Tokyo Station: 35.6812, 139.7640
    // Z=13
    const lat = 35.6812;
    const lon = 139.7640;

    // GSI Standard Map URL: https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png
    // Note: domain is cyberjapandata, NOT disaportal

    const tileStd = lonLatToTile(lon, lat, 13);
    const urlStd = `https://cyberjapandata.gsi.go.jp/xyz/std/${tileStd.z}/${tileStd.x}/${tileStd.y}.png`;

    const stdOk = await checkUrl(urlStd, "GSI Standard Map (Tokyo Z13)");

    if (!stdOk) {
        console.error("CRITICAL: Coordinate calculation seems wrong! Or network is blocked.");
        return;
    }

    console.log("=== 2. Scan Hazard Map Zoom Levels (Arakawa) ===");
    // Arakawa: 35.7364, 139.8660
    const aLat = 35.7364;
    const aLon = 139.8660; // Should be flood area

    const ds = '01_flood_l2_shinsuishin_data';

    for (let z = 2; z <= 17; z++) {
        const t = lonLatToTile(aLon, aLat, z);
        const url = `https://disaportal.gsi.go.jp/data/map/${ds}/${t.z}/${t.x}/${t.y}.png`;
        const ok = await checkUrl(url, `Flood Z${z}`);
        if (ok) {
            console.log("FOUND WORKING ZOOM LEVEL:", z);
            // break; // Don't break, see range
        }
    }
}

main();
