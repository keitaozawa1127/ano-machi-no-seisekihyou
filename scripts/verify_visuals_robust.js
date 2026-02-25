/**
 * 堅牢な視覚的検証スクリプト (Playwright)
 * - HOME環境変数の注入
 * - 全4証拠のキャプチャ
 * - タイムアウト対策
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 環境変数の注入 (Windows対応)
if (!process.env.HOME) {
    process.env.HOME = process.env.USERPROFILE || 'C:\\Users\\kozaw';
    console.log(`🔧 Injected HOME: ${process.env.HOME}`);
}

const ARTIFACT_DIR = 'C:\\Users\\kozaw\\.gemini\\antigravity\\brain\\dd221516-972c-4ace-9a7d-7ee3ce113e23';
const APP_URL = 'http://localhost:3000';

(async () => {
    console.log('🚀 堅牢な視覚検証を開始します...');

    // Ensure artifacts exist
    if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000, // ユーザーが動きを目視できるように遅延
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // 安定化オプション
    });

    const context = await browser.newContext({
        viewport: { width: 1600, height: 900 },
        deviceScaleFactor: 1
    });

    const page = await context.newPage();

    try {
        // ========== 証拠A: 東京23区 optgroup ==========
        console.log('\n📸 [証拠A] 東京都へ移動...');
        await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

        // 1. 都道府県選択
        await page.selectOption('select:nth-of-type(1)', '13'); // Tokyo
        await page.waitForTimeout(3000); // Wait for API and Map load

        // 2. マップ上の23区内をクリック (Shinjuku area: approx 65%, 40%)
        const mapSvg = await page.waitForSelector('svg', { timeout: 10000 });
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            if (box) {
                // Click well within 23 wards
                await page.mouse.click(box.x + box.width * 0.70, box.y + box.height * 0.45);
                console.log('  ✅ Clicked 23-ward map area');
                await page.waitForTimeout(2000);
            }
        }

        // 3. プルダウンの確認 (DOM検証 + 特殊撮影)
        // Playwright cannot screenshot open select. We will Log DOM and Overlay proof.
        const stationSelect = await page.$('select:nth-of-type(2)');
        const innerHTML = await stationSelect.innerHTML();
        const hasOptgroup = innerHTML.includes('🏙 東京23区内');

        // Visual Overlay for Proof
        await page.evaluate((isFound) => {
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:20px;font-size:30px;font-weight:bold;z-index:9999;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.5);';
            div.innerHTML = isFound ? '✅ 証拠A: optgroup 検出成功' : '❌ optgroup 未検出';
            document.body.appendChild(div);

            // Highlight the select element
            const el = document.querySelector('select:nth-of-type(2)');
            if (el) { el.style.border = '5px solid #ef4444'; el.style.transform = 'scale(1.1)'; }
        }, hasOptgroup);

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_evidence_a_tokyo_optgroup.png') });
        console.log(`  ✅ Saved Evidence A. Optgroup detected: ${hasOptgroup}`);
        await page.evaluate(() => document.querySelector('div[style*="fixed"]')?.remove()); // Cleanup

        // ========== 証拠B: 神奈川マップ (隙間なし) ==========
        console.log('\n📸 [証拠B] 神奈川県へ移動...');
        await page.selectOption('select:nth-of-type(1)', '14'); // Kanagawa
        await page.waitForTimeout(5000); // 描画待機

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_evidence_b_kanagawa_gapless.png') });
        console.log('  ✅ Saved Evidence B (Kanagawa Gap check)');

        // 横浜ホバー
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6); // Yokohama area
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_evidence_b_hover.png') });
        }

        // ========== 証拠C: 大阪マップ (全域色分け) ==========
        console.log('\n📸 [証拠C] 大阪府へ移動...');
        await page.selectOption('select:nth-of-type(1)', '27'); // Osaka
        await page.waitForTimeout(5000);

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_evidence_c_osaka_colored.png') });
        console.log('  ✅ Saved Evidence C (Osaka Coloring)');

        // ========== 証拠D: パフォーマンス (動画的連写) ==========
        console.log('\n📸 [証拠D] パフォーマンス検証 (埼玉 -> 千葉 高速切替)...');

        // 埼玉
        await page.selectOption('select:nth-of-type(1)', '11'); // Saitama
        await page.waitForTimeout(500); // Short wait
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_evidence_d_perf_1_saitama.png') });

        // 千葉 (即時)
        await page.selectOption('select:nth-of-type(1)', '12'); // Chiba
        await page.waitForTimeout(1000); // Check visual readiness
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_evidence_d_perf_2_chiba.png') });
        console.log('  ✅ Saved Evidence D (Performance snapshots)');

    } catch (e) {
        console.error('❌ Verification Failed:', e);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'robust_error.png') });
    } finally {
        await browser.close();
    }
})();
