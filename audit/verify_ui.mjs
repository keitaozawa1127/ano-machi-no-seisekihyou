/**
 * External Audit Script: verify_ui.js
 * 
 * This script performs OBJECTIVE verification of the UI state.
 * Exit Code 0 = PASS (submission allowed)
 * Exit Code 1 = FAIL (submission blocked)
 */

import { chromium } from 'playwright';

const STABILIZATION_WAIT_MS = 3000; // Mandatory 3 second wait per rules.md

async function runAudit() {
    console.log('=================================================');
    console.log('       EXTERNAL AUDIT SCRIPT INITIATED');
    console.log('=================================================');

    const results = {
        passed: true,
        checks: [],
        errors: []
    };

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Capture console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // --- CHECK 1: Page Load ---
        console.log('\n[CHECK 1] Page Load...');
        await page.goto('http://localhost:3000');

        // MANDATORY: Wait for stabilization (per rules.md)
        console.log(`[WAIT] Stabilization wait: ${STABILIZATION_WAIT_MS}ms`);
        await page.waitForTimeout(STABILIZATION_WAIT_MS);

        // Check for blank page (Negative Visual Assertion)
        const bodyHTML = await page.$eval('body', el => el.innerHTML);
        if (bodyHTML.trim().length < 100) {
            results.passed = false;
            results.errors.push('BLANK PAGE DETECTED: Body content too short');
        } else {
            results.checks.push('✅ Page loaded with content');
        }

        // --- CHECK 2: Tokyo Prefecture Selection ---
        console.log('\n[CHECK 2] Tokyo Prefecture Selection...');
        await page.selectOption('select:has-text("都道府県を選択")', '13');
        await page.waitForTimeout(STABILIZATION_WAIT_MS); // Wait for data load

        // --- CHECK 3: OptGroup Existence (DOM Audit) ---
        console.log('\n[CHECK 3] OptGroup DOM Audit...');
        const optgroup23 = await page.$('optgroup[label="🏙 東京23区内"]');
        const optgroupCities = await page.$('optgroup[label="🏡 市町村部"]');

        if (optgroup23) {
            const count23 = await optgroup23.$$eval('option', opts => opts.length);
            results.checks.push(`✅ Tokyo 23 Wards OptGroup EXISTS (${count23} stations)`);

            if (count23 < 20) {
                results.passed = false;
                results.errors.push(`❌ Tokyo 23 Wards OptGroup has too few stations: ${count23} (required: 20+)`);
            }
        } else {
            results.passed = false;
            results.errors.push('❌ MISSING: optgroup[label="🏙 東京23区内"]');
        }

        if (optgroupCities) {
            const countCities = await optgroupCities.$$eval('option', opts => opts.length);
            results.checks.push(`✅ Tokyo Cities OptGroup EXISTS (${countCities} stations)`);
        } else {
            results.passed = false;
            results.errors.push('❌ MISSING: optgroup[label="🏡 市町村部"]');
        }

        // --- CHECK 4: Map SVG Audit ---
        console.log('\n[CHECK 4] Map SVG Audit...');
        const paths = await page.$$('svg path');
        const pathCount = paths.length;

        if (pathCount >= 50) {
            results.checks.push(`✅ Map SVG contains ${pathCount} path elements (50+ required)`);

            // Check for colored paths
            let coloredCount = 0;
            for (const p of paths) {
                const fill = await p.getAttribute('fill');
                if (fill && fill !== '#E6E1D6') coloredCount++;
            }

            if (coloredCount > 0) {
                results.checks.push(`✅ ${coloredCount} paths have non-default colors`);
            } else {
                results.passed = false;
                results.errors.push('❌ No paths have station data (all default color)');
            }
        } else {
            results.passed = false;
            results.errors.push(`❌ INSUFFICIENT SVG PATHS: Found ${pathCount}, required 50+`);
        }

        // --- CHECK 5: Console Error Audit ---
        console.log('\n[CHECK 5] Console Error Audit...');
        const criticalErrors = consoleErrors.filter(e =>
            e.includes('Hydration failed') ||
            e.includes('Minified React error') ||
            e.includes('undefined') ||
            e.includes('null')
        );

        if (criticalErrors.length > 0) {
            results.passed = false;
            criticalErrors.forEach(e => results.errors.push(`❌ Console Error: ${e}`));
        } else {
            results.checks.push('✅ No critical console errors');
        }

    } catch (error) {
        results.passed = false;
        results.errors.push(`❌ FATAL ERROR: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }

    // --- FINAL REPORT ---
    console.log('\n=================================================');
    console.log('              AUDIT RESULTS');
    console.log('=================================================');
    results.checks.forEach(c => console.log(c));
    results.errors.forEach(e => console.log(e));
    console.log('=================================================');

    if (results.passed) {
        console.log('\n🎉 AUDIT PASSED - Exit Code 0');
        console.log('   Submission is ALLOWED');
        process.exit(0);
    } else {
        console.log('\n🚫 AUDIT FAILED - Exit Code 1');
        console.log('   Submission is BLOCKED');
        console.log('   Fix the errors above and re-run audit.');
        process.exit(1);
    }
}

runAudit();
