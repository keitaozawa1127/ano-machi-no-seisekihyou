import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import iconv from 'iconv-lite';

// 対象ディレクトリ
const TARGET_DIRS = [
    path.join(process.cwd(), 'data', 'stations'),
    path.join(process.cwd(), 'public', 'data', 'stations'),
    path.join(process.cwd(), 'data', 'cache', 'diagnosis')
];

const CSV_FILE_PATH = path.join(process.cwd(), 'data_raw', 'honpyo_2024.csv');
const COORDS_CACHE_FILE = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');

// --- 距離計算（Haversineの公式） ---
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // 地球の半径 (メートル)
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// --- 警察庁の緯度経度フォーマットをWGS84 10進数に変換 ---
function parsePoliceCoord(coordStr: string, isLon: boolean): number | null {
    if (!coordStr || coordStr.trim() === '') return null;
    const cleanStr = coordStr.trim();
    try {
        if (isLon) {
            // 経度: 1412109599 -> 141度 21分 09.599秒
            const deg = parseInt(cleanStr.slice(0, 3), 10);
            const min = parseInt(cleanStr.slice(3, 5), 10);
            const secStr = cleanStr.slice(5);
            const sec = parseInt(secStr.slice(0, 2), 10) + (parseInt(secStr.slice(2), 10) / Math.pow(10, secStr.length - 2));
            return deg + min / 60 + sec / 3600;
        } else {
            // 緯度: 430607590 -> 43度 06分 07.590秒
            const deg = parseInt(cleanStr.slice(0, 2), 10);
            const min = parseInt(cleanStr.slice(2, 4), 10);
            const secStr = cleanStr.slice(4);
            const sec = parseInt(secStr.slice(0, 2), 10) + (parseInt(secStr.slice(2), 10) / Math.pow(10, secStr.length - 2));
            return deg + min / 60 + sec / 3600;
        }
    } catch (e) {
        return null;
    }
}

type StationTarget = {
    filePath: string;
    stationName: string;
    lat: number;
    lon: number;
    accidentCount: number;
    originalData: any;
};

