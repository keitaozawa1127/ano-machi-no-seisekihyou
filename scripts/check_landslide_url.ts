
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
            console.log(`[SUCCESS] Found Data! Size: ${(await res.arrayBuffer()).byteLength}`);
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
    console.log("=== Checking Landslide URLs ===");

    // Okutama (Steep mountains) - Nippara Limestone Cave area
    // 35.8509, 139.0416
    const lat = 35.8509;
    const lon = 139.0416;
    const z = 15;
    const t = lonLatToTile(lon, lat, z);

    const ids = [
        '05_dosekiryukeikaikuiki',
        '05_kyukeishakeikaikuiki',
        '05_jisuberikeikaikuiki',
        '05_dosekiryukikenkeiryu' // Potential debris flow stream
    ];

    const DOMAIN = "https://disaportaldata.gsi.go.jp";

    for (const id of ids) {
        // Try exact point and surroundings (since these are line/area data)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const url = `${DOMAIN}/raster/${id}_data/${z}/${t.x + dx}/${t.y + dy}.png`; // Try _data too
                const urlNoData = `${DOMAIN}/raster/${id}/${z}/${t.x + dx}/${t.y + dy}.png`;

                if (await checkUrl(url, `${id}_data [${dx},${dy}]`)) return;
                if (await checkUrl(urlNoData, `${id} [${dx},${dy}]`)) return;
            }
        }
    }
    console.log("All Landslide URLs Failed.");
}

main();
