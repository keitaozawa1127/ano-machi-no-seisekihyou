import fs from "fs";
import path from "path";

// サーバーサイドでのみ使用する想定
export function getStationList(): string[] {
    try {
        const filePath = path.join(process.cwd(), "data", "stations.json");
        // ファイルがない場合や読み込みエラー時は空配列を返す（クラッシュ防止）
        if (!fs.existsSync(filePath)) return [];

        const raw = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(raw);

        return Object.keys(json);
    } catch (e) {
        console.error("Failed to load stations data:", e);
        return [];
    }
}
