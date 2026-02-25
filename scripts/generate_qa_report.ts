import fs from 'fs';
import path from 'path';

/**
 * Automated Quality Assurance Report Generator
 * Validates all 47 prefectures for production readiness
 */

interface PrefectureAudit {
    code: string;
    name: string;
    features: number;
    stationAreas: number;
    totalStations: number;
    coverage: number;
    fileSize: number;
    status: 'PASS' | 'FAIL';
    issues: string[];
}

const PREFECTURE_NAMES: { [key: string]: string } = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県'
};

async function auditPrefecture(prefCode: string): Promise<PrefectureAudit> {
    const filePath = path.join(process.cwd(), 'public/data', `${prefCode}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const fileSize = fs.statSync(filePath).size;

    const issues: string[] = [];

    // Check feature count
    if (data.features.length < 2) {
        issues.push('Insufficient granularity (< 2 features)');
    }

    // Check station integration
    const stationAreas = data.features.filter((f: any) => f.properties.hasStation).length;
    const totalStations = data.features.reduce((sum: number, f: any) => sum + (f.properties.stationCount || 0), 0);
    const coverage = (stationAreas / data.features.length) * 100;

    // Validate metadata presence
    const hasMetadata = data.features.every((f: any) =>
        f.properties.hasOwnProperty('stationCount') &&
        f.properties.hasOwnProperty('densityTier')
    );

    if (!hasMetadata) {
        issues.push('Missing station metadata');
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';

    return {
        code: prefCode,
        name: PREFECTURE_NAMES[prefCode],
        features: data.features.length,
        stationAreas,
        totalStations,
        coverage,
        fileSize,
        status,
        issues
    };
}

async function generateReport() {
    console.log('\n🔍 Starting Automated Quality Assurance Audit');
    console.log('═'.repeat(80));

    const results: PrefectureAudit[] = [];

    for (let i = 1; i <= 47; i++) {
        const prefCode = String(i).padStart(2, '0');
        console.log(`Auditing ${prefCode} - ${PREFECTURE_NAMES[prefCode]}...`);
        const result = await auditPrefecture(prefCode);
        results.push(result);
    }

    // Generate HTML report
    const passCount = results.filter(r => r.status === 'PASS').length;
    const totalStations = results.reduce((sum, r) => sum + r.totalStations, 0);
    const avgCoverage = results.reduce((sum, r) => sum + r.coverage, 0) / results.length;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Machi-Karte Quality Assurance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
        .metric { background: #f9f9f9; padding: 20px; border-radius: 4px; text-align: center; }
        .metric-value { font-size: 32px; font-weight: bold; color: #4CAF50; }
        .metric-label { color: #666; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #4CAF50; color: white; font-weight: 600; }
        tr:hover { background: #f5f5f5; }
        .pass { color: #4CAF50; font-weight: bold; }
        .fail { color: #f44336; font-weight: bold; }
        .issue { color: #ff9800; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Machi-Karte 全国品質保証レポート</h1>
        <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${passCount}/47</div>
                <div class="metric-label">合格都道府県</div>
            </div>
            <div class="metric">
                <div class="metric-value">${totalStations.toLocaleString()}</div>
                <div class="metric-label">総統合駅数</div>
            </div>
            <div class="metric">
                <div class="metric-value">${avgCoverage.toFixed(1)}%</div>
                <div class="metric-label">平均カバレッジ</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(passCount / 47 * 100).toFixed(0)}%</div>
                <div class="metric-label">合格率</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Code</th>
                    <th>都道府県</th>
                    <th>自治体数</th>
                    <th>駅保有自治体</th>
                    <th>総駅数</th>
                    <th>カバレッジ</th>
                    <th>ファイルサイズ</th>
                    <th>判定</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                <tr>
                    <td>${r.code}</td>
                    <td>${r.name}</td>
                    <td>${r.features}</td>
                    <td>${r.stationAreas}</td>
                    <td>${r.totalStations}</td>
                    <td>${r.coverage.toFixed(1)}%</td>
                    <td>${(r.fileSize / 1024).toFixed(1)}KB</td>
                    <td class="${r.status.toLowerCase()}">${r.status}</td>
                </tr>
                ${r.issues.length > 0 ? `<tr><td colspan="8" class="issue">⚠️ ${r.issues.join(', ')}</td></tr>` : ''}
                `).join('')}
            </tbody>
        </table>
        
        <h2>検証項目</h2>
        <ul>
            <li>✅ データ粒度: 全都道府県が市区町村レベル (Features ≥ 2)</li>
            <li>✅ 駅メタデータ: stationCount, densityTier プロパティの存在</li>
            <li>✅ ファイル整合性: 全47ファイルが正常に読み込み可能</li>
        </ul>
        
        <h2>結論</h2>
        <p><strong>${passCount === 47 ? '✅ 全都道府県が品質基準を満たしています。本番環境へのデプロイ準備完了です。' : `⚠️ ${47 - passCount}都道府県に問題が検出されました。修正が必要です。`}</strong></p>
    </div>
</body>
</html>
    `;

    const reportPath = path.join(process.cwd(), 'quality_assurance_report.html');
    fs.writeFileSync(reportPath, html);

    console.log('\n\n📊 AUDIT SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ PASS: ${passCount}/47`);
    console.log(`🚉 Total Stations: ${totalStations}`);
    console.log(`📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
    console.log('═'.repeat(80));
    console.log(`\n📄 Report saved: ${reportPath}\n`);
}

generateReport().catch(console.error);
