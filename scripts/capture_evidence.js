/**
 * 最終視覚証拠キャプチャスクリプト
 * 証拠A: 東京23区プルダウン / 証拠B: 神奈川県マップ (隙間なし)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\kozaw\\.gemini\\antigravity\\brain\\dd221516-972c-4ace-9a7d-7ee3ce113e23';
const APP_URL = 'http://localhost:3000';

(async () => {
    console.log('🚀 最終視覚証拠キャプチャ開始...');

    // Ensure artifact dir exists
    if (!fs.existsSync(ARTIFACT_DIR)) {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: false,  // ユーザー確認用に表示
        slowMo: 500       // 動作を遅くして見やすく
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    try {
        // ========== 証拠A: 東京都23区プルダウン ==========
        console.log('\n📸 証拠A: 東京都23区プルダウンキャプチャ中...');
        await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(2000);

        // 東京都を選択
        await page.selectOption('select:first-of-type', '13');
        console.log('  ✅ 東京都を選択');
        await page.waitForTimeout(3000); // マップとデータロード待機

        // 地図上の任意のエリアをクリック (23区内のエリアを狙う)
        const mapSvg = await page.$('svg');
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            if (box) {
                // 23区エリア (マップの中央やや右寄り)
                await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
                console.log('  ✅ 地図エリアをクリック');
                await page.waitForTimeout(2000);
            }
        }

        // 駅プルダウンをクリックして開く
        const stationSelect = await page.$('select:nth-of-type(2)');
        if (stationSelect) {
            // プルダウンの内容を検証
            const innerHTML = await stationSelect.innerHTML();
            const hasOptgroup = innerHTML.includes('🏙 東京23区内');
            console.log(`  ${hasOptgroup ? '✅' : '❌'} optgroup "🏙 東京23区内" 存在: ${hasOptgroup}`);

            // スクリーンショット (プルダウンは閉じた状態だが、DOM内容をログで証明)
            if (hasOptgroup) {
                // 証拠としてoptgroupの行数を表示
                const optgroupMatch = innerHTML.match(/<optgroup label="🏙 東京23区内">([\s\S]*?)<\/optgroup>/);
                if (optgroupMatch) {
                    const optionCount = (optgroupMatch[1].match(/<option/g) || []).length;
                    console.log(`  ✅ 23区内の駅数: ${optionCount}駅`);
                }
            }
        }

        // 証拠A スクリーンショット
        const evidenceAPath = path.join(ARTIFACT_DIR, 'evidence_a_tokyo_dropdown.png');
        await page.screenshot({ path: evidenceAPath, fullPage: false });
        console.log(`  📁 保存: ${evidenceAPath}`);

        // ========== 証拠B: 神奈川県マップ (横浜・川崎エリア隙間なし) ==========
        console.log('\n📸 証拠B: 神奈川県マップキャプチャ中...');

        // 神奈川県を選択
        await page.selectOption('select:first-of-type', '14');
        console.log('  ✅ 神奈川県を選択');
        await page.waitForTimeout(4000); // マップ着色完了待機

        // マップ部分のスクリーンショット
        const evidenceBPath = path.join(ARTIFACT_DIR, 'evidence_b_kanagawa_map.png');
        if (mapSvg) {
            await mapSvg.screenshot({ path: evidenceBPath });
        } else {
            await page.screenshot({ path: evidenceBPath, fullPage: false });
        }
        console.log(`  📁 保存: ${evidenceBPath}`);

        // 横浜市のホバー確認 (中央区をホバー)
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            if (box) {
                // 横浜市エリア (マップの右下付近)
                await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65);
                await page.waitForTimeout(1000);

                const hoverPath = path.join(ARTIFACT_DIR, 'evidence_b_kanagawa_hover.png');
                await page.screenshot({ path: hoverPath, fullPage: false });
                console.log(`  📁 ホバー状態保存: ${hoverPath}`);
            }
        }

        // ========== 追加証拠: 大阪府マップ ==========
        console.log('\n📸 追加証拠: 大阪府マップキャプチャ中...');
        await page.selectOption('select:first-of-type', '27');
        console.log('  ✅ 大阪府を選択');
        await page.waitForTimeout(4000);

        const evidenceCPath = path.join(ARTIFACT_DIR, 'evidence_c_osaka_map.png');
        await page.screenshot({ path: evidenceCPath, fullPage: false });
        console.log(`  📁 保存: ${evidenceCPath}`);

        console.log('\n✅ 全証拠キャプチャ完了!');
        console.log('='.repeat(50));
        console.log('📁 証拠ファイル:');
        console.log(`   A) ${evidenceAPath}`);
        console.log(`   B) ${evidenceBPath}`);
        console.log(`   C) ${evidenceCPath}`);
        console.log('='.repeat(50));

    } catch (e) {
        console.error('❌ エラー:', e);
        const errorPath = path.join(ARTIFACT_DIR, 'capture_error.png');
        await page.screenshot({ path: errorPath });
        console.log(`  📁 エラー時スクリーンショット: ${errorPath}`);
    } finally {
        await browser.close();
    }
})();
