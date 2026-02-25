const https = require('https');
const fs = require('fs');
const path = require('path');

// 設定: 都道府県と、そこに含まれる政令指定都市の定義
const TARGETS = {
    '14': { // 神奈川県
        name: '神奈川県',
        designated: [
            { name: '横浜市', codeStart: 14101, count: 18 },
            { name: '川崎市', codeStart: 14131, count: 7 },
            { name: '相模原市', codeStart: 14151, count: 3 }
        ]
    },
    '27': { // 大阪府
        name: '大阪府',
        designated: [
            { name: '大阪市', codeStart: 27102, count: 24 },
            { name: '堺市', codeStart: 27141, count: 7 }
        ]
    },
    '23': { // 愛知県
        name: '愛知県',
        designated: [
            { name: '名古屋市', codeStart: 23101, count: 16 }
        ]
    },
    '28': { // 兵庫県
        name: '兵庫県',
        designated: [
            { name: '神戸市', codeStart: 28101, count: 9 }
        ]
    }
};

// ダウンロードヘルパー
function downloadJSON(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    console.log('🚀 データ統合プロセス開始...\n');
    console.log('戦略: data_backup(全域) - 政令市(全体) + Niiyz(区データ)\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const [prefCode, config] of Object.entries(TARGETS)) {
        console.log(`📦 ${config.name} (${prefCode}) の処理中...`);

        // 1. ベースデータの取得 (data_backup: 全自治体 - 政令市の区は含まれていない)
        const backupPath = path.join(__dirname, '..', 'public', 'data_backup', `${prefCode}.json`);
        console.log(`   ベースデータ: ${backupPath}`);

        let baseData;
        try {
            const content = fs.readFileSync(backupPath, 'utf8');
            baseData = JSON.parse(content);
            console.log(`   読込: ${baseData.features.length}件`);
        } catch (e) {
            console.error(`   ❌ ベースデータ読込失敗: ${e.message}\n`);
            continue;
        }

        // 2. ベースデータから政令指定都市（全体）を除外
        // ※ data_backupには既に政令市の区が含まれていないため、
        // 市レベル（横浜市全体など）が1つのポリゴンとして存在する場合のみ除外
        const designatedNames = config.designated.map(d => d.name);
        let finalFeatures = baseData.features.filter(f => {
            const cityName = f.properties?.N03_004 || f.properties?.N03_003 || '';
            // 政令指定都市名と完全一致するものを除外
            return !designatedNames.includes(cityName);
        });

        console.log(`   政令市除外後: ${finalFeatures.length}件`);

        // 3. 政令指定都市の「区」データをNiiyzから取得して追加
        for (const city of config.designated) {
            console.log(`   ${city.name} の区データを取得中 (${city.count}区)...`);
            const wardCodes = Array.from({ length: city.count }, (_, i) => (city.codeStart + i).toString());

            let wardCount = 0;
            for (const code of wardCodes) {
                const wardUrl = `https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson/${prefCode}/${code}.json`;
                const wardData = await downloadJSON(wardUrl);
                if (wardData && wardData.features) {
                    finalFeatures.push(...wardData.features);
                    wardCount++;
                }
                process.stdout.write('.');
                await new Promise(r => setTimeout(r, 100)); // レート制限
            }
            console.log(` ${wardCount}/${city.count}区取得`);
        }

        // 4. 保存
        const outputPath = path.join(__dirname, '..', 'public', 'data', `${prefCode}.json`);
        const outputData = { type: 'FeatureCollection', features: finalFeatures };
        fs.writeFileSync(outputPath, JSON.stringify(outputData), 'utf8');
        console.log(`   ✅ 保存: ${outputPath} (合計 ${finalFeatures.length}件)\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✨ データ統合が完了しました！\n');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

export {};
