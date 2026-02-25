const https = require('https');
const fs = require('fs');
const path = require('path');

// 横浜市の区コード（14101-14118）
const yokohamaCodes = Array.from({ length: 18 }, (_, i) => (14101 + i).toString());

// 大阪市の区コード（27102-27128）
const osakaCodes = Array.from({ length: 27 }, (_, i) => (27102 + i).toString());

// 名古屋市の区コード（23101-23116）  
const nagoyaCodes = Array.from({ length: 16 }, (_, i) => (23101 + i).toString());

// 神戸市の区コード（28101-28109）
const kobeCodes = Array.from({ length: 9 }, (_, i) => (28101 + i).toString());

// 区レベルのGeoJSONをダウンロードする関数
function downloadWardGeoJSON(prefCode, cityCode, cityName) {
    return new Promise((resolve, reject) => {
        const url = `https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson/${prefCode}/${cityCode}.json`;

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                resolve(null); // 404の場合はnullを返す
                return;
            }

            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const geoJSON = JSON.parse(data);
                    resolve(geoJSON);
                } catch (error) {
                    resolve(null);
                }
            });
        }).on('error', () => {
            resolve(null);
        });
    });
}

// 複数の区JSONを統合する関数
async function mergeWardGeoJSONs(prefCode, wardCodes, cityName) {
    console.log(`📥 ${cityName}の区データをダウンロード中...`);

    const features = [];
    for (const code of wardCodes) {
        const geoJSON = await downloadWardGeoJSON(prefCode, code, cityName);
        if (geoJSON && geoJSON.features) {
            features.push(...geoJSON.features);
            process.stdout.write('.');
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // レート制限
    }

    console.log(`\n   ✅ ${features.length}個の区を取得\n`);

    return {
        type: 'FeatureCollection',
        features: features
    };
}

// メイン処理
async function main() {
    console.log('🚀 政令指定都市の区データ取得を開始します...\n');
    console.log('データソース: niiyz/JapanCityGeoJson');
    console.log('URL: https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson/{pref}/{code}.json\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 横浜市
    const yokohamaData = await mergeWardGeoJSONs('14', yokohamaCodes, '横浜市');
    const outputPath14 = path.join(__dirname, '..', 'public', 'data', '14.json');
    fs.writeFileSync(outputPath14, JSON.stringify(yokohamaData, null, 2), 'utf8');
    console.log(`📁 保存: public/data/14.json (${yokohamaData.features.length} features)\n`);

    // 大阪市
    const osakaData = await mergeWardGeoJSONs('27', osakaCodes, '大阪市');
    const outputPath27 = path.join(__dirname, '..', 'public', 'data', '27.json');
    fs.writeFileSync(outputPath27, JSON.stringify(osakaData, null, 2), 'utf8');
    console.log(`📁 保存: public/data/27.json (${osakaData.features.length} features)\n`);

    // 名古屋市
    const nagoyaData = await mergeWardGeoJSONs('23', nagoyaCodes, '名古屋市');
    const outputPath23 = path.join(__dirname, '..', 'public', 'data', '23.json');
    fs.writeFileSync(outputPath23, JSON.stringify(nagoyaData, null, 2), 'utf8');
    console.log(`📁 保存: public/data/23.json (${nagoyaData.features.length} features)\n`);

    // 神戸市
    const kobeData = await mergeWardGeoJSONs('28', kobeCodes, '神戸市');
    const outputPath28 = path.join(__dirname, '..', 'public', 'data', '28.json');
    fs.writeFileSync(outputPath28, JSON.stringify(kobeData, null, 2), 'utf8');
    console.log(`📁 保存: public/data/28.json (${kobeData.features.length} features)\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✨ データ取得が完了しました！\n');
    console.log('📊 サマリー:');
    console.log(`   横浜市: ${yokohamaData.features.length}区`);
    console.log(`   大阪市: ${osakaData.features.length}区`);
    console.log(`   名古屋市: ${nagoyaData.features.length}区`);
    console.log(`   神戸市: ${kobeData.features.length}区`);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
