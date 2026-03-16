import * as fs from 'fs';
import * as path from 'path';

// --- 設定 ---
const APP_STATION_LIST_PATH = path.join(process.cwd(), 'app_station_list.txt');
const CACHE_DIR = path.join(process.cwd(), 'data/cache/diagnosis');
const OUTPUT_FILE_PATH = path.join(process.cwd(), 'missing_stations.txt');
const PREF_CODE_MAP_PATH = path.join(process.cwd(), 'public/data/stations.json'); // prefecture to code mapping fallback

interface StationEntry {
    prefecture: string;
    prefCode: string;
    name: string;
    lines: string;
}

async function runAudit() {
    console.log('--- 欠損駅・網羅性監査スクリプト ---');

    // 1. 都道府県コードのマッピングを取得
    const stationsJsonPath = path.join(process.cwd(), 'public/data/stations.json');
    let prefNameToCode: Record<string, string> = {};
    if (fs.existsSync(stationsJsonPath)) {
        try {
            const rawData = fs.readFileSync(stationsJsonPath, 'utf8');
            const data = JSON.parse(rawData);
            for (const key in data) {
                const s = data[key];
                if (s.prefecture && s.prefCode) {
                    prefNameToCode[s.prefecture] = s.prefCode;
                }
            }
            console.log(`ロード完了: 都道府県コードマッピング (${Object.keys(prefNameToCode).length}県)`);
        } catch (e) {
            console.error('public/data/stations.json の読み込みに失敗しました', e);
        }
    }


    // 2. app_station_list.txt の読み込みとパース
    if (!fs.existsSync(APP_STATION_LIST_PATH)) {
        console.error(`エラー: リストファイルが見つかりません: ${APP_STATION_LIST_PATH}`);
        return;
    }

    const listLines = fs.readFileSync(APP_STATION_LIST_PATH, 'utf8').split('\n');
    const expectedStations: StationEntry[] = [];
    let currentPrefecture = '';

    for (const line of listLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 都道府県ヘッダーの検知
        if (trimmed.startsWith('■')) {
            currentPrefecture = trimmed.replace('■', '').trim();
            continue;
        }

        // 駅行の検知 "・駅名 (路線名)" または "・駅名"
        if (trimmed.startsWith('・')) {
            let namePart = trimmed.replace('・', '').trim();
            let linesPart = '';

            const parenIndex = namePart.indexOf('(');
            if (parenIndex !== -1) {
                linesPart = namePart.slice(parenIndex + 1, namePart.lastIndexOf(')'));
                namePart = namePart.slice(0, parenIndex).trim();
            }

            const prefCode = prefNameToCode[currentPrefecture] || '';

            expectedStations.push({
                prefecture: currentPrefecture,
                prefCode: prefCode,
                name: namePart,
                lines: linesPart
            });
        }
    }

    console.log(`リストパース完了: 全 ${expectedStations.length} 駅を検出`);

    // 3. 生成済みJSONファイルの走査
    if (!fs.existsSync(CACHE_DIR)) {
        console.error(`エラー: キャッシュディレクトリが見つかりません: ${CACHE_DIR}`);
        return;
    }

    const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    console.log(`キャッシュディレクトリ走査: ${cacheFiles.length} 件のJSONファイルを検出`);

    // キャッシュファイルの情報をパース (駅名と都道府県コード)
    // ファイル名フォーマット例: 郡山_07_full_v8.json -> name="郡山", prefCode="07"
    const generatedCacheSet = new Set<string>();

    for (const file of cacheFiles) {
        // 正規表現で「駅名_都道府県コード」を抽出。"_"の区切りを想定
        const match = file.match(/^(.+?)_(\d{2})_/);
        if (match) {
            const stationName = match[1];
            const prefCode = match[2];
            // Setには "駅名_コード" の形で保存して一意性を担保
            generatedCacheSet.add(`${stationName}_${prefCode}`);
        } else {
            // 命名規則が異なる場合は、純粋な駅名部分だけでフォールバック
            const nameOnlyMatch = file.match(/^(.+?)_/);
            if (nameOnlyMatch) {
                generatedCacheSet.add(nameOnlyMatch[1]);
            }
        }
    }


    // 4. 突き合わせと欠損の抽出
    const missingStations: StationEntry[] = [];

    let matchCount = 0;

    for (const expected of expectedStations) {
        // 完全マッチングキー (駅名_都道府県コード)
        const fullKey = `${expected.name}_${expected.prefCode}`;
        const nameOnlyKey = expected.name;

        if (generatedCacheSet.has(fullKey)) {
            matchCount++;
        } else if (generatedCacheSet.has(nameOnlyKey)) {
            // ファイル名に県コードが無いが駅名で一致した場合（古いフォーマット等の可能性）
            matchCount++;
        } else {
            // どちらにも無い場合は欠損
            missingStations.push(expected);
        }
    }

    console.log(`照合結果: 生成済み ${matchCount} 駅 / 欠損 ${missingStations.length} 駅`);

    // 5. 欠損リストのファイル出力 (CSV形式)
    const exportLines = ['都道府県名,駅名,路線名'];
    for (const missing of missingStations) {
        // CSVエスケープ処理
        const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
        exportLines.push(`${escapeCsv(missing.prefecture)},${escapeCsv(missing.name)},${escapeCsv(missing.lines)}`);
    }

    fs.writeFileSync(OUTPUT_FILE_PATH, exportLines.join('\n'), 'utf8');
    console.log(`\n✅ 欠損駅一覧を以下のファイルに出力しました:`);
    console.log(OUTPUT_FILE_PATH);
}

runAudit().catch(console.error);
