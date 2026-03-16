import * as fs from 'fs';
import * as path from 'path';
import * as shapefile from 'shapefile';

// 距離計算用（Haversine式、算出単位はメートル）
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

interface Shelter {
    name: string;
    lat: number;
    lng: number;
}

async function loadShelters(): Promise<Shelter[]> {
    const rawDir = path.join(process.cwd(), 'data_raw', 'evacuation_data');
    const shelters: Shelter[] = [];

    if (!fs.existsSync(rawDir)) {
        console.warn(`[WARN] 避難所データディレクトリ ${rawDir} が見つかりません。新規作成します。`);
        fs.mkdirSync(rawDir, { recursive: true });
        return shelters;
    }

    const files = fs.readdirSync(rawDir);
    const shpFiles = files.filter(f => f.endsWith('.shp'));

    for (const shpFile of shpFiles) {
        const baseName = path.basename(shpFile, '.shp');
        const shpPath = path.join(rawDir, shpFile);
        const dbfPath = path.join(rawDir, `${baseName}.dbf`);

        if (!fs.existsSync(dbfPath)) {
            console.warn(`[WARN] ${shpFile} に対応する .dbf ファイルがありません。スキップします。`);
            continue;
        }

        console.log(`[INFO] 読み込み中: ${shpFile}`);

        try {
            const source = await shapefile.open(shpPath, dbfPath, { encoding: 'shift-jis' });
            let result = await source.read();
            while (!result.done) {
                const feature = result.value;
                const properties = feature.properties;
                const geometry = feature.geometry;

                if (properties && geometry && geometry.type === 'Point') {
                    // 国土交通省P20データの仕様に合わせて施設名を取得
                    const name = properties.P20_002 || properties.P20_005 || properties.P20_003 || '名称不明';
                    // GeometryがPointの場合は [lng, lat] となる
                    const lng = geometry.coordinates[0];
                    const lat = geometry.coordinates[1];
                    shelters.push({ name, lat, lng });
                }
                result = await source.read();
            }
        } catch (err) {
            console.error(`[ERROR] ${shpFile} の読み込みに失敗しました:`, err);
        }
    }

    return shelters;
}

