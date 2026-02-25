const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Force HOME to user profile to avoid "HOME not set" error
const userHome = process.env.USERPROFILE || 'C:\\Users\\kozaw';
process.env.HOME = userHome;

console.log(`🔧 Force-Set HOME: ${process.env.HOME}`);

(async () => {
    console.log('🚀 Launching Browser for Interactive Verification...');
    let browser;
    try {
        browser = await chromium.launch({
            headless: false,
            slowMo: 1000,
            env: { ...process.env, HOME: userHome }
        });

        console.log('✅ Browser Launched!');
        const page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 800 });

        // Capture Browser Console
        page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

        const APP_URL = 'http://localhost:3000';
        console.log(`➡️ Navigating to ${APP_URL}`);
        await page.goto(APP_URL, { timeout: 30000, waitUntil: 'domcontentloaded' });

        // 1. Check Tokyo Dropdown (Wait for render)
        console.log('🔍 Checking Tokyo Dropdown...');
        const selects = await page.locator('select').all();
        if (selects.length < 2) {
            console.error("❌ Found less than 2 select elements. Waiting and listing...");
            await page.waitForTimeout(2000);
            const retrySelects = await page.locator('select').all();
            console.log(`Select Count: ${retrySelects.length}`);
            if (retrySelects.length < 2) throw new Error("UI Structure Mismatch: Station select not found");
        }

        await selects[0].selectOption('13'); // Tokyo
        console.log('Tokoyo Selected. Waiting 5s for enrichment...');
        await page.waitForTimeout(5000); // Wait for enrichment (console logs should appear)

        // Check content of 2nd select
        const stationSelect = (await page.locator('select').all())[1]; // Re-fetch to be safe
        const content = await stationSelect.innerHTML();

        if (content.includes('🏙 東京23区内')) {
            console.log('✅ Found "東京23区内" optgroup!');
        } else {
            console.error('❌ MISSING "東京23区内" optgroup!');
            console.log('   Current Content Preview:', content.substring(0, 500));
        }

        await page.screenshot({ path: 'debug_tokyo_interactive.png' });

        // 2. Check Kanagawa Map
        console.log('🔍 Checking Kanagawa Map...');
        const prefSelect = (await page.locator('select').all())[0];
        await prefSelect.selectOption('14'); // Kanagawa
        await page.waitForTimeout(4000);

        // Hover Action
        const mapSvg = await page.locator('svg').first();
        const box = await mapSvg.boundingBox();
        if (box) {
            // Hover Yokohama (Center Right)
            await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'debug_kanagawa_hover.png' });
        } else {
            console.error("❌ Map SVG not found");
        }

        console.log('🏁 Diagnostic Complete.');

    } catch (e) {
        console.error('💥 Crash:', e);
    } finally {
        if (browser) await browser.close();
    }
})();
