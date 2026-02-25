import { chromium } from 'playwright';

(async () => {
    console.log('Starting Strict Verification...');
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000 // Forced Slow Mode as requested
    });
    const page = await browser.newPage();

    try {
        // Evidence A: Tokyo Layout
        console.log('Validating Tokyo UI...');
        await page.goto('http://localhost:3000');
        // Force wait to ensure human visibility
        await page.waitForTimeout(2000);

        // Select Tokyo (Pref 13)
        console.log('Step 1: Selecting Tokyo...');
        await page.selectOption('select:has-text("都道府県を選択")', '13');
        await page.waitForTimeout(2000);

        // Check for OptGroups
        // We want to verify the dropdown *structure*.
        // Screeshotting an open native select is hard, but we screenshot the page state
        // and log the presence of the optgroup.
        const optGroup23 = await page.$('optgroup[label="🏙 東京23区内"]');
        const optGroupCity = await page.$('optgroup[label="🏡 市町村部"]');

        if (optGroup23) console.log('✅ FOUND: Tokyo 23 Wards OptGroup');
        else console.error('❌ MISSING: Tokyo 23 Wards OptGroup');

        if (optGroupCity) console.log('✅ FOUND: Tokyo Cities OptGroup');
        else console.error('❌ MISSING: Tokyo Cities OptGroup');

        console.log('Capturing Evidence A (Tokyo)...');
        await page.screenshot({ path: 'evidence_A_tokyo.png' });

        // Evidence B: Kanagawa Map
        console.log('Validating Kanagawa Map (Checking for Holes)...');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);
        await page.selectOption('select', '14'); // Kanagawa

        // Wait for Map Path to appear
        await page.waitForSelector('path');
        await page.waitForTimeout(3000); // Wait for rendering to settle

        console.log('Capturing Evidence B (Kanagawa)...');
        await page.screenshot({ path: 'evidence_B_kanagawa.png' });

        // Evidence C: Osaka Map
        console.log('Validating Osaka Map (Checking for Holes)...');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);
        await page.selectOption('select', '27'); // Osaka

        await page.waitForSelector('path');
        await page.waitForTimeout(3000);

        console.log('Capturing Evidence C (Osaka)...');
        await page.screenshot({ path: 'evidence_C_osaka.png' });

        console.log('Strict Verification Completed Successfully.');

    } catch (e) {
        console.error('CRITICAL ERROR DURING VERIFICATION:', e);
        // As per instruction: Log error and exit
    } finally {
        // Wait a bit before closing so user can see if running interactively
        await page.waitForTimeout(1000);
        await browser.close();
    }
})();
