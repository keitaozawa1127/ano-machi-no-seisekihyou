import fs from 'fs/promises';
import path from 'path';

// ================================================
// 設定
// ================================================
const MISSING_STATIONS_CSV = path.join(process.cwd(), 'missing_stations.txt');
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'diagnosis');
const STATIONS_JSON_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');
const OUTPUT_SUFFIX = '_full_v8.json';

// 都道府県名 → 都道府県コードのマッピング
const PREF_CODE_MAP: Record<string, string> = {
    '北海道': '01', '青森県': '02', '岩手県': '03', '宮城県': '04',
    '秋田県': '05', '山形県': '06', '福島県': '07', '茨城県': '08',
    '栃木県': '09', '群馬県': '10', '埼玉県': '11', '千葉県': '12',
    '東京都': '13', '神奈川県': '14', '新潟県': '15', '富山県': '16',
    '石川県': '17', '福井県': '18', '山梨県': '19', '長野県': '20',
    '岐阜県': '21', '静岡県': '22', '愛知県': '23', '三重県': '24',
    '滋賀県': '25', '京都府': '26', '大阪府': '27', '兵庫県': '28',
    '奈良県': '29', '和歌山県': '30', '鳥取県': '31', '島根県': '32',
    '岡山県': '33', '広島県': '34', '山口県': '35', '徳島県': '36',
    '香川県': '37', '愛媛県': '38', '高知県': '39', '福岡県': '40',
    '佐賀県': '41', '長崎県': '42', '熊本県': '43', '大分県': '44',
    '宮崎県': '45', '鹿児島県': '46', '沖縄県': '47',
};

// ================================================
// ユーティリティ
// ================================================
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

interface StationEntry {
    prefecture: string;
    prefCode: string;
    name: string;
    lines: string[];
}

