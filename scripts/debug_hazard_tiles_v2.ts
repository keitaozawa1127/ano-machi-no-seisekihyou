
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

async function checkUrl(url: string, description: string): Promise<boolean> {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        if (res.ok) {
            console.log(`[OK] ${description} -> ${url}`);
            // Check transparency
            const buf = Buffer.from(await res.arrayBuffer());
            return true;
        } else {
            console.log(`[${res.status}] ${description} -> ${url}`);
            return false;
        }
    } catch (e) {
        console.log(`[ERR] ${description} -> ${e.message}`);
        return false;
    }
}

async function main() {
    console.log("=== Hazard Map Tile Debug (Multi-Location / Multi-Dataset) ===");

    const locations = [
        { name: "Arakawa", lat: 35.7364, lon: 139.8660 },
        { name: "Edogawa-Hirai", lat: 35.7067, lon: 139.8431 }, // Sea level zero
        { name: "Musashi-Kosugi", lat: 35.5759, lon: 139.6595 }
    ];

    const datasets = [
        '01_flood_l2_shinsuishin_data',      // Unified L2
        '01_flood_l2_shinsuishin_kuni_data', // State managed
        '01_flood_l2_shinsuishin_pref_data', // Prep managed
        '01_shinsuishin_newlegend_data',     // Old/Alternative
        '01_shinsuishin_newlegend_kuni_data'
    ];

    // Try Zoom 13 and 15
    const zooms = [13, 15];

    for (const loc of locations) {
        console.log(`\nTesting Location: ${loc.name}`);
        for (const z of zooms) {
            for (const ds of datasets) {
                const t = lonLatToTile(loc.lon, loc.lat, z);
                const url = `https://disaportal.gsi.go.jp/data/map/${ds}/${t.z}/${t.x}/${t.y}.png`;

                const ok = await checkUrl(url, `${ds} (Z${z})`);
                if (ok) {
                    console.log("  >>> SUCCESS! Use this dataset format. <<<");
                }
            }
        }
    }
}

main();
