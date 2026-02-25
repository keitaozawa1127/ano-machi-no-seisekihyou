/**
 * 23区専用証明スクリプト - 座標調整版
 * 確実に23区内をクリックして検証
 */
const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kozaw\\.gemini\\antigravity\\brain\\dd221516-972c-4ace-9a7d-7ee3ce113e23';

(async () => {
    console.log('🚀 23区専用証明開始...');

    const browser = await chromium.launch({ headless: false, slowMo: 400 });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(2000);

        // 東京を選択
        await page.selectOption('select:first-of-type', '13');
        console.log('✅ 東京都を選択');
        await page.waitForTimeout(4000); // データロード待機

        // 23区の中心部をクリック (マップ中央より右下 - 新宿/渋谷付近)
        const mapSvg = await page.$('svg');
        if (mapSvg) {
            const box = await mapSvg.boundingBox();
            if (box) {
                // 23区は東京マップの右側中央寄り（西側が多摩地区）
                // より右寄り・下寄りの座標を狙う
                const clickX = box.x + box.width * 0.72;
                const clickY = box.y + box.height * 0.48;
                console.log(`📍 クリック座標: (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);

                await page.mouse.click(clickX, clickY);
                console.log('✅ 23区エリアをクリック');
                await page.waitForTimeout(3000);
            }
        }

        // 現在選択されているエリア名を確認
        const selectedAreaText = await page.$eval('label:has-text("エリアを地図から選択")', el => el.textContent);
        console.log(`📍 選択エリア: ${selectedAreaText}`);

        // selectのinnerHTMLを取得してoptgroupを検証
        const stationSelect = await page.$('select:nth-of-type(2)');
        let optgroupProof = { found: false, label: '', count: 0, selectedCity: '' };

        if (stationSelect) {
            const innerHTML = await stationSelect.innerHTML();
            console.log(`📄 SELECT HTML (先頭500文字): ${innerHTML.substring(0, 500)}`);

            // optgroupを検索
            const optgroupMatch = innerHTML.match(/<optgroup label="(🏙 東京23区内)">([\s\S]*?)<\/optgroup>/);
            if (optgroupMatch) {
                optgroupProof.found = true;
                optgroupProof.label = optgroupMatch[1];
                optgroupProof.count = (optgroupMatch[2].match(/<option/g) || []).length;
                console.log(`✅ optgroup発見: "${optgroupProof.label}" (${optgroupProof.count}駅)`);
            } else {
                console.log('❌ optgroup未検出 - 選択エリアを確認');

                // 選択されたエリアが市町村部か確認
                if (innerHTML.includes('市町村部')) {
                    console.log('ℹ️ 市町村部エリアが選択されています');
                }
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
                        証拠A: optgroup 証明完了
                    </div>
                    <div style="font-size: 22px; margin-bottom: 10px; padding: 15px 25px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                        <span style="font-size: 24px;">${proof.label}</span>
                    </div>
                    <div style="font-size: 18px; opacity: 0.9; margin-top: 15px;">
                        該当駅数: <strong style="color: #fbbf24; font-size: 24px;">${proof.count}駅</strong>
                    </div>
                `;
            } else {
                overlay.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 15px;">📍</div>
                    <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">
                        ※市町村部を選択中
                    </div>
                    <div style="font-size: 16px; opacity: 0.8; margin-top: 10px;">
                        23区内をクリックするとoptgroupが表示されます
                    </div>
                `;
            }

            document.body.appendChild(overlay);
        }, optgroupProof);

        await page.waitForTimeout(1500);

        // 証拠Aスクリーンショット
        const evidenceAPath = path.join(ARTIFACT_DIR, 'evidence_a_23ward_proof.png');
        await page.screenshot({ path: evidenceAPath, fullPage: false });
        console.log(`📁 証拠A保存: ${evidenceAPath}`);

        // オーバーレイ削除
        await page.evaluate(() => document.getElementById('optgroup-proof-overlay')?.remove());

        // もしoptgroupが見つからなければ、別の場所をクリックして再試行
        if (!optgroupProof.found) {
            console.log('\n🔄 再試行: より中央寄りをクリック');
            if (mapSvg) {
                const box = await mapSvg.boundingBox();
                if (box) {
                    // 新宿区あたり（もっと右上）
                    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.40);
                    await page.waitForTimeout(3000);

                    const stationSelect2 = await page.$('select:nth-of-type(2)');
                    if (stationSelect2) {
                        const innerHTML2 = await stationSelect2.innerHTML();
                        if (innerHTML2.includes('🏙 東京23区内')) {
                            console.log('✅ 再試行で23区内optgroup発見!');

                            // 成功オーバーレイ表示
                            await page.evaluate(() => {
                                const overlay = document.createElement('div');
                                overlay.style.cssText = `
                                    position: fixed; top: 50%; left: 50%;
                                    transform: translate(-50%, -50%);
                                    background: #16a34a; color: #fff;
                                    padding: 40px 60px; border-radius: 20px;
                                    z-index: 99999; text-align: center;
                                    font-family: sans-serif; font-size: 28px;
                                `;
                                overlay.innerHTML = '✅ 証拠A: 23区 optgroup 確認!';
                                document.body.appendChild(overlay);
                            });

                            await page.waitForTimeout(1000);
                            const retryPath = path.join(ARTIFACT_DIR, 'evidence_a_23ward_retry_success.png');
                            await page.screenshot({ path: retryPath });
                            console.log(`📁 再試行成功保存: ${retryPath}`);
                        }
                    }
                }
            }
        }

        console.log('\n✅ 証拠A キャプチャ完了');

    } catch (e) {
        console.error('❌ エラー:', e);
    } finally {
        await browser.close();
    }
})();

export {};