async function main() {
    console.log("=== 交通事故リスク 自動取得・更新スクリプト開始 ===");

    // 1. 座標キャッシュのロード
    let coordsCache: Record<string, { lat: number, lon: number, name: string }> = {};
    if (fs.existsSync(COORDS_CACHE_FILE)) {
        const coordsRaw = fs.readFileSync(COORDS_CACHE_FILE, 'utf-8');
        coordsCache = JSON.parse(coordsRaw);
        console.log(`[OK] 座標キャッシュを読み込みました: ${Object.keys(coordsCache).length} 件`);
    } else {
        console.warn("[WARN] station_coords.json が見つかりませんでした。");
    }

    // 2. 更新対象JSONのロードと座標の特定
    const stationTargets: StationTarget[] = [];
    console.log("--- 対象JSONファイルの探索 ---");

    for (const targetDir of TARGET_DIRS) {
        if (!fs.existsSync(targetDir)) continue;

        try {
            const stats = fs.statSync(targetDir);
            if (!stats.isDirectory()) continue;
        } catch (e) {
            continue;
        }

        const files = fs.readdirSync(targetDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('_v2'));

        for (const file of jsonFiles) {
            const filePath = path.join(targetDir, file);
            let stationName = file.replace('.json', '');
            if (stationName.includes('_')) {
                const parts = stationName.split('_');
                stationName = parts[0];
            }

            try {
                const rawData = fs.readFileSync(filePath, 'utf-8');
                let data = JSON.parse(rawData);

                // 配列型のJSON（public/data/stationsなど）はext構造を持たないためスキップするか検討
                // 要件は「対象JSONの dynamicAdditions 配列へ」なのでオブジェクト型のみを対象とする
                if (Array.isArray(data)) {
                    continue; // pure array -> skip
                }

                let lat: number | undefined;
                let lon: number | undefined;

                lat = data.lat || (data.ext?.hazardRisk?.lat) || (data.extendedMetrics?.hazardRisk?.lat) || (data.debug?.lat);
                lon = data.lon || (data.ext?.hazardRisk?.lon) || (data.extendedMetrics?.hazardRisk?.lon) || (data.debug?.lon);

                if ((typeof lat !== 'number' || typeof lon !== 'number') && coordsCache[stationName]) {
                    lat = coordsCache[stationName].lat;
                    lon = coordsCache[stationName].lon;
                }

                if (typeof lat === 'number' && typeof lon === 'number') {
                    stationTargets.push({
                        filePath,
                        stationName,
                        lat,
                        lon,
                        accidentCount: 0,
                        originalData: data
                    });
                }
            } catch (err: any) {
                console.error(`[ERROR] JSON解析エラー (${file}): ${err.message}`);
            }
        }
    }

    console.log(`[INFO] 処理対象の駅ファイル数: ${stationTargets.length} 件`);

    if (stationTargets.length === 0) {
        console.log("処理対象が見つかりませんでした。終了します。");
        return;
    }

    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`[ERROR] CSVファイルが見つかりません: ${CSV_FILE_PATH}`);
        process.exit(1);
    }

    // 3. CSVのストリーム処理と距離計算
    console.log("--- 交通事故データ（CSV）の読み込み・突き合わせ開始 ---");
    let processedRows = 0;

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(iconv.decodeStream('Shift_JIS'))
            .pipe(csv())
            .on('data', (row) => {
                const latStr = row['地点　緯度（北緯）'];
                const lonStr = row['地点　経度（東経）'];

                if (latStr && lonStr) {
                    const latDec = parsePoliceCoord(latStr, false);
                    const lonDec = parsePoliceCoord(lonStr, true);

                    if (latDec !== null && lonDec !== null && latDec > 20 && latDec < 50 && lonDec > 120 && lonDec < 160) {
                        // 全駅と比較（500m以内ならカウント増）
                        for (let i = 0; i < stationTargets.length; i++) {
                            const dist = getDistance(stationTargets[i].lat, stationTargets[i].lon, latDec, lonDec);
                            if (dist <= 500) {
                                stationTargets[i].accidentCount++;
                            }
                        }
                    }
                }

                processedRows++;
                if (processedRows % 10000 === 0) {
                    console.log(`  ... CSV処理進捗: ${processedRows} 件終了`);
                }
            })
            .on('end', () => {
                console.log(`[OK] CSV読み込み完了。総処理件数: ${processedRows} 件`);
                resolve();
            })
            .on('error', (err) => {
                reject(err);
            });
    });

    // 4. 結果のJSON書き込み
    console.log("--- 評価ロジックの適用とJSONの更新 ---");
    let updatedCount = 0;

    for (const target of stationTargets) {
        const count = target.accidentCount;
        let valueStr = "";
        let scoreImpact = 0;
        let description = "";

        if (count >= 0 && count <= 2) {
            valueStr = `事故リスク低（${count}件）`;
            scoreImpact = 1;
            description = `駅周辺500m圏内で発生した人身事故は年間${count}件であり、交通リスクは低いエリアにあたります。`;
        } else if (count >= 3 && count <= 9) {
            valueStr = `平均的（${count}件）`;
            scoreImpact = 0;
            description = `駅周辺500m圏内で発生した人身事故は年間${count}件であり、標準的な交通リスクのエリアです。`;
        } else {
            valueStr = `事故多発地点あり（${count}件）`;
            scoreImpact = -3;
            description = `駅周辺500m圏内で年間${count}件の人身事故が発生しています。件数が多い場合は自転車や車の通行時に注意が必要です。`;
        }

        const accidentAddition = {
            category: "safety",
            label: "交通事故リスク（半径500m）",
            ruleDescription: description,
            targetMode: ["default", "family"],
            value: valueStr,
            scoreImpact: scoreImpact
        };

        let dataToUpdate = target.originalData;
        if (!dataToUpdate.ext) dataToUpdate.ext = {};
        if (!Array.isArray(dataToUpdate.ext.dynamicAdditions)) {
            dataToUpdate.ext.dynamicAdditions = [];
        }

        const existingIndex = dataToUpdate.ext.dynamicAdditions.findIndex((item: any) => item.label === "交通事故リスク（半径500m）");
        if (existingIndex >= 0) {
            dataToUpdate.ext.dynamicAdditions[existingIndex] = accidentAddition;
        } else {
            dataToUpdate.ext.dynamicAdditions.push(accidentAddition);
        }

        try {
            fs.writeFileSync(target.filePath, JSON.stringify(dataToUpdate, null, 2), 'utf-8');
            updatedCount++;
        } catch (err: any) {
            console.error(`[ERROR] ファイル保存エラー (${target.filePath}): ${err.message}`);
        }
    }

    console.log(`[OK] 全 ${updatedCount} 件のJSONファイルを更新しました。`);
    console.log("=== 処理完了 ===");
}

main().catch(err => {
    console.error(`[FATAL] 予期せぬエラーが発生しました: ${err.message}`);
    process.exit(1);
});
