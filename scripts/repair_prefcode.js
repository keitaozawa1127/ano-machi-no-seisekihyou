const fs = require('fs');
const path = require('path');

/**
 * Station Data Repair Script
 * Fixes prefCode contamination in station_master.json
 */

// 都道府県定数
const PREFECTURES = [
    { code: "01", name: "北海道" },
    { code: "02", name: "青森県" },
    { code: "03", name: "岩手県" },
    { code: "04", name: "宮城県" },
    { code: "05", name: "秋田県" },
    { code: "06", name: "山形県" },
    { code: "07", name: "福島県" },
    { code: "08", name: "茨城県" },
    { code: "09", name: "栃木県" },
    { code: "10", name: "群馬県" },
    { code: "11", name: "埼玉県" },
    { code: "12", name: "千葉県" },
    { code: "13", name: "東京都" },
    { code: "14", name: "神奈川県" },
    { code: "15", name: "新潟県" },
    { code: "16", name: "富山県" },
    { code: "17", name: "石川県" },
    { code: "18", name: "福井県" },
    { code: "19", name: "山梨県" },
    { code: "20", name: "長野県" },
    { code: "21", name: "岐阜県" },
    { code: "22", name: "静岡県" },
    { code: "23", name: "愛知県" },
    { code: "24", name: "三重県" },
    { code: "25", name: "滋賀県" },
    { code: "26", name: "京都府" },
    { code: "27", name: "大阪府" },
    { code: "28", name: "兵庫県" },
    { code: "29", name: "奈良県" },
    { code: "30", name: "和歌山県" },
    { code: "31", name: "鳥取県" },
    { code: "32", name: "島根県" },
    { code: "33", name: "岡山県" },
    { code: "34", name: "広島県" },
    { code: "35", name: "山口県" },
    { code: "36", name: "徳島県" },
    { code: "37", name: "香川県" },
    { code: "38", name: "愛媛県" },
    { code: "39", name: "高知県" },
    { code: "40", name: "福岡県" },
    { code: "41", name: "佐賀県" },
    { code: "42", name: "長崎県" },
    { code: "43", name: "熊本県" },
    { code: "44", name: "大分県" },
    { code: "45", name: "宮崎県" },
    { code: "46", name: "鹿児島県" },
    { code: "47", name: "沖縄県" }
];

// 路線→都道府県の正しいマッピング辞書
const LINE_TO_PREFECTURE = {
    // 神奈川県 (14)
    '東急東横線': '14',
    'JR湘南新宿ライン': '14',
    'JR横須賀線': '14',
    'JR相模線': '14',
    'JR御殿場線': '14',
    'JR南武線': '14',
    '相鉄本線': '14',
    '相鉄いずみ野線': '14',
    '京急本線': '14',
    '東急目黒線': '14',
    '横浜市ブルーライン': '14',
    'みなとみらい線': '14',
    '小田急江ノ島線': '14',
    '小田急小田原線': '14',
    '金沢シーサイドライン': '14',
    '相鉄・JR直通線': '14',

    // 東京都 (13)
    'JR山手線': '13',
    'JR中央線': '13',
    'JR総武線': '13',
    'JR京浜東北線': '13',
    '東京メトロ銀座線': '13',
    '東京メトロ丸ノ内線': '13',
    '東京メトロ日比谷線': '13',
    '東京メトロ東西線': '13',
    '東京メトロ千代田線': '13',
    '東京メトロ有楽町線': '13',
    '東京メトロ半蔵門線': '13',
    '東京メトロ南北線': '13',
    '東京メトロ副都心線': '13',
    '都営浅草線': '13',
    '都営三田線': '13',
    '都営新宿線': '13',
    '都営大江戸線': '13',
    '東急田園都市線': '13',
    '京王線': '13',
    '小田急線': '13',
    'ゆりかもめ': '13',

    // 埼玉県 (11)
    'JR高崎線': '11',
    'JR埼京線': '11',
    'JR川越線': '11',
    '東武東上線': '11',
    '東武伊勢崎線': '11',
    '西武池袋線': '11',
    '西武新宿線': '11',
    '埼玉高速鉄道線': '11',

    // 大阪府 (27)
    'JR大阪環状線': '27',
    '大阪メトロ御堂筋線': '27',
    '大阪メトロ谷町線': '27',
    '大阪メトロ四つ橋線': '27',
    '大阪メトロ中央線': '27',
    '阪急京都線': '27',
    '阪急宝塚線': '27',
    '阪急神戸線': '27',
    '阪神本線': '27',
    '南海本線': '27',
    '南海高野線': '27',
    '近鉄大阪線': '27',
};

