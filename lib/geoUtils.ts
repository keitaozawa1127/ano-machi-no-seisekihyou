/**
 * 地理的計算ユーティリティ
 * 駅と町丁目間の距離計算など
 */

/**
 * 座標型定義
 */
export type Coordinates = {
    lat: number;
    lon: number;
};

/**
 * 度をラジアンに変換
 */
function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Haversine公式で2点間の距離を計算 (km)
 * 
 * @param lat1 地点1の緯度
 * @param lon1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lon2 地点2の経度
 * @returns 2点間の距離 (km)
 */
export function calcDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // 地球の半径 (km)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * 境界ボックスをチェック（距離計算の事前フィルタ用）
 * 
 * @param stationLat 駅の緯度
 * @param stationLon 駅の経度
 * @param targetLat 対象地点の緯度
 * @param targetLon 対象地点の経度
 * @param radiusKm 半径 (km)
 * @returns 境界ボックス内ならtrue
 */
export function isInBoundingBox(
    stationLat: number,
    stationLon: number,
    targetLat: number,
    targetLon: number,
    radiusKm: number
): boolean {
    // 緯度方向: 1度 ≈ 111km
    const latRange = radiusKm / 111;

    // 経度方向: 緯度によって変わる
    const lonRange = radiusKm / (111 * Math.cos(toRad(stationLat)));

    return (
        targetLat >= stationLat - latRange &&
        targetLat <= stationLat + latRange &&
        targetLon >= stationLon - lonRange &&
        targetLon <= stationLon + lonRange
    );
}
