
import { PngDecoder } from './miniPng';

// Correct Domain for Tile Data
const DOMAIN = "https://disaportaldata.gsi.go.jp";

const URLS = {
    // 洪水浸水想定区域（想定最大規模）
    flood: `${DOMAIN}/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png`,

    // 土砂災害警戒区域（土石流）
    landslide_debris: `${DOMAIN}/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png`,

    // 土砂災害警戒区域（急傾斜地）
    landslide_steep: `${DOMAIN}/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png`,

    // 地すべり警戒区域
    landslide_slide: `${DOMAIN}/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png`
};

const ZOOM = 15; // High resolution

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

async function fetchTilePixel(urlTemplate: string, tile: { x: number, y: number, z: number, px: number, py: number }) {
    const url = urlTemplate
        .replace('{z}', tile.z.toString())
        .replace('{x}', tile.x.toString())
        .replace('{y}', tile.y.toString());

    try {
        const res = await fetch(url);
        if (!res.ok) {
            return null; // 404 means no data (Safe usually)
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const png = PngDecoder.parse(buffer);

        // Search Radius (Check nearby pixels to avoid missing fine lines)
        const R = 5;
        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const tx = tile.px + dx;
                const ty = tile.py + dy;
                // getPixel returns 0,0,0,0 if out of bounds, so it's safe
                const pixel = png.getPixel(tx, ty);
                if (pixel.a > 0) {
                    return pixel; // Found risk nearby
                }
            }
        }

        return null; // All transparent in radius
    } catch (e) {
        return null;
    }
}

export type HazardRiskDetail = {
    level: number;
    description: string;
};

/**
 * 河川氾濫リスク (Flood Risk)
 * Based on Hazard Map Image Analysis
 */
export async function checkFloodRisk(lat: number, lon: number): Promise<HazardRiskDetail> {
    const tile = lonLatToTile(lon, lat, ZOOM);
    const pixel = await fetchTilePixel(URLS.flood, tile);

    if (!pixel) {
        return { level: 0, description: "ハザードマップの浸水想定区域に含まれていません。" };
    }

    // Heuristic: If colored, risky.
    // L2 Flood Map Legend: Yellows -> Shallow, Reds -> Deep
    if (pixel.r > 150 && pixel.g < 100) {
        return { level: 5, description: "想定最大規模の浸水深が3.0m以上（2階までの浸水）と予測されています。" };
    }
    if (pixel.r > 200 && pixel.g > 200) {
        return { level: 2, description: "想定最大規模の浸水深が0.5m未満（床下浸水相当）と予測されています。" };
    }

    return { level: 3, description: "想定最大規模の浸水深が0.5m〜3.0m（1階浸水相当）と予測されています。" };
}

/**
 * 土砂災害リスク (Landslide Risk)
 * Based on Hazard Map Image Analysis (Debris, Steep Slope, Landslide)
 */
export async function checkLandslideRisk(lat: number, lon: number): Promise<HazardRiskDetail> {
    const tile = lonLatToTile(lon, lat, ZOOM);

    // Check all 3 types in parallel
    const [debris, steep, slide] = await Promise.all([
        fetchTilePixel(URLS.landslide_debris, tile),
        fetchTilePixel(URLS.landslide_steep, tile),
        fetchTilePixel(URLS.landslide_slide, tile)
    ]);

    if (debris) {
        return { level: 4, description: "「土石流警戒区域」に含まれています。山腹崩壊による土石流発生のリスクがあります。" };
    }
    if (steep) {
        return { level: 4, description: "「急傾斜地崩壊危険区域」に含まれています。崖崩れのリスクがあります。" };
    }
    if (slide) {
        return { level: 4, description: "「地すべり警戒区域」に含まれています。地盤滑動のリスクがあります。" };
    }

    return { level: 0, description: "土砂災害警戒区域に含まれていません。" };
}
