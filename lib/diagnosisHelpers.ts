/**
 * getStationDiagnosis関数のヘルパー関数群
 * 地理的フィルタリングとデータ処理
 */

import { calcDistance, isInBoundingBox, Coordinates } from './geoUtils';

// 型定義（mlitServiceCore.tsと同じ）
export type Transaction = {
    Type: string;
    DistrictName: string;
    Municipality?: string;
    TradePrice: string;
    Period?: string;
    NearestStation?: string;
    PriceCategory?: string;
};

export type StationCoords = {
    lat: number;
    lon: number;
    name: string;
};

/**
 * 取引データから全町丁目の座標を一括取得（並列処理）
 */
export async function preloadDistrictCoordinates(
    data: Transaction[],
    prefectureName: string,
    getDistrictCoords: (pref: string, muni: string, dist: string) => Promise<Coordinates | null>
): Promise<Map<string, Coordinates>> {
    const coordsMap = new Map<string, Coordinates>();
    const TIMEOUT_MS = 8000; // 8 seconds max for geocoding

    console.log('[PRELOAD] Loading district coordinates (parallel)...');
    const uniqueDistricts = Array.from(new Set(
        data.map(t => `${t.Municipality || ''}|||${t.DistrictName || ''}`)
    ));

    const startTime = Date.now();
    // ネットワークリクエストがないため遅延なしで即座に処理
    const promises = uniqueDistricts.map(async (key) => {
        const [municipality, district] = key.split('|||');
        if (!district) return null;

        const coords = await getDistrictCoords(prefectureName, municipality, district);
        if (coords) {
            return { key, coords };
        }
        return null;
    });

    const results = await Promise.all(promises);
    for (const res of results) {
        if (res) {
            coordsMap.set(res.key, res.coords);
        }
    }

    console.log(`[PRELOAD] Loaded ${coordsMap.size}/${uniqueDistricts.length} coords in ${Date.now() - startTime}ms`);
    return coordsMap;
}

/**
 * 駅名を正規化（空白削除、「駅」削除）
 */
function normalizeStation(s: string): string {
    if (!s) return "";
    return s.replace(/[ \u3000]/g, '').replace(/駅$/, '').trim();
}

/**
 * 地理的フィルタリング（座標ベース専用）
 * 駅座標がある場合は座標ベースのみで判定し、エイリアスフォールバックは使用しない。
 * 駅座標がない場合のみエイリアスフォールバックを使用する。
 */
export function filterTransactionsByLocation(
    data: Transaction[],
    stationName: string,
    stationCoords: StationCoords | null,
    radiusKm: number,
    coordsMap: Map<string, Coordinates>,
    matchTargets: string[],
    requiredCity: string
): Transaction[] {
    return data.filter(t => {
        const type = t.Type || "";
        if (!type.includes("中古マンション等") && !type.includes("宅地(土地と建物)")) {
            return false;
        }

        const municipality = t.Municipality || "";
        const district = t.DistrictName || "";
        const m = normalizeStation(municipality);

        // 市区町村フィルタ
        if (requiredCity && !m.includes(requiredCity)) {
            return false;
        }

        // 駅座標がない場合、または座標が取得できなかった場合用エイリアスチェック
        const s = normalizeStation(t.NearestStation || "");
        const d = normalizeStation(district);
        const aliasMatch = () => {
            if (m.includes(normalizeStation(stationName))) return true;
            return matchTargets.some(tgt =>
                (s && s.includes(tgt)) ||
                (d && d.includes(tgt)) ||
                (d && tgt.includes(d) && d.length >= 2)
            );
        };

        // 駅座標がある場合：座標ベース判定を優先し、ジオコード不可ならエイリアスへ
        if (stationCoords) {
            if (!district) return aliasMatch(); // 町丁目名がない場合はエイリアス

            const key = `${municipality}|||${district}`;
            const districtCoord = coordsMap.get(key);

            if (!districtCoord) {
                // 座標が取得できなかった町丁目はエイリアスでフォールバック
                return aliasMatch();
            }

            // 境界ボックスチェック（高速化）
            if (!isInBoundingBox(
                stationCoords.lat, stationCoords.lon,
                districtCoord.lat, districtCoord.lon,
                radiusKm
            )) {
                return false;
            }

            // 正確な距離計算
            const distance = calcDistance(
                stationCoords.lat, stationCoords.lon,
                districtCoord.lat, districtCoord.lon
            );

            return distance <= radiusKm;
        }

        // 駅座標がない場合のみ：エイリアスフォールバック
        return aliasMatch();
    });
}
