import fs from 'fs/promises';
import path from 'path';

// J-SHIS API endpoint
const BASE_URL = 'https://www.j-shis.bosai.go.jp/map/api/sstrct/V2/meshinfo.geojson';

// スキップ判定に使用するラベル
const TARGET_LABEL = '地盤の強さ（表層地盤増幅率）';

// Sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("=== 表層地盤増幅率（ARV）自動取得・更新スクリプト開始（差分更新モード） ===");

    // --- 座標キャッシュの読み込み ---
    const coordsCacheFile = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');
    let coordsCache: Record<string, any> = {};
    try {
        const coordsRaw = await fs.readFile(coordsCacheFile, 'utf-8');
        coordsCache = JSON.parse(coordsRaw);
        console.log(`座標キャッシュを読み込みました: ${Object.keys(coordsCache).length} 件`);
    } catch (e) {
        console.warn("警告: station_coords.json が読み込めませんでした。座標フォールバックは無効になります。");
    }

    // --- 対象ディレクトリの指定 ---
    const targetDirs = [
        path.join(process.cwd(), 'data', 'cache', 'diagnosis')
    ];

    console.log(`対象ディレクトリ: ${targetDirs.join(', ')}`);

    // 集計カウンター
    let skipCount = 0;
    let successCount = 0;
    let noCoordCount = 0;
    let errorCount = 0;
    let noArvCount = 0;

    for (const targetDir of targetDirs) {
        console.log(`\n--- ディレクトリ処理中: ${targetDir} ---`);
        let files: string[] = [];
        try {
            files = await fs.readdir(targetDir);
        } catch (e) {
            console.warn(`警告: ${targetDir} を読み込めませんでした。`);
            continue;
        }

        // _v2 サフィックスを含む巨大ファイルは除外
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('_v2'));
        console.log(`処理対象ファイル数: ${jsonFiles.length} 件`);

        for (const file of jsonFiles) {
            const filePath = path.join(targetDir, file);

            // ファイル名から駅名を推定
            // 命名規則: "新宿_13_full_v8.json" -> stationName = "新宿"
            let stationName = file.replace('.json', '');
            if (stationName.includes('_')) {
                const parts = stationName.split('_');
                stationName = parts[0];
            }

            try {
                const rawData = await fs.readFile(filePath, 'utf-8');
                let data = JSON.parse(rawData);

                // ===================================================
                // 【差分スキップ判定】
                // ext.dynamicAdditions に既に対象ラベルが存在する場合はスキップ
                // ===================================================
                if (
                    !Array.isArray(data) &&
                    data.ext &&
                    Array.isArray(data.ext.dynamicAdditions) &&
                    data.ext.dynamicAdditions.some((item: any) => item.label === TARGET_LABEL)
                ) {
                    console.log(`[Skip] ${stationName}: 既にデータが存在します`);
                    skipCount++;
                    continue;
                }

                // --- 座標の取得 ---
                let lat: number | undefined;
                let lon: number | undefined;

                // 1次: JSONファイル内から直接座標を探す
                if (!Array.isArray(data)) {
                    lat = data.lat
                        ?? data.ext?.hazardRisk?.lat
                        ?? data.extendedMetrics?.hazardRisk?.lat
                        ?? data.debug?.lat;
                    lon = data.lon
                        ?? data.ext?.hazardRisk?.lon
                        ?? data.extendedMetrics?.hazardRisk?.lon
                        ?? data.debug?.lon;
                }

                // 2次: station_coords.json キャッシュへのフォールバック
                if ((typeof lat !== 'number' || typeof lon !== 'number') && coordsCache[stationName]) {
                    lat = coordsCache[stationName].lat;
                    lon = coordsCache[stationName].lon;
                }

                // 座標が取得できなかった場合はスキップ
                if (typeof lat !== 'number' || typeof lon !== 'number') {
                    console.log(`- [Skip] ${file} (駅名推定: ${stationName}): 座標が見つかりません`);
                    noCoordCount++;
                    continue;
                }

                // --- J-SHIS API へのリクエスト ---
                const apiUrl = `${BASE_URL}?position=${lon},${lat}&epsg=4326`;
                console.log(`> [Fetch] ${file} (${stationName}) (lon:${lon}, lat:${lat})`);

                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }

                const geoJson = await response.json();

                // ARVデータが取得できたか確認
                if (
                    !geoJson.features ||
                    geoJson.features.length === 0 ||
                    !geoJson.features[0].properties ||
                    geoJson.features[0].properties.ARV === undefined
                ) {
                    console.log(`  -> [Warn] ${file}: ARVデータが取得できませんでした`);
                    noArvCount++;
                } else {
                    const arvRaw = geoJson.features[0].properties.ARV;
                    const arv = parseFloat(arvRaw);
                    const arvStr = arv.toFixed(2);

                    // --- スコアリングロジック ---
                    let valueStr = "";
                    let scoreImpact = 0;
                    let description = "";

                    if (arv < 1.4) {
                        valueStr = `${arvStr}（強い）`;
                        scoreImpact = 2;
                        description = `表層地盤増幅率が${arvStr}であり、地震時に揺れが増幅されにくい比較的強固な地盤エリアに該当します。`;
                    } else if (arv >= 1.4 && arv < 1.6) {
                        valueStr = `${arvStr}（普通）`;
                        scoreImpact = 0;
                        description = `表層地盤増幅率が${arvStr}であり、標準的な地盤の強さを持つエリアに該当します。`;
                    } else if (arv >= 1.6 && arv < 2.0) {
                        valueStr = `${arvStr}（弱い）`;
                        scoreImpact = -3;
                        description = `表層地盤増幅率が${arvStr}であり、地震時に揺れが大きくなりやすい軟弱地盤エリアに該当します。`;
                    } else {
                        valueStr = `${arvStr}（非常に弱い）`;
                        scoreImpact = -5;
                        description = `表層地盤増幅率が${arvStr}であり、地震時に揺れが極めて大きくなりやすい非常に軟弱な地盤エリアに該当します。`;
                    }

                    const groundAddition = {
                        category: "safety",
                        label: TARGET_LABEL,
                        ruleDescription: description,
                        targetMode: ["default", "asset"],
                        value: valueStr,
                        scoreImpact: scoreImpact
                    };

                    // --- dynamicAdditions への追加または上書き ---
                    if (!Array.isArray(data)) {
                        if (!data.ext) data.ext = {};
                        if (!Array.isArray(data.ext.dynamicAdditions)) {
                            data.ext.dynamicAdditions = [];
                        }

                        const existingIndex = data.ext.dynamicAdditions.findIndex(
                            (item: any) => item.label === TARGET_LABEL
                        );

                        if (existingIndex >= 0) {
                            data.ext.dynamicAdditions[existingIndex] = groundAddition;
                            console.log(`  -> [Update] ARV=${arvStr}, Impact=${scoreImpact}`);
                        } else {
                            data.ext.dynamicAdditions.push(groundAddition);
                            console.log(`  -> [Add] ARV=${arvStr}, Impact=${scoreImpact}`);
                        }

                        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
                        console.log(`  -> [Saved] ${file}`);
                        successCount++;
                    }
                }

                // API呼び出し後は必ず1.5秒のスリープ
                await sleep(1500);

            } catch (err: any) {
                console.error(`- [Error] ${file} の処理中にエラーが発生しました: ${err.message}`);
                errorCount++;
                // エラー時も一定時間待機してから次へ
                await sleep(1500);
            }
        }
    }

    // --- 最終レポート ---
    console.log("\n==============================================");
    console.log(" 処理完了 - 最終レポート（差分更新モード）");
    console.log("==============================================");
    console.log(`  ARV取得・更新成功         : ${successCount} 件`);
    console.log(`  スキップ（既存データあり）  : ${skipCount} 件`);
    console.log(`  スキップ（座標なし）        : ${noCoordCount} 件`);
    console.log(`  ARV取得失敗（データなし）   : ${noArvCount} 件`);
    console.log(`  エラー発生                  : ${errorCount} 件`);
    console.log("==============================================");
}

main().catch(err => {
    console.error("予期せぬエラーが発生しました:", err);
    process.exit(1);
});
