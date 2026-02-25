// lib/mlitApi.ts
// 国土交通省 API クライアント (正式な外部APIフェッチ用インターフェース)

export type TradeTrendData = {
    year: number;
    price: number; // 平均取引価格（単価など）
    txCount: number; // 取引件数
};

/**
 * 過去5年程度の取引価格推移を取得する
 * APIキーがない場合はモックデータを返す
 */
export async function fetchTradeTrend(stationName: string, year: number): Promise<TradeTrendData[]> {
    // 実際にコアサービス側の mlitServiceCore で処理を行っているため、
    // 重複した不要なランダム生成付きのモックAPIは停止しました。
    return [];
}

export type ExtendedMetrics = {
    futurePopulationRate: number; // 2050年時点の推計人口指数 (2020=100)
    populationProjection?: {      // 公的データ (IPSS)
        year: number;
        total: number;
        ageStructure: {
            "0-14": number;
            "15-64": number;
            "65+": number;
        };
    }[];
    sourceCity?: string;          // データ引用元の自治体名
    hazardRisk: {
        flood: { level: number; description: string };
        landslide: { level: number; description: string };
    };
};

/**
 * 将来人口・ハザード情報を取得 (Refactored)
 */
import { checkFloodRisk, checkLandslideRisk } from './external/hazardMapApi';

/**
 * 将来人口・ハザード情報を取得 (Real Data via GSI)
 */
export async function fetchExtendedMetrics(stationName: string, lat?: number, lon?: number): Promise<ExtendedMetrics> {
    // 1. Hazard Data from GSI (Real Tile Analysis)
    let hazard = {
        flood: { level: 0, description: "データなし" },
        landslide: { level: 0, description: "データなし" }
    };

    if (lat && lon) {
        try {
            const [flood, landslide] = await Promise.all([
                checkFloodRisk(lat, lon),
                checkLandslideRisk(lat, lon)
            ]);

            hazard = { flood, landslide };
        } catch (e) {
            console.error("Failed to fetch hazard data:", e);
        }
    }

    // 2. Future Population Rate is now primarily sourced from the JSON file in mlitServiceCore.ts
    // For stations without data, it remains undefined. We no longer generate random fake data.
    let popRate = 0;

    return {
        futurePopulationRate: popRate,
        hazardRisk: hazard
    };
}
