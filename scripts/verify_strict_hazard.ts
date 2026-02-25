// @ts-nocheck

import { PngDecoder } from '../lib/external/miniPng';

function lonLatToTile(lon: number, lat: number, z: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
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
    console.log("=== Hypothesis Verification: 404 means Safe, 200 means Risk ===");

    // Test Point 1: Arakawa River Center (Definitely Flood)
    // Near Horikiri Station
    const lat = 35.7495;
    const lon = 139.8247;
    const zoom = 13; // Try 13 first

    const t = lonLatToTile(lon, lat, zoom);

    // Dataset ID from Metadata
    // '01_flood_l2_shinsuishin_data' appears in metadata URL <ResourceURL>
    const ds = '01_flood_l2_shinsuishin_data';

    const url = `https://disaportal.gsi.go.jp/data/map/${ds}/${zoom}/${t.x}/${t.y}.png`;

    const exists = await checkUrl(url, "Arakawa River Center (Should exist)");

    if (!exists) {
        console.log("Hypothesis failed: Even river center is 404 with this URL.");
        // Try other variations just in case
        const k_url = `https://disaportal.gsi.go.jp/data/map/01_flood_l2_shinsuishin_kuni_data/${zoom}/${t.x}/${t.y}.png`;
        await checkUrl(k_url, "Kuni Data Variation");
    } else {
        console.log("Hypothesis PLAIUSIBLE: URL is correct, 404 likely means 'No Risk Details' (Safe).");
    }

    // Try Liquefaction (Roadmap Item)
    // Dataset ID likely: '05_ekijyoka_keikaikuiki'? No, need to search metadata.
}

main();
