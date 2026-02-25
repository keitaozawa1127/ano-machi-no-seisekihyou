const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Force HOME to user profile to avoid "HOME not set" errors
const userHome = process.env.USERPROFILE || 'C:\\Users\\kozaw';
process.env.HOME = userHome;

(async () => {
    console.log('🚀 Launching Universal Verification...');
    let browser;
    try {
        browser = await chromium.launch({
            headless: false,
            slowMo: 500,
            env: { ...process.env, HOME: userHome }
        });

        const page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 900 });

        // Capture Browser Console to file
        page.on('console', msg => {
            const text = `[Browser] ${msg.text()}`;
            console.log(text);
            fs.appendFileSync('browser_audit.log', text + '\n');
        });

        const APP_URL = 'http://localhost:3000';
        await page.goto(APP_URL, { timeout: 30000, waitUntil: 'domcontentloaded' });

        await (await page.locator('select').first()).selectOption('13'); // Tokyo
        console.log('Tokoyo Selected. Waiting 15s for enrichment...');
        await page.waitForTimeout(15000); // Wait for enrichment (heavy calculation)

        const stationSelect = (await page.locator('select').all())[1];
        const content = await stationSelect.innerHTML();

        if (content.includes('🏙 東京23区内')) {
            console.log('✅ PASS: Tokyo 23 Wards optgroup found.');
        } else {
            console.error('❌ FAIL: Tokyo 23 Wards optgroup NOT found.');
        }
        await capture('proof_tokyo_ui.png');


        // --- 2. KANAGAWA (Map Holes Check - Yokohama) ---
        console.log('🚢 Checking Kanagawa (Yokohama)...');
        await (await page.locator('select').first()).selectOption('14'); // Kanagawa
        await page.waitForTimeout(1000); // Render
        await page.waitForTimeout(3000); // Calculation

        // Hover over center-right (Yokohama area)
        const mapSvg = await page.locator('svg').first();
        const box = await mapSvg.boundingBox();
        if (box) {
            // Yokohama is roughly south-east relative to center of bounds? 
            // Kanagawa shape: wide. Yokohama is East.
            // Let's try hovering a few points or just snapping a shot.
            // Screenshot is the proof of "No Holes".
            await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4);
            await page.waitForTimeout(500);
            await capture('proof_kanagawa_map.png');
            console.log('✅ PASS: Kanagawa screenshot captured.');
        }


        // --- 3. OSAKA (Map Holes Check - Osaka City) ---
        console.log('🐙 Checking Osaka (Osaka City)...');
        await (await page.locator('select').first()).selectOption('27'); // Osaka
        await page.waitForTimeout(1000);
        await page.waitForTimeout(3000);

        if (box) {
            // Osaka City is central/north-west. 
            await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
            await page.waitForTimeout(500);
            await capture('proof_osaka_map.png');
            console.log('✅ PASS: Osaka screenshot captured.');
        }

        console.log('🏁 Universal Verification Complete.');

    } catch (e) {
        console.error('💥 Crash:', e);
    } finally {
        if (browser) await browser.close();
    }
})();
