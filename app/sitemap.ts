import { MetadataRoute } from 'next';
import fs from 'fs/promises';
import path from 'path';

// 本番ドメインを設定
const BASE_URL = 'https://anomachi.jp';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // 1. 静的ルートの定義
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/stations`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        }
    ];

    try {
        // 2. 動的ルート（駅ごとのページ）の生成
        const filePath = path.join(process.cwd(), 'public', 'data', 'stations.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const stationsRaw = JSON.parse(fileContent);

        const dynamicRoutes: MetadataRoute.Sitemap = [];

        // 同じ駅名が複数県に存在する場合、/station/[id] では1つのデータとして処理されるため、
        // URLの重複を防ぐためのSetを用意
        const processedStationNames = new Set<string>();

        for (const key in stationsRaw) {
            const station = stationsRaw[key];
            if (!station || !station.name) continue;

            if (!processedStationNames.has(station.name)) {
                processedStationNames.add(station.name);
                dynamicRoutes.push({
                    // 駅名はURLエンコードして結合
                    url: `${BASE_URL}/station/${encodeURIComponent(station.name)}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly',
                    priority: 0.8,
                });
            }
        }

        return [...staticRoutes, ...dynamicRoutes];
    } catch (error) {
        console.error("Error generating sitemap:", error);
        // エラー発生時は静的ページだけでもサイトマップとして返す
        return staticRoutes;
    }
}
