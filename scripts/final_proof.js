const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\kozaw\\.gemini\\antigravity\\brain\\dd221516-972c-4ace-9a7d-7ee3ce113e23';
const APP_URL = 'http://localhost:3000';

(async () => {
    console.log('🚀 最終視覚証拠キャプチャ (Final Proof) 開始...');

    if (!fs.existsSync(ARTIFACT_DIR)) {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }

    // Launch options same as capture_evidence.js
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    try {
        // ========== 証拠A: 東京都23区プルダウン (Tokyo Optgroup) ==========
        console.log('\n📸 [証拠A] 東京都23区プルダウンキャプチャ...');
        await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });

        // Select Tokyo (13)
        await page.selectOption('select:first-of-type', '13');
        console.log('  ✅ 東京都を選択');
        await page.waitForTimeout(5000); // Wait for async calculation (Performance!)

        // Open Dropdown (LOG ONLY because screenshotting open dropdown is hard)
        const stationSelect = await page.$('select:nth-of-type(2)');
        if (stationSelect) {
            const innerHTML = await stationSelect.innerHTML();
            const hasOptgroup = innerHTML.includes('🏙 東京23区内');
            console.log(`  🔍 Optgroup Check: ${hasOptgroup ? 'SUCCESS' : 'FAILURE'}`);

            // Generate visual "Stamp" on the page
            await page.evaluate((success) => {
                const div = document.createElement('div');
                div.style.cssText = `
                    position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
                    background: ${success ? '#059669' : '#DC2626'}; color: white;
                    padding: 20px; font-size: 24px; font-weight: bold; border-radius: 12px;
                    z-index: 10000; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                `;
                div.textContent = success ? '✅ 証拠A: 23区グループ分離成功' : '❌ 証拠A: グループ化失敗';
                document.body.appendChild(div);
            }, hasOptgroup);

            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proof_a_tokyo_optgroup.png') });
            console.log('  📁 Saved proof_a_tokyo_optgroup.png');
            // Remove stamp
            await page.evaluate(() => document.querySelector('div[style*="fixed"]')?.remove());
        }

        // ========== 証拠B: 神奈川県マップ (Gap Check) ==========
        console.log('\n📸 [証拠B] 神奈川県マップ (Gap Check)...');
        await page.selectOption('select:first-of-type', '14');
        console.log('  ✅ 神奈川県を選択');
        await page.waitForTimeout(5000); // Wait for async calculation/render

        // Hover over Yokohama (approx center-right)
        const mapSvg = await page.$('svg');
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65);
            await page.waitForTimeout(2000); // Wait for tooltip

            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proof_b_kanagawa_map.png') });
            console.log('  📁 Saved proof_b_kanagawa_map.png (with tooltip)');
        }

        // ========== 証拠C: 大阪府マップ (Coverage Check) ==========
        console.log('\n📸 [証拠C] 大阪府マップ (Coverage Check)...');
        await page.selectOption('select:first-of-type', '27');
        console.log('  ✅ 大阪府を選択');
        await page.waitForTimeout(5000);

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proof_c_osaka_map.png') });
        console.log('  📁 Saved proof_c_osaka_map.png');

        // ========== 証拠D: パフォーマンス (Fast Switch) ==========
        console.log('\n📸 [証拠D] パフォーマンス (Saitama -> Chiba)...');
        await page.selectOption('select:first-of-type', '11'); // Saitama
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proof_d_perf_1.png') });

        await page.selectOption('select:first-of-type', '12'); // Chiba
        await page.waitForTimeout(1500); // Render instant check
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proof_d_perf_2.png') });
        console.log('  📁 Saved proof_d_perf_*.png');

    } catch (e) {
        console.error('❌ Error during capture:', e);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proof_error.png') });
    } finally {
        await browser.close();
        console.log('🏁 Verification Complete');
    }
})();
