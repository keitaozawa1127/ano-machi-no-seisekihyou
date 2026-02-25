
import { PngDecoder } from '../lib/external/miniPng';

function lonLatToTile(lon: number, lat: number, z: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y, z };
}

async function check(url: string, desc: string) {
    try {
        const res = await fetch(url);
        if (res.ok) {
            console.log(`[SUCCESS] ${desc} -> ${url}`);
            const buf = await res.arrayBuffer();
            console.log(`  Size: ${buf.byteLength}`);
            return true;
        } else {
            // console.log(`[${res.status}] ${desc}`); // Reduce noise
        }
    } catch (e) {
        // console.log(`[ERR] ${desc}`);
    }
    return false;
}

async function main() {
    console.log("=== Brute Force Hazard Map URL ===");

    // Edogawa-Hirai (Sea Level 0, High Risk)
    const lat = 35.7067;
    const lon = 139.8431;
    const zoom = 15; // Try 15 first

    const t = lonLatToTile(lon, lat, zoom);

    const ids = [
        '01_flood_l2_shinsuishin_data',
        '01_flood_l2_shinsuishin_kuni_data',
        '01_flood_l2_shinsuishin_pref_data',
        '01_shinsuishin_newlegend_data',
        '01_flood_l2_shinsuishin',
        '01_shinsuishin'
    ];

    const protocols = ['https', 'http'];
    const extensions = ['png'];

    for (const proto of protocols) {
        for (const id of ids) {
            for (const ext of extensions) {
                // Standard: /z/x/y
                const url1 = `${proto}://disaportal.gsi.go.jp/data/map/${id}/${zoom}/${t.x}/${t.y}.${ext}`;
                if (await check(url1, `${id} Standard`)) return;

                // Swap XY: /z/y/x (Rare but possible)
                const url2 = `${proto}://disaportal.gsi.go.jp/data/map/${id}/${zoom}/${t.y}/${t.x}.${ext}`;
                if (await check(url2, `${id} SwapXY`)) return;
            }
        }

        // Try Z=13
        const zoom13 = 13;
        const t13 = lonLatToTile(lon, lat, zoom13);
        console.log(`Trying Z=13...`);
        for (const id of ids) {
            const url13 = `${proto}://disaportal.gsi.go.jp/data/map/${id}/${zoom13}/${t13.x}/${t13.y}.png`;
            if (await check(url13, `${id} Z13`)) return;
        }
    }
    console.log("ALL FAILED.");
}

main();
