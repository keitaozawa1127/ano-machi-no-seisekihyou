
import { PngDecoder } from '../lib/external/miniPng';

function lonLatToTile(lon: number, lat: number, z: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y, z };
}

async function checkUrl(url: string, desc: string) {
    console.log(`Checking: ${url} (${desc})`);
    try {
        const res = await fetch(url);
        if (res.ok) {
            console.log(`[SUCCESS] Found Data!`);
            return true;
        } else {
            // console.log(`[${res.status}] Not Found`);
            return false;
        }
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log("=== Guessing Liquefaction ID with disaportaldata.gsi.go.jp ===");

    // Urayasu (Liquefaction famous area)
    const lat = 35.6531;
    const lon = 139.8974;
    const z = 13;

    const t = lonLatToTile(lon, lat, z);

    const candidates = [
        '05_ekijyoka_keikaikuiki',
        '05_ekijyoka',
        '02_tsunamishinsui_soutei', // Tsunami?
        '03_hightide_l2_shinsuishin', // High Tide?
        '01_flood_l2_shinsuishin_data' // Baseline (Flood)
    ];

    for (const id of candidates) {
        const url = `https://disaportaldata.gsi.go.jp/raster/${id}/${z}/${t.x}/${t.y}.png`; // Try without _data suffix too
        if (await checkUrl(url, id)) continue;

        const urlData = `https://disaportaldata.gsi.go.jp/raster/${id}_data/${z}/${t.x}/${t.y}.png`;
        await checkUrl(urlData, id + "_data");
    }
}

main();
