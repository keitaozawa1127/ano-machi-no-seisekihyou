const fs = require('fs');
const path = require('path');

/**
 * 100駅ランダム検証スクリプト
 * prefName、tradeCount、絵文字排除を検証
 */

const PREFECTURES = [
    { code: "01", name: "北海道" }, { code: "02", name: "青森県" }, { code: "03", name: "岩手県" }, { code: "04", name: "宮城県" },
    { code: "05", name: "秋田県" }, { code: "06", name: "山形県" }, { code: "07", name: "福島県" }, { code: "08", name: "茨城県" },
    { code: "09", name: "栃木県" }, { code: "10", name: "群馬県" }, { code: "11", name: "埼玉県" }, { code: "12", name: "千葉県" },
    { code: "13", name: "東京都" }, { code: "14", name: "神奈川県" }, { code: "15", name: "新潟県" }, { code: "16", name: "富山県" },
    { code: "17", name: "石川県" }, { code: "18", name: "福井県" }, { code: "19", name: "山梨県" }, { code: "20", name: "長野県" },
    { code: "21", name: "岐阜県" }, { code: "22", name: "静岡県" }, { code: "23", name: "愛知県" }, { code: "24", name: "三重県" },
    { code: "25", name: "滋賀県" }, { code: "26", name: "京都府" }, { code: "27", name: "大阪府" }, { code: "28", name: "兵庫県" },
    { code: "29", name: "奈良県" }, { code: "30", name: "和歌山県" }, { code: "31", name: "鳥取県" }, { code: "32", name: "島根県" },
    { code: "33", name: "岡山県" }, { code: "34", name: "広島県" }, { code: "35", name: "山口県" }, { code: "36", name: "徳島県" },
    { code: "37", name: "香川県" }, { code: "38", name: "愛媛県" }, { code: "39", name: "高知県" }, { code: "40", name: "福岡県" },
    { code: "41", name: "佐賀県" }, { code: "42", name: "長崎県" }, { code: "43", name: "熊本県" }, { code: "44", name: "大分県" },
    { code: "45", name: "宮崎県" }, { code: "46", name: "鹿児島県" }, { code: "47", name: "沖縄県" }
];

// 絵文字検出用の正規表現
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

async function verifyFixes() {
    console.log('🔍 100駅ランダム検証開始');
    console.log('='.repeat(100));

    const sourcePath = path.join(process.cwd(), 'public/data/stations.json');

    if (!fs.existsSync(sourcePath)) {
        console.error('❌ stations.json が見つかりません');
        process.exit(1);
    }

    console.log('📖 データを読み込み中...');
    const rawData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const allStations = Object.entries(rawData).map(([key, station]) => ({ key, ...station }));

    console.log(`総駅数: ${allStations.length}`);

    // ランダムに100駅を選出
    const sampleSize = Math.min(100, allStations.length);
    const randomSample = [];
    const usedIndices = new Set();

    while (randomSample.length < sampleSize) {
        const randomIndex = Math.floor(Math.random() * allStations.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            randomSample.push(allStations[randomIndex]);
        }
    }

    console.log(`\nランダム抽出完了: ${sampleSize}駅`);
    console.log('='.repeat(100));

    let passCount = 0;
    let failCount = 0;
    const errors = [];

    randomSample.forEach((station, idx) => {
        const testNumber = idx + 1;
        let passed = true;
        const issues = [];

        // 検証1: prefNameが正しいか
        const prefCode = String(station.prefCode || '').padStart(2, '0');
        const expectedPref = PREFECTURES.find(p => p.code === prefCode);

        if (!expectedPref) {
            issues.push(`prefCode="${prefCode}"が無効`);
            passed = false;
        } else if (station.prefecture && station.prefecture !== expectedPref.name) {
            issues.push(`prefecture不一致: "${station.prefecture}" vs "${expectedPref.name}"`);
            passed = false;
        }

        // 検証2: tradeCountがnumber型で存在するか
        if (typeof station.tradeCount !== 'number') {
            issues.push(`tradeCount型エラー: ${typeof station.tradeCount}`);
            passed = false;
        } else if (station.tradeCount < 0) {
            issues.push(`tradeCountが負の値: ${station.tradeCount}`);
            passed = false;
        }

        // 検証3: 絵文字が含まれていないか
        const textToCheck = `${station.name} ${station.prefecture || ''} ${(station.lines || []).join('')}`;
        if (EMOJI_REGEX.test(textToCheck)) {
            issues.push(`絵文字検出: ${textToCheck.match(EMOJI_REGEX)?.[0]}`);
            passed = false;
        }

        if (passed) {
            passCount++;
            console.log(`[${testNumber}/100] ✅ ${station.name} (${expectedPref?.name}) tradeCount=${station.tradeCount}`);
        } else {
            failCount++;
            console.log(`[${testNumber}/100] ❌ ${station.name} - ${issues.join(', ')}`);
            errors.push({ station: station.name, issues });
        }
    });

    console.log('='.repeat(100));
    console.log('📊 検証結果サマリー');
    console.log('='.repeat(100));
    console.log(`合格: ${passCount}/${sampleSize}`);
    console.log(`不合格: ${failCount}/${sampleSize}`);
    console.log(`合格率: ${(passCount / sampleSize * 100).toFixed(1)}%`);

    if (failCount > 0) {
        console.log('\n❌  不合格の詳細:');
        errors.forEach((err, idx) => {
            console.log(`  ${idx + 1}. ${err.station}:`);
            err.issues.forEach(issue => console.log(`     - ${issue}`));
        });
        console.log('\n結果: FAIL');
    } else {
        console.log('\n✨ 全ての検証をパスしました!');
        console.log('結果: PASS');
    }

    console.log('='.repeat(100));
}

verifyFixes().catch(console.error);
