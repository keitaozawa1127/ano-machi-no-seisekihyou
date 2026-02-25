// @ts-nocheck

import { PngDecoder } from '../lib/external/miniPng';

function lonLatToTile(lon: number, lat: number, z: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

    // Pixel calculation
    const xFloat = (lon + 180) / 360 * n;
    const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    const px = Math.floor((xFloat - x) * 256);
    const py = Math.floor((yFloat - y) * 256);

    return { x, y, z, px, py };
}

async function checkUrl(url: string, desc: string) {
    console.log(`Checking: ${url} (${desc})`);
    try {
        const res = await fetch(url);
        if (res.ok) {
            console.log(`[SUCCESS] Found Data! Size: ${(await res.arrayBuffer()).byteLength}`);
            return true;
        } else {
            console.log(`[${res.status}] Not Found`);
            return false;
        }
    } catch (e: any) {
        console.error(`[ERR] ${e.message}`);
        return false;
    }
}

async function main() {
    console.log("=== Verification with Correct Domain (disaportaldata.gsi.go.jp) ===");

    // Arakawa River Center (High Risk)
    const lat = 35.7495;
    const lon = 139.8247;
    const zoom = 15; // Metadata said z2to17

    const t = lonLatToTile(lon, lat, zoom);

    // Correct URL Template from Metadata
    // https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{TileMatrix}/{TileCol}/{TileRow}.png

    const url = `https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/${zoom}/${t.x}/${t.y}.png`;

    const exists = await checkUrl(url, "Arakawa (Correct Domain)");

    if (exists) {
        console.log("CONFIRMED: Domain was the issue. Proceeding with Image Analysis implementation.");
    } else {
        console.log("FAILED: Still 404. Maybe Zoom level or Coords issue?");

        // Try Z13
        const t13 = lonLatToTile(lon, lat, 13);
        const url13 = `https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/13/${t13.x}/${t13.y}.png`;
        checkUrl(url13, "Arakawa Z13");
    }
}

main();
