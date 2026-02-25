// ランダムサンプリング検証スクリプト
const fs = require('fs');

// 駅名正規化関数（SearchFormと同じロジック）
function normalizeStationName(name) {
    let normalized = name.replace(/\([^)]*\)/g, '');
    normalized = normalized.replace(/（[^）]*）/g, '');
    normalized = normalized.trim();
    return normalized;
}

async function verifySearchLogic() {
    console.log('='.repeat(60));
    console.log('検索ロジック ランダムサンプリング検証');
    console.log('='.repeat(60));

    // stations.jsonを読み込み
    const stationsData = JSON.parse(fs.readFileSync('./public/data/stations.json', 'utf8'));
    const allStations = Object.entries(stationsData).map(([key, station]) => ({
        key,
        ...station,
        prefCode: String(station.prefCode || "").padStart(2, '0')
    }));

    console.log(`\n総駅数: ${allStations.length}駅\n`);

    // 都道府県別にグループ化
    const stationsByPref = {};
    allStations.forEach(station => {
        if (!stationsByPref[station.prefCode]) {
            stationsByPref[station.prefCode] = [];
        }
        stationsByPref[station.prefCode].push(station);
    });

    const prefCodes = Object.keys(stationsByPref).filter(code => code !== "00");
    console.log(`都道府県数: ${prefCodes.length}\n`);

    // ランダムに5つの都道府県を選出
    const selectedPrefCodes = [];
    while (selectedPrefCodes.length < 5 && selectedPrefCodes.length < prefCodes.length) {
        const randomPrefCode = prefCodes[Math.floor(Math.random() * prefCodes.length)];
        if (!selectedPrefCodes.includes(randomPrefCode)) {
            selectedPrefCodes.push(randomPrefCode);
        }
    }

    console.log('【ランダム選出された5都道府県】');
    selectedPrefCodes.forEach((code, idx) => {
        const stationCount = stationsByPref[code].length;
        console.log(`${idx + 1}. prefCode: ${code} (${stationCount}駅)`);
    });
    console.log('');

    // 各都道府県から1駅ずつランダム選出
    const testStations = selectedPrefCodes.map(prefCode => {
        const stations = stationsByPref[prefCode];
        const randomStation = stations[Math.floor(Math.random() * stations.length)];
        return randomStation;
    });

    console.log('='.repeat(60));
    console.log('検証開始');
    console.log('='.repeat(60));

    testStations.forEach((station, idx) => {
        console.log(`\n【テスト ${idx + 1}/5】`);
        console.log('-'.repeat(60));

        // 1. 元データ表示
        console.log(`元の駅名: "${station.name}"`);
        console.log(`都道府県コード: "${station.prefCode}"`);
        console.log(`路線: ${station.lines ? JSON.stringify(station.lines) : 'なし'}`);

        // 2. 正規化処理
        const normalized = normalizeStationName(station.name);
        console.log(`\n✓ 正規化後: "${normalized}"`);

        if (normalized !== station.name) {
            console.log(`  (削除された文字: "${station.name.replace(normalized, '')}")`);
        }

        // 3. 都道府県名の解決
        const PREFECTURES = [
            { code: "01", name: "北海道" },
            { code: "13", name: "東京都" },
            { code: "14", name: "神奈川県" },
            { code: "27", name: "大阪府" },
            // 他の都道府県は省略（実際のPREFECTURESから取得）
        ];

        const pref = PREFECTURES.find(p => p.code === station.prefCode);
        const prefName = pref?.name || station.prefecture || `不明(code:${station.prefCode})`;
        console.log(`\n✓ 都道府県名: "${prefName}"`);

        // 4. APIリクエストのシミュレーション
        console.log(`\n✓ APIリクエスト想定:`);
        console.log(`  URL: /api/diagnose?station=${encodeURIComponent(normalized)}&pref=${station.prefCode}`);

        // 5. サジェスト表示形式
        const primaryLine = station.lines && station.lines.length > 0 ? station.lines[0] : "";
        console.log(`\n✓ サジェスト表示形式:`);
        console.log(`  駅名: ${station.name}`);
        console.log(`  詳細: ${prefName}${primaryLine ? ` • ${primaryLine}` : ''}`);

        console.log('-'.repeat(60));
    });

    console.log('\n' + '='.repeat(60));
    console.log('検証完了');
    console.log('='.repeat(60));
    console.log('\n【確認項目】');
    console.log('✓ 駅名正規化: 括弧書きが正しく削除されているか');
    console.log('✓ prefCode型統一: 2桁の文字列に統一されているか');
    console.log('✓ 都道府県名解決: undefinedにならず正しく取得できているか');
    console.log('✓ サジェスト表示: 都道府県・路線名が併記されているか');
}

verifySearchLogic().catch(console.error);
