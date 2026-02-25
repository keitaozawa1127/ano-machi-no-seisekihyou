/**
 * 東京23区 optgroup 証明スクリプト
 * ネイティブselectは開いた状態のスクショが不可なため、
 * DOMを解析してオーバーレイで証明を表示する
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\kozaw\\.gemini\\antigravity\\brain\\dd221516-972c-4ace-9a7d-7ee3ce113e23';

(async () => {
    console.log('🚀 optgroup証明キャプチャ開始...');

    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(2000);

        // 東京を選択
        await page.selectOption('select:first-of-type', '13');
        console.log('✅ 東京都を選択');
        await page.waitForTimeout(3000);

        // 23区内のエリアをクリック (新宿区付近)
        const mapSvg = await page.$('svg');
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            if (box) {
                await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.42);
                console.log('✅ 23区内エリアをクリック');
                await page.waitForTimeout(2500);
            }
        }

        // selectのinnerHTMLを取得してoptgroupを検証
        const stationSelect = await page.$('select:nth-of-type(2)');
        let optgroupProof = { found: false, label: '', count: 0 };

        if (stationSelect) {
            const innerHTML = await stationSelect.innerHTML();

            // optgroupを検索
            const optgroupMatch = innerHTML.match(/<optgroup label="(🏙 東京23区内)">([\s\S]*?)<\/optgroup>/);
            if (optgroupMatch) {
                optgroupProof.found = true;
                optgroupProof.label = optgroupMatch[1];
                optgroupProof.count = (optgroupMatch[2].match(/<option/g) || []).length;
                console.log(`✅ optgroup発見: "${optgroupProof.label}" (${optgroupProof.count}駅)`);
            }

            // 市町村部も検索
            const cityGroupMatch = innerHTML.match(/<optgroup label="(🏡 市町村部)">([\s\S]*?)<\/optgroup>/);
            if (cityGroupMatch) {
                console.log(`✅ optgroup発見: "${cityGroupMatch[1]}" (${(cityGroupMatch[2].match(/<option/g) || []).length}駅)`);
            }
        }

        // オーバーレイで証明を表示
        await page.evaluate((proof) => {
            const overlay = document.createElement('div');
            overlay.id = 'optgroup-proof-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: #fff;
                padding: 40px 60px;
                border-radius: 20px;
                z-index: 99999;
                box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                text-align: center;
                font-family: 'Segoe UI', sans-serif;
            `;

            if (proof.found) {
                overlay.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
                    <div style="font-size: 28px; font-weight: bold; margin-bottom: 20px; color: #4ade80;">
                        optgroup 証明完了
                    </div>
                    <div style="font-size: 22px; margin-bottom: 10px; padding: 15px 25px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                        <span style="font-size: 24px;">${proof.label}</span>
                    </div>
                    <div style="font-size: 18px; opacity: 0.9; margin-top: 15px;">
                        該当駅数: <strong style="color: #fbbf24; font-size: 24px;">${proof.count}駅</strong>
                    </div>
                    <div style="font-size: 14px; opacity: 0.6; margin-top: 20px;">
                        DOM内で確認済み - ネイティブselectのため展開スクショ不可
                    </div>
                `;
            } else {
                overlay.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                    <div style="font-size: 24px; font-weight: bold; color: #f87171;">
                        optgroup 未検出
                    </div>
                `;
            }

            document.body.appendChild(overlay);
        }, optgroupProof);

        await page.waitForTimeout(1000);

        // 証拠Aスクリーンショット (オーバーレイ付き)
        const evidenceAPath = path.join(ARTIFACT_DIR, 'evidence_a_optgroup_proof.png');
        await page.screenshot({ path: evidenceAPath, fullPage: false });
        console.log(`📁 証拠A保存: ${evidenceAPath}`);

        // オーバーレイを削除
        await page.evaluate(() => {
            const el = document.getElementById('optgroup-proof-overlay');
            if (el) el.remove();
        });

        // ========== 証拠B: 神奈川県マップ ==========
        console.log('\n📸 証拠B: 神奈川県マップ...');
        await page.selectOption('select:first-of-type', '14');
        console.log('✅ 神奈川県を選択');
        await page.waitForTimeout(4000);

        // マップのみをスクリーンショット
        const svgElement = await page.$('svg');
        const evidenceBPath = path.join(ARTIFACT_DIR, 'evidence_b_kanagawa_complete.png');
        if (svgElement) {
            await svgElement.screenshot({ path: evidenceBPath });
        } else {
            await page.screenshot({ path: evidenceBPath });
        }
        console.log(`📁 証拠B保存: ${evidenceBPath}`);

        // 横浜市エリアをホバー
        if (svgElement) {
            const box = await svgElement.boundingBox();
            if (box) {
                // 横浜市中区付近をホバー
                await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65);
                await page.waitForTimeout(1500);

                const hoverPath = path.join(ARTIFACT_DIR, 'evidence_b_kanagawa_yokohama_hover.png');
                await page.screenshot({ path: hoverPath, fullPage: false });
                console.log(`📁 横浜ホバー保存: ${hoverPath}`);
            }
        }

        console.log('\n✅ 全証拠キャプチャ完了!');

    } catch (e) {
        console.error('❌ エラー:', e);
    } finally {
        await browser.close();
    }
})();
