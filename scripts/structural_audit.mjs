import { chromium } from 'playwright';

(async () => {
    console.log('=== STRUCTURAL AUDIT SCRIPT ===');
    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });
    const page = await browser.newPage();
    const results = {
        optgroup_23_exists: false,
        optgroup_cities_exists: false,
        stations_in_23: [],
        stations_in_cities: [],
        map_paths_count: 0,
        map_paths_colored: 0
    };

    try {
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);

        // Select Tokyo
        console.log('[AUDIT] Selecting Tokyo...');
        await page.selectOption('select:has-text("都道府県を選択")', '13');
        await page.waitForTimeout(5000); // Wait for map + stations to load

        // --- OPTGROUP AUDIT ---
        console.log('[AUDIT] Checking Optgroups...');
        const optgroup23 = await page.$('optgroup[label="🏙 東京23区内"]');
        const optgroupCities = await page.$('optgroup[label="🏡 市町村部"]');

        results.optgroup_23_exists = !!optgroup23;
        results.optgroup_cities_exists = !!optgroupCities;

        if (optgroup23) {
            const options = await optgroup23.$$eval('option', opts => opts.slice(0, 5).map(o => o.textContent));
            results.stations_in_23 = options;
        }
        if (optgroupCities) {
            const options = await optgroupCities.$$eval('option', opts => opts.slice(0, 5).map(o => o.textContent));
            results.stations_in_cities = options;
        }

        // --- SVG MAP AUDIT ---
        console.log('[AUDIT] Checking Map SVG Paths...');
        const paths = await page.$$('svg path');
        results.map_paths_count = paths.length;

        // Count colored paths (non-default fill)
        let coloredCount = 0;
        for (const p of paths) {
            const fill = await p.getAttribute('fill');
            if (fill && fill !== '#E6E1D6') coloredCount++; // MUJI.unselected is #E6E1D6
        }
        results.map_paths_colored = coloredCount;

        // --- OUTPUT ---
        console.log('\n========== STRUCTURAL AUDIT RESULTS ==========');
        console.log(`optgroup_23_exists: ${results.optgroup_23_exists}`);
        console.log(`optgroup_cities_exists: ${results.optgroup_cities_exists}`);
        console.log(`stations_in_23 (sample): ${JSON.stringify(results.stations_in_23)}`);
        console.log(`stations_in_cities (sample): ${JSON.stringify(results.stations_in_cities)}`);
        console.log(`map_paths_count: ${results.map_paths_count}`);
        console.log(`map_paths_colored: ${results.map_paths_colored}`);
        console.log('===============================================\n');

        // Screenshots
        console.log('[AUDIT] Capturing Screenshots...');
        await page.screenshot({ path: 'audit_tokyo_full.png', fullPage: true });

        // Click station dropdown to capture open state
        const stationSelect = await page.$('select:has-text("駅")');
        if (stationSelect) await stationSelect.focus();
        await page.screenshot({ path: 'audit_tokyo_dropdown.png' });

        console.log('[AUDIT] COMPLETE');

    } catch (e) {
        console.error('AUDIT ERROR:', e);
    } finally {
        await page.waitForTimeout(1000);
        await browser.close();
    }
})();