// 駅名→都道府県の直接マッピング
const STATION_TO_PREFECTURE = {
    '武蔵小杉': '14', '横浜': '14', '新横浜': '14', '川崎': '14',
    '鎌倉': '14', '藤沢': '14', '小田原': '14', '厚木': '14',
    '海老名': '14', '相模大野': '14', '本厚木': '14', '大和': '14',

    '東京': '13', '新宿': '13', '渋谷': '13', '池袋': '13',
    '上野': '13', '品川': '13', '新橋': '13', '秋葉原': '13',

    '浦和': '11', '大宮': '11', '川口': '11', '川越': '11', '所沢': '11',

    '梅田': '27', '難波': '27', '天王寺': '27', '京橋': '27', '心斎橋': '27',
};

async function repairStationData() {
    console.log('🔧 駅データ修復スクリプト開始');
    console.log('='.repeat(80));

    const sourcePath = path.join(process.cwd(), 'public/data/station_master.json');

    if (!fs.existsSync(sourcePath)) {
        console.error('❌ station_master.json が見つかりません');
        process.exit(1);
    }

    console.log('📖 既存データを読み込み中...');
    const rawData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    const totalStations = Object.keys(rawData).length;
    console.log(`総駅数: ${totalStations}`);

    let repairedCount = 0;
    let unchangedCount = 0;
    const repairLog = [];

    Object.entries(rawData).forEach(([key, station]) => {
        const originalPrefCode = String(station.prefCode || '').padStart(2, '0');
        let newPrefCode = originalPrefCode;
        let repairReason = '';

        // 修復ロジック1: 駅名直接マッピング
        if (STATION_TO_PREFECTURE[station.name]) {
            newPrefCode = STATION_TO_PREFECTURE[station.name];
            repairReason = '駅名直接マッピング';
        }
        // 修復ロジック2: 路線名マッピング（最初の路線を使用）
        else if (Array.isArray(station.lines) && station.lines.length > 0) {
            const primaryLine = station.lines[0];
            if (LINE_TO_PREFECTURE[primaryLine]) {
                newPrefCode = LINE_TO_PREFECTURE[primaryLine];
                repairReason = `路線マッピング (${primaryLine})`;
            }
        }

        // prefCodeを更新
        if (newPrefCode !== originalPrefCode) {
            const prefName = PREFECTURES.find(p => p.code === newPrefCode)?.name || '不明';
            const oldPrefName = PREFECTURES.find(p => p.code === originalPrefCode)?.name || '不明';

            station.prefCode = newPrefCode;
            station.prefecture = prefName;

            repairedCount++;
            repairLog.push(
                `[修復] ${station.name}: "${oldPrefName}" (${originalPrefCode}) → "${prefName}" (${newPrefCode}) [${repairReason}]`
            );
        } else {
            unchangedCount++;
        }

        // 確実に2桁文字列に統一
        station.prefCode = String(station.prefCode).padStart(2, '0');
    });

    console.log('\n📝 修復結果:');
    console.log(`  修復した駅: ${repairedCount}`);
    console.log(`  変更なし: ${unchangedCount}`);

    if (repairLog.length > 0) {
        console.log('\n🔍 修復詳細 (最初の20件):');
        repairLog.slice(0, 20).forEach(log => console.log(`  ${log}`));
        if (repairLog.length > 20) {
            console.log(`  ... 他 ${repairLog.length - 20} 件`);
        }
    }

    // 修復データを保存
    console.log('\n💾 修復データを保存中...');
    fs.writeFileSync(sourcePath, JSON.stringify(rawData, null, 2));

    // public/data/stations.jsonにもコピー
    const targetPath = path.join(process.cwd(), 'public/data/stations.json');
    fs.writeFileSync(targetPath, JSON.stringify(rawData, null, 2));

    console.log(`✅ 保存完了: ${sourcePath}`);
    console.log(`✅ コピー完了: ${targetPath}`);

    // 検証
    console.log('\n🔍 重要駅の検証:');
    const testStations = ['武蔵小杉', '横浜', '浦和', '梅田'];
    const expected = { '武蔵小杉': '14', '横浜': '14', '浦和': '11', '梅田': '27' };

    let allPassed = true;
    testStations.forEach(name => {
        const station = Object.values(rawData).find(s => s.name === name);
        if (station) {
            const prefCode = String(station.prefCode).padStart(2, '0');
            const prefName = PREFECTURES.find(p => p.code === prefCode)?.name;
            const expectedCode = expected[name];
            const passed = prefCode === expectedCode;

            console.log(`  ${passed ? '✅' : '❌'} ${name}: prefCode="${prefCode}" 県名="${prefName}" (期待値: ${expectedCode})`);

            if (!passed) allPassed = false;
        } else {
            console.log(`  ❌ ${name}: 駅が見つかりません`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('\n✨ 全ての検証をパスしました!');
    } else {
        console.log('\n⚠️ 一部の検証に失敗しました');
    }

    console.log('='.repeat(80));
}

repairStationData().catch(console.error);

export {};
