const fs = require('fs');
const path = require('path');

/**
 * Station Data Enrichment Script (Passenger Volume Based)
 * 乗降客数ベースのスコアリングシステム
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

// 主要駅の乗降客数スコア（ボーナス）
const MAJOR_STATION_VOLUME = {
    // 超巨大ターミナル（100万人/日規模）
    '新宿': 10000, '渋谷': 9500, '池袋': 9000, '東京': 8500, '横浜': 8000,
    '梅田': 8500, '難波': 7500, '名古屋': 8000, '天王寺': 7000,

    // 大型ターミナル（50万人/日規模）
    '品川': 7500, '新橋': 7000, '上野': 6500, '大宮': 6000, '川崎': 5500,
    '秋葉原': 6000, '有楽町': 5500, '浜松町': 5000, '武蔵小杉': 5000,
    '京都': 7000, '神戸': 6500, '博多': 7500, '札幌': 7000, '仙台': 6500,

    // 中型ターミナル（30万人/日規模）
    '新横浜': 4500, '立川': 4000, '町田': 3800, '八王子': 3500, '吉祥寺': 4200,
    '千葉': 5000, '船橋': 4000, '柏': 3800, '松戸': 3500,
    '浦和': 4500, '川口': 3500, '所沢': 3200,
    '京橋': 4500, '心斎橋': 4000, '三宮': 5000, '西宮北口': 3800,
    '広島': 5500, '岡山': 4500, '金沢': 4000, '長野': 3500,

    // 準主要駅（10-20万人/日規模）
    '藤沢': 3000, '鎌倉': 2500, '小田原': 2800, '平塚': 2200,
    '海老名': 2800, '本厚木': 2500, '相模大野': 2300,
    '熊本': 4000, '鹿児島中央': 3800, '那覇': 2000,
    '静岡': 3500, '浜松': 3200, '豊橋': 2800,
    '宇都宮': 3200, '高崎': 3000, '前橋': 2500,
    '新潟': 4000, '富山': 3000, '福井': 2500
};

// 路線タイプ別ウェイト
function getLineWeight(lineName) {
    // JR基幹路線（超高ウェイト）
    if (lineName.includes('JR東海道') || lineName.includes('JR山手') ||
        lineName.includes('JR京浜東北') || lineName.includes('JR中央') ||
        lineName.includes('JR大阪環状') || lineName.includes('JR総武')) {
        return 1000;
    }
    // その他JR主要路線（高ウェイト）
    if (lineName.includes('JR横須賀') || lineName.includes('JR湘南新宿') ||
        lineName.includes('JR埼京') || lineName.includes('JR常磐') ||
        lineName.includes('JR東北') || lineName.includes('JR高崎') ||
        lineName.includes('JR宇都宮') || lineName.includes('JR京葉')) {
        return 800;
    }
    // その他JR路線
    if (lineName.startsWith('JR')) {
        return 500;
    }
    // 大手私鉄主要路線（高ウェイト）
    if (lineName.includes('東急東横') || lineName.includes('東急田園都市') ||
        lineName.includes('小田急線') || lineName.includes('京急本線') ||
        lineName.includes('京王線') || lineName.includes('西武池袋') ||
        lineName.includes('東武東上') || lineName.includes('京成本線') ||
        lineName.includes('阪急') || lineName.includes('阪神') ||
        lineName.includes('近鉄') || lineName.includes('南海')) {
        return 700;
    }
    // 地下鉄主要路線
    if (lineName.includes('メトロ') || lineName.includes('都営') ||
        lineName.includes('大阪メトロ') || lineName.includes('御堂筋') ||
        lineName.includes('谷町') || lineName.includes('四つ橋')) {
        return 600;
    }
    // その他私鉄
    if (lineName.includes('相鉄') || lineName.includes('京浜急行') ||
        lineName.includes('東武') || lineName.includes('西武')) {
        return 400;
    }
    // ローカル線・新交通
    return 200;
}

async function enrichStationData() {
    console.log('🚃 駅データ強化スクリプト開始（乗降客数ベース）');
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

    let enrichedCount = 0;

    Object.entries(rawData).forEach(([key, station]) => {
        // passengerVolumeスコア計算
        let volume = 0;

        // 1. 主要駅ボーナス
        const majorBonus = MAJOR_STATION_VOLUME[station.name] || 0;
        volume += majorBonus;

        // 2. 路線ウェイトの合計
        if (station.lines && Array.isArray(station.lines)) {
            const lineWeight = station.lines.reduce((sum, line) => {
                return sum + getLineWeight(line);
            }, 0);
            volume += lineWeight;
        }

        // 3. 接続路線数ボーナス（1路線あたり+100）
        const lineCountBonus = (station.lines?.length || 0) * 100;
        volume += lineCountBonus;

        // 最低値を設定（0のままにしない）
        station.passengerVolume = Math.max(volume, 10);

        // tradeCountも維持（後方互換性）
        if (!station.tradeCount) {
            station.tradeCount = station.passengerVolume;
        }

        // prefCodeを確実に2桁文字列に
        station.prefCode = String(station.prefCode || '00').padStart(2, '0');

        if (volume > 0) {
            enrichedCount++;
        }
    });

    console.log('\n📝 強化結果:');
    console.log(`  passengerVolume設定した駅: ${enrichedCount}`);

    // 保存
    console.log('\n💾 強化データを保存中...');
    fs.writeFileSync(sourcePath, JSON.stringify(rawData, null, 2));

    const targetPath = path.join(process.cwd(), 'public/data/stations.json');
    fs.writeFileSync(targetPath, JSON.stringify(rawData, null, 2));

    console.log(`✅ 保存完了: ${sourcePath}`);
    console.log(`✅ コピー完了: ${targetPath}`);

    // トップ15駅を表示
    console.log('\n🏆 乗降客数トップ15:');
    const sortedStations = Object.values(rawData)
        .sort((a, b) => (b.passengerVolume || 0) - (a.passengerVolume || 0))
        .slice(0, 15);

    sortedStations.forEach((s, idx) => {
        const prefName = PREFECTURES.find(p => p.code === s.prefCode)?.name || '不明';
        const lines = s.lines?.slice(0, 3).join(', ') || '';
        console.log(`  ${String(idx + 1).padStart(2, ' ')}. ${s.name.padEnd(12, '　')} (${prefName}): ${String(s.passengerVolume).padStart(6, ' ')}pt | ${lines}...`);
    });

    console.log('='.repeat(80));
    console.log('✨ 完了');
}

enrichStationData().catch(console.error);

export {};
