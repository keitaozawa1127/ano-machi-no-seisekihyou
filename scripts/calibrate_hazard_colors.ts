
import { PngDecoder } from '../lib/external/miniPng';

// Try Zoom 13 (Standard for detailed hazard maps)
const ZOOM = 13;

function lonLatToTile(lon: number, lat: number, z: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

    // Pixel offset within the tile (256x256)
    const xFloat = (lon + 180) / 360 * n;
    const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

    const px = Math.floor((xFloat - x) * 256);
    const py = Math.floor((yFloat - y) * 256);

    return { x, y, z, px, py };
}

async function checkColor(name: string, lat: number, lon: number) {
    console.log(`\nChecking Flood Color for ${name} (${lat}, ${lon})...`);

    // Dataset Candidates
    const datasets = [
        '01_flood_l2_shinsuishin_data', // Unified (L2)
        '01_shinsuishin_newlegend_data' // Another ID sometimes used?
    ];

    for (const ds of datasets) {
        const tile = lonLatToTile(lon, lat, ZOOM);
        // Note: MLIT URLs often use standard Z/X/Y.png
        const url = `https://disaportal.gsi.go.jp/data/map/${ds}/${tile.z}/${tile.x}/${tile.y}.png`;
        console.log(`Trying ${ds} at Z${ZOOM}: ${url}`);

        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.log(`  -> Failed: ${res.status}`);
                continue;
            }

            const buffer = Buffer.from(await res.arrayBuffer());
            console.log(`  -> Downloaded ${buffer.length} bytes`);

            try {
                const png = PngDecoder.parse(buffer);
                const pixel = png.getPixel(tile.px, tile.py);

                console.log(`  -> Pixel At (${tile.px}, ${tile.py}): RGBA(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a})`);

                if (pixel.a > 0) {
                    console.log("  -> RISK DETECTED!");
                } else {
                    console.log("  -> Transparent (No Risk at exact point)");
                }
                return; // Stop if success
            } catch (e) {
                console.error("  -> PNG Parse Error:", e);
            }
        } catch (e) {
            console.error("  -> Network Error:", e);
        }
    }
    console.log("All datasets failed or no data.");
}

async function main() {
    // 1. Arakawa Riverbed (Should be inundated)
    await checkColor("Arakawa Riverbed", 35.7364, 139.8660);

    // 2. Musashi-Kosugi (Deep water likely)
    await checkColor("Musashi-Kosugi", 35.5759, 139.6595);

    // 3. Jiyugaoka (Maybe safe or low)
    await checkColor("Jiyugaoka", 35.6073, 139.6688);
}

main();