// ================================================
// missing_stations.txt のパース
// ================================================
async function parseMissingStations(): Promise<StationEntry[]> {
    const raw = await fs.readFile(MISSING_STATIONS_CSV, 'utf-8');
    const lines = raw.split('\n');
    const entries: StationEntry[] = [];

    // 1行目はヘッダー行 "都道府県名,駅名,路線名" なのでスキップ
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV形式: "都道府県名","駅名","路線名"
        const parts = line.match(/"([^"]*)"/g);
        if (!parts || parts.length < 2) {
            console.warn(`[Warn] 行 ${i + 1} のパースに失敗しました: ${line}`);
            continue;
        }

        const prefecture = parts[0].replace(/"/g, '');
        const name = parts[1].replace(/"/g, '');
        const linesRaw = parts[2] ? parts[2].replace(/"/g, '') : '';

        // 路線名を " / " で分割してリスト化
        const stationLines = linesRaw
            ? linesRaw.split(' / ').map(l => l.trim()).filter(l => l.length > 0)
            : [];

        const prefCode = PREF_CODE_MAP[prefecture] || '00';

        entries.push({ prefecture, prefCode, name, lines: stationLines });
    }

    return entries;
}

// ================================================
// public/data/stations.json から座標キャッシュ構築
// ================================================
async function buildCoordsCache(): Promise<Map<string, { lat: number; lon: number }>> {
    const cache = new Map<string, { lat: number; lon: number }>();
    try {
        const raw = await fs.readFile(STATIONS_JSON_PATH, 'utf-8');
        const data = JSON.parse(raw);

        for (const key in data) {
            const s = data[key];
            const stName = s.name || key;
            const coords = s.coordinates;
            if (
                stName &&
                Array.isArray(coords) &&
                coords.length === 2 &&
                typeof coords[0] === 'number' &&
                typeof coords[1] === 'number'
            ) {
                // coordinatesは[lon, lat]の順であることが多い
                const prefCode = s.prefCode || '';
                const cacheKey = `${prefCode}_${stName}`;
                cache.set(cacheKey, { lon: coords[0], lat: coords[1] });
                // prefCodeなしの名前でも登録（フォールバック）
                if (!cache.has(stName)) {
                    cache.set(stName, { lon: coords[0], lat: coords[1] });
                }
            }
        }

        console.log(`[Info] stations.json から ${cache.size} 件の座標をキャッシュしました`);
    } catch (e) {
        console.warn('[Warn] stations.json の読み込みに失敗しました。座標キャッシュは空になります。');
    }
    return cache;
}

// ================================================
// ジオコーディング: HeartRails Geo API
// ジオコーディング失敗時は GSI Nominatim にフォールバック
// ================================================
async function geocodeStation(
    stationName: string,
    prefecture: string
): Promise<{ lat: number; lon: number } | null> {

    // --- 1次試行: HeartRails Geo API ---
    const query = encodeURIComponent(`${stationName}駅`);
    const heartRailsUrl = `https://express.heartrails.com/api/json?method=getStations&name=${query}`;

    try {
        const res = await fetch(heartRailsUrl);
        if (res.ok) {
            const json = await res.json();
            const stations = json?.response?.station;
            if (stations && stations.length > 0) {
                // 都道府県名でフィルタリング（例: "北海道" の場合）
                const prefShort = prefecture.replace(/[都道府県]$/, '');
                const matched = stations.find((st: any) =>
                    st.prefecture && st.prefecture.includes(prefShort)
                );
                const target = matched || stations[0];
                const lat = parseFloat(target.y);
                const lon = parseFloat(target.x);
                if (!isNaN(lat) && !isNaN(lon)) {
                    return { lat, lon };
                }
            }
        }
    } catch (e) {
        console.warn(`  [Warn] HeartRails API エラー (${stationName}): ${e}`);
    }

    // 1次試行後に必ずスリープ
    await sleep(1500);

    // --- 2次試行: 国土地理院 Nominatim (via nominatim.openstreetmap.org) ---
    const nominatimQuery = encodeURIComponent(`${stationName}駅 ${prefecture} 日本`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${nominatimQuery}&format=json&limit=1&accept-language=ja`;

    try {
        const res2 = await fetch(nominatimUrl, {
            headers: { 'User-Agent': 'ano-machi-no-seisekihyou-recovery-script/1.0' }
        });
        if (res2.ok) {
            const json2 = await res2.json();
            if (json2.length > 0) {
                const lat = parseFloat(json2[0].lat);
                const lon = parseFloat(json2[0].lon);
                if (!isNaN(lat) && !isNaN(lon)) {
                    return { lat, lon };
                }
            }
        }
    } catch (e2) {
        console.warn(`  [Warn] Nominatim API エラー (${stationName}): ${e2}`);
    }

    // 2次試行後もスリープ
    await sleep(1500);

    return null;
}

// ================================================
// 生成済みJSONの存在チェック
// ================================================
async function getExistingFiles(): Promise<Set<string>> {
    const set = new Set<string>();
    try {
        const files = await fs.readdir(CACHE_DIR);
        for (const f of files) {
            set.add(f);
        }
    } catch (e) {
        console.error(`[Error] キャッシュディレクトリが読み込めません: ${CACHE_DIR}`);
    }
    return set;
}

// ================================================
// ベースJSONの生成
// ================================================
function buildBaseJson(station: StationEntry, lat: number, lon: number): object {
    return {
        station_name: station.name,
        prefecture: station.prefecture,
        prefCode: station.prefCode,
        lines: station.lines,
        lat,
        lon,
        ext: {
            dynamicAdditions: []
        }
    };
}

// ================================================
// メイン処理
// ================================================
async function main() {
    console.log('==============================================');
    console.log(' 欠損駅リカバリースクリプト (Phase 1: ベースJSON生成)');
    console.log('==============================================\n');

    // 1. 欠損駅リストのパース
    console.log('[Step 1] missing_stations.txt をパース中...');
    const missingStations = await parseMissingStations();
    console.log(`[Step 1] 完了: 欠損駅 ${missingStations.length} 件を抽出\n`);

    // 2. stations.json から座標キャッシュを構築
    console.log('[Step 2] stations.json から座標キャッシュを構築中...');
    const coordsCache = await buildCoordsCache();
    console.log(`[Step 2] 完了\n`);

    // 3. 生成済みJSONファイルの取得
    console.log('[Step 3] 生成済みJSONファイルを確認中...');
    const existingFiles = await getExistingFiles();
    console.log(`[Step 3] 完了: 既存ファイル ${existingFiles.size} 件\n`);

    // 4. バッチ処理（直列）
    console.log('[Step 4] ベースJSON生成バッチ処理を開始します...\n');

    let successCount = 0;
    let geocodedCount = 0;
    let cacheHitCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < missingStations.length; i++) {
        const station = missingStations[i];
        const prefCode = station.prefCode || '00';
        const fileName = `${station.name}_${prefCode}${OUTPUT_SUFFIX}`;
        const filePath = path.join(CACHE_DIR, fileName);

        const progress = `[${i + 1}/${missingStations.length}]`;

        // すでにファイルが存在する場合はスキップ
        if (existingFiles.has(fileName)) {
            console.log(`${progress} [Skip] ${fileName} は既に存在します`);
            skipCount++;
            continue;
        }

        console.log(`${progress} [Processing] ${station.prefecture} / ${station.name} (${station.lines.join(', ')})`);

        // --- 座標取得 ---
        let lat: number | null = null;
        let lon: number | null = null;

        // 1次: stations.json キャッシュから取得（都道府県コード+駅名キー）
        const prefAndNameKey = `${prefCode}_${station.name}`;
        if (coordsCache.has(prefAndNameKey)) {
            const cached = coordsCache.get(prefAndNameKey)!;
            lat = cached.lat;
            lon = cached.lon;
            console.log(`  -> [CacheHit] stations.json から座標取得: lat=${lat}, lon=${lon}`);
            cacheHitCount++;
        } else if (coordsCache.has(station.name)) {
            // 2次: 駅名のみでキャッシュ検索（同名駅の可能性があるが、ベストエフォート）
            const cached = coordsCache.get(station.name)!;
            lat = cached.lat;
            lon = cached.lon;
            console.log(`  -> [CacheHit(name-only)] stations.json から座標取得: lat=${lat}, lon=${lon}`);
            cacheHitCount++;
        } else {
            // 3次: ジオコーディングAPI
            console.log(`  -> [Geocoding] API にてジオコーディング実行中...`);
            const coords = await geocodeStation(station.name, station.prefecture);
            if (coords) {
                lat = coords.lat;
                lon = coords.lon;
                console.log(`  -> [Geocoding OK] lat=${lat}, lon=${lon}`);
                geocodedCount++;
                // ジオコーディング APIを使った場合は必ずスリープ
                await sleep(1500);
            } else {
                console.error(`  -> [Error] ${station.name}（${station.prefecture}）の座標を取得できませんでした。スキップします。`);
                failCount++;
                continue;
            }
        }

        // --- ベースJSON生成・保存 ---
        const baseJson = buildBaseJson(station, lat!, lon!);
        try {
            await fs.writeFile(filePath, JSON.stringify(baseJson, null, 2), 'utf-8');
            console.log(`  -> [Saved] ${fileName}`);
            successCount++;
        } catch (writeErr) {
            console.error(`  -> [Error] ファイル書き込み失敗: ${fileName}: ${writeErr}`);
            failCount++;
        }
    }

    // 5. 最終レポート
    console.log('\n==============================================');
    console.log(' 処理完了 - 最終レポート');
    console.log('==============================================');
    console.log(`  対象総数         : ${missingStations.length} 件`);
    console.log(`  生成成功         : ${successCount} 件`);
    console.log(`    うちキャッシュヒット : ${cacheHitCount} 件`);
    console.log(`    うちジオコーディング : ${geocodedCount} 件`);
    console.log(`  既存ファイルでスキップ: ${skipCount} 件`);
    console.log(`  座標取得失敗でスキップ: ${failCount} 件`);
    console.log('==============================================\n');

    if (failCount > 0) {
        console.error(`[警告] ${failCount} 件の駅の座標を取得できませんでした。手動での確認と補完が必要です。`);
    }
}

main().catch(err => {
    console.error('予期せぬクリティカルエラー:', err);
    process.exit(1);
});