async function main() {
    console.log('=== 避難所データ バッチ処理開始 ===');
    const shelters = await loadShelters();
    console.log(`[INFO] 合計 ${shelters.length} 件の避難所データを読み込み完了しました。`);

    if (shelters.length === 0) {
        console.warn('[WARN] 避難所データが0件のため、処理を終了します。');
        return;
    }

    // キャッシュから座標をロード
    const coordsCacheFile = path.join(process.cwd(), 'data', 'cache', 'station_coords.json');
    let coordsCache: Record<string, { lat: number; lon: number; name: string }> = {};
    try {
        const coordsRaw = fs.readFileSync(coordsCacheFile, 'utf-8');
        coordsCache = JSON.parse(coordsRaw);
        console.log(`[INFO] 座標キャッシュを読み込みました: ${Object.keys(coordsCache).length} 件`);
    } catch {
        console.warn("[WARN] station_coords.json が読み込めませんでした。");
    }

    const dirs = [
        path.join(process.cwd(), 'data', 'stations'),
        path.join(process.cwd(), 'public', 'data', 'stations'),
        path.join(process.cwd(), 'data', 'cache', 'diagnosis') // 実際のJSONがあるキャッシュディレクトリも対象にする
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            console.log(`[INFO] ディレクトリ ${dir} は存在しないためスキップします。`);
            continue;
        }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('_v2'));

        for (const file of files) {
            const filePath = path.join(dir, file);
            // ファイル名から駅名を推定 (例: "新宿_13_full_v8.json" -> "新宿")
            let stationName = file.replace('.json', '');
            if (stationName.includes('_')) {
                stationName = stationName.split('_')[0];
            }

            try {
                const jsonText = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(jsonText);

                let lat: number | undefined;
                let lng: number | undefined;

                // 配列（例：再開発プロジェクトのリスト）の場合はスキップ
                if (Array.isArray(data)) {
                    continue;
                }

                // 様々な構造から座標を抽出
                lat = data.location?.lat || data.lat || data.ext?.hazardRisk?.lat || data.extendedMetrics?.hazardRisk?.lat || data.debug?.lat;
                lng = data.location?.lng || data.lon || data.ext?.hazardRisk?.lon || data.extendedMetrics?.hazardRisk?.lon || data.debug?.lon;

                // キャッシュにフォールバック
                if ((typeof lat !== 'number' || typeof lng !== 'number') && coordsCache[stationName]) {
                    lat = coordsCache[stationName].lat;
                    lng = coordsCache[stationName].lon;
                }

                if (typeof lat !== 'number' || typeof lng !== 'number') {
                    // 座標が取得できない場合はスキップ（ログに出力すると多いので省略）
                    continue;
                }

                // 1km圏内の避難所をカウント
                const nearbyShelters = shelters.filter(s => getDistance(lat as number, lng as number, s.lat, s.lng) <= 1000);
                const count = nearbyShelters.length;
                const representativeName = count > 0 ? nearbyShelters[0].name : '';

                // 判定ロジック
                let entryValue = '';
                let scoreImpact = 0;
                let ruleDescription = '';

                if (count === 0) {
                    entryValue = '避難所アクセス懸念';
                    scoreImpact = -3;
                    ruleDescription = '駅周辺1km圏内に指定避難所が確認できず、災害時のアクセスに懸念があります。';
                } else if (count >= 1 && count <= 2) {
                    entryValue = `標準的（${count}件）`;
                    scoreImpact = 0;
                    ruleDescription = `駅周辺1km圏内に標準的な数の避難所（「${representativeName}」など${count}件）が確保されています。`;
                } else {
                    entryValue = `充実（${count}件）`;
                    scoreImpact = 2; // +2
                    ruleDescription = `駅周辺1km圏内に${count}件の指定避難所（「${representativeName}」など）があり、災害時の受け入れ体制が充実しています。`;
                }

                // dynamicAdditionsの用意
                const newAddition = {
                    category: 'safety',
                    label: '避難所アクセス（半径1km）',
                    value: entryValue,
                    scoreImpact: scoreImpact,
                    ruleDescription: ruleDescription,
                    targetMode: ['default', 'family']
                };

                let updated = false;

                // 保存先（dynamicAdditions または ext.dynamicAdditions）
                if (data.dynamicAdditions) {
                    const arr = data.dynamicAdditions;
                    const idx = arr.findIndex((add: { label: string }) => add.label === newAddition.label);
                    if (idx >= 0) arr[idx] = newAddition;
                    else arr.push(newAddition);
                    updated = true;
                } else if (data.ext !== undefined || dir.includes('cache')) {
                    if (!data.ext) data.ext = {};
                    if (!Array.isArray(data.ext.dynamicAdditions)) data.ext.dynamicAdditions = [];
                    const arr = data.ext.dynamicAdditions;
                    const idx = arr.findIndex((add: { label: string }) => add.label === newAddition.label);
                    if (idx >= 0) arr[idx] = newAddition;
                    else arr.push(newAddition);
                    updated = true;
                } else {
                    // フォールバック
                    data.dynamicAdditions = [newAddition];
                    updated = true;
                }

                if (updated) {
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                    console.log(`[DONE] ${file} (${stationName}) - 避難所: ${count}件, Impact: ${scoreImpact > 0 ? '+' + scoreImpact : scoreImpact}`);
                }

            } catch (err) {
                console.error(`[ERROR] ${filePath} の処理中にエラーが発生しました:`, err);
            }
        }
    }

    console.log('=== 全処理完了 ===');
}

main().catch(err => {
    console.error('[FATAL] 予期せぬエラー:', err);
});
