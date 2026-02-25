const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 1. 環境変数の物理注入 (Hard injection)
const userProfile = process.env.USERPROFILE || 'C:\\Users\\kozaw';
process.env.HOME = userProfile;
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(userProfile, '.cache', 'ms-playwright');

console.log('--- Environment Setup ---');
console.log('HOME:', process.env.HOME);
console.log('PLAYWRIGHT_BROWSERS_PATH:', process.env.PLAYWRIGHT_BROWSERS_PATH);

(async () => {
    console.log('--- Launching VISIBLE Browser (Look at your screen!) ---');
    const browser = await chromium.launch({
        headless: false, // Show the browser UI
        slowMo: 1000     // Slow down operations by 1 second so user can see
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to http://localhost:3000 ...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

        // Screenshot Directory
        const artifactDir = path.join(__dirname, '..', 'artifacts');
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir);

        // --- 1. 大阪府 (Osaka) ---
        console.log('Selecting Osaka (27)...');
        await page.selectOption('select', '27');
        // Wait for rendering (async coloring)
        await page.waitForTimeout(5000);

        console.log('Taking screenshot: osaka_map.png');
        await page.screenshot({ path: path.join(artifactDir, 'osaka_map.png') });

        // Hover Osaka City (Largest area usually has many stations)
        // Trying to find a path that is likely Osaka City. 
        // Since we don't know the exact DOM index, we'll try to find a large path or by name if cached.
        // Actually, let's just hover the center of the SVG to hit *something*.
        const svg = await page.$('svg');
        if (svg) {
            const box = await svg.boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.waitForTimeout(1000);
                console.log('Taking screenshot: osaka_hover.png');
                await page.screenshot({ path: path.join(artifactDir, 'osaka_hover.png') });
            }
        }

        // --- 2. 神奈川県 (Kanagawa) ---
        console.log('Selecting Kanagawa (14)...');
        await page.selectOption('select', '14');
        await page.waitForTimeout(4000);
        console.log('Taking screenshot: kanagawa_map.png');
        await page.screenshot({ path: path.join(artifactDir, 'kanagawa_map.png') });

        // --- 3. 東京都 (Tokyo) ---
        console.log('Selecting Tokyo (13)...');
        await page.selectOption('select', '13');
        await page.waitForTimeout(4000);
        console.log('Taking screenshot: tokyo_map.png');
        await page.screenshot({ path: path.join(artifactDir, 'tokyo_map.png') });

        // Verify Optgroup
        console.log('Checking "Tokyo 23 Wards" optgroup...');
        const optgroup = await page.$('optgroup[label="🏙 東京23区内"]'); // Using the exact label with emoji
        if (optgroup) {
            console.log('✅ Optgroup found: 🏙 東京23区内');
        } else {
            console.log('❌ Optgroup NOT found');
            // Check HTML
            const selectHtml = await page.$eval('select:nth-of-type(2)', el => el.innerHTML); // The station select
            console.log('Station Select HTML snippet:', selectHtml.substring(0, 500));
        }

        await page.screenshot({ path: path.join(artifactDir, 'tokyo_ui.png') });

    } catch (e) {
        console.error('Error during verification:', e);
    } finally {
        await browser.close();
        console.log('--- Verification Complete ---');
    }
})();

export {};
