import playwright from 'playwright';
const { chromium } = playwright;
import type { Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

/**
 * FINAL PHYSICAL EXECUTION: ZERO HALLUCINATION TOLERANCE
 * 
 * 1. GOOGLE SEARCH FORCED (Yahoo abolished)
 * 2. PORTAL URL PROHIBITION (トップページの保存を厳禁)
 * 3. DEEP LINK EXTRACTION (PDF・詳細ページまで到達)
 * 4. EXHAUSTIVE COLLECTION (50% threshold, minimum 10 items for major stations)
 */

type RedevelopmentCategory = 'Redevelopment' | 'Infrastructure' | 'Mansion' | 'Public' | 'Commercial';

interface RedevelopmentEntry {
    station_name: string;
    project_name: string;
    category: RedevelopmentCategory;
    schedule: string;
    description: string;
    source_url: string;
    verified_at: string;
    impact_level: number; // 2-5 only
}

const TARGET_STATIONS = [
    "東京", "新宿", "渋谷", "池袋", "横浜",
    "品川", "大阪", "梅田", "名古屋", "博多"
];

// PORTAL URL PATTERNS (STRICT PROHIBITION)
const PORTAL_URL_PATTERNS = [
    /^https?:\/\/www\.city\.[a-z]+\.lg\.jp\/?$/,  // https://www.city.fukuoka.lg.jp/
    /^https?:\/\/[a-z]+\.lg\.jp\/?$/,             // https://fukuoka.lg.jp/
    /^https?:\/\/www\.[a-z]+\.go\.jp\/?$/,        // https://www.metro.tokyo.lg.jp/
];

const ERROR_KEYWORDS = [
    "お探しのページは見つかりません",
    "お探しのページは見てかりません", // Typo variation
    "期限切れ", "404", "Not Found", "削除された", "移動しました",
    "ページが存在しません", "アクセスできません", "エラー",
    "セッションが切れました", "セッションタイムアウト"
];

// --- ENHANCED REGEX FOR NUMERIC EXTRACTION ---

function extractNumber(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    if (!match) return null;

    // Normalize: full-width → half-width, remove commas
    const numStr = match[1]
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/,|，/g, '');

    return parseInt(numStr, 10);
}

/**
 * ENHANCED Impact Level Calculation with 50% Threshold
 */
function calculateImpactAndFilter(content: string, category: RedevelopmentCategory): number | null {
    let impact = 2; // Minimum acceptable level

    // --- Lv.5 Triggers (Urban Transformation) ---
    if (content.match(/新線|新駅|延伸開業/)) impact = 5;

    // Height: ≥180m OR ≥40F
    const heightMatch = extractNumber(content, /高さ[^0-9０-９]*([0-9０-９,，]+)m/);
    const floorMatch = extractNumber(content, /地上[^0-9０-９]*([0-9０-９,，]+)階/);
    if ((heightMatch && heightMatch >= 180) || (floorMatch && floorMatch >= 40)) impact = 5;

    // Units: ≥1000
    const unitsMatch = extractNumber(content, /([0-9０-９,，]+)戸/);
    if (unitsMatch && unitsMatch >= 1000) impact = 5;

    // --- Lv.4 (Hub Formation) ---
    if (impact < 5) {
        if (unitsMatch && unitsMatch >= 500) impact = 4;
        if ((heightMatch && heightMatch >= 100) || (floorMatch && floorMatch >= 30)) impact = 4;
        if (content.match(/大学.*移転|キャンパス.*開設/)) impact = 4;
        if (content.match(/病院.*([1-9][0-9]{2,})床/)) impact = 4; // 100+ beds
        if (content.match(/駅ビル.*建替|駅前.*大規模.*再開発/)) impact = 4;
    }

    // --- Lv.3 (Environment Improvement) ---
    if (impact < 4) {
        if (unitsMatch && unitsMatch >= 300) impact = 3;
        if (floorMatch && floorMatch >= 20) impact = 3;

        const parkMatch = extractNumber(content, /公園.*([0-9０-９,，]+)m2|([0-9０-９,，]+)平方メートル/);
        if (parkMatch && parkMatch >= 3000) impact = 3;

        if (content.match(/デッキ.*整備|歩行者空間|広場.*整備/)) impact = 3;
    }

    // --- Lv.2 Filter (Minimum Threshold) ---
    if (impact < 3) {
        if (unitsMatch && unitsMatch >= 100) impact = 2;
        if (floorMatch && floorMatch >= 15) impact = 2;
        if (content.match(/駅前広場.*再編|バスターミナル.*整備/)) impact = 2;
    }

    // --- 50% Threshold Rejection ---
    if (unitsMatch && unitsMatch < 50) return null; // Too small
    if (floorMatch && floorMatch < 7 && !content.match(/新線|延伸/)) return null; // Too small

    // Reject Lv.1
    if (impact < 2) return null;

    return impact;
}

function determineCategory(content: string): RedevelopmentCategory {
    if (content.includes('新線') || content.includes('延伸') || content.includes('新駅')) return 'Infrastructure';
    if (content.includes('病院') || content.includes('大学') || content.includes('公園') || content.includes('Park-PFI')) return 'Public';
    if (content.includes('マンション') || content.includes('レジデンス') || content.includes('住宅')) return 'Mansion';
    if (content.includes('商業施設') || content.includes('ショッピング') || content.includes('モール')) return 'Commercial';
    return 'Redevelopment';
}

// --- DEEP LINK EXTRACTION (PDF・詳細ページまで到達) ---

async function extractDeepLinks(page: Page): Promise<string[]> {
    try {
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors
                .filter(a => {
                    const text = a.textContent || '';
                    const href = a.href || '';
                    return (
                        text.includes('PDF') ||
                        text.includes('詳細') ||
                        text.includes('計画概要') ||
                        text.includes('事業内容') ||
                        text.includes('プロジェクト') ||
                        href.includes('.pdf') ||
                        href.includes('project') ||
                        href.includes('plan')
                    );
                })
                .map(a => a.href)
                .filter(href => href && href.startsWith('http'))
                .slice(0, 5); // Top 5 deep links
        });

        return links;
    } catch {
        return [];
    }
}

// --- PHYSICAL URL VERIFICATION WITH PORTAL PROHIBITION ---

async function verifyUrlAndExtractDeep(page: Page, url: string): Promise<{ finalUrl: string; content: string } | null> {
    try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!response || response.status() >= 400) return null;

        // Wait for redirect settlement
        await page.waitForTimeout(2000);

        // Physical URL capture
        let finalUrl = page.url();
        finalUrl = finalUrl.split('?')[0].split('#')[0]; // Clean URL

        // PORTAL URL PROHIBITION (STRICT)
        if (PORTAL_URL_PATTERNS.some(pattern => pattern.test(finalUrl))) {
            console.log(`   🚫 PORTAL URL REJECTED: ${finalUrl}`);
            return null;
        }

        // Get content
        let content = await page.evaluate(() => document.body.innerText);

        // ERROR KEYWORD DETECTION (Immediate Rejection)
        if (ERROR_KEYWORDS.some(k => content.includes(k))) {
            console.log(`   ❌ Error Page Detected: ${finalUrl}`);
            return null;
        }

        // DEEP LINK EXTRACTION: If this looks like a portal/index page, try to go deeper
        const isPortalPage = (
            content.includes('一覧') ||
            content.includes('目次') ||
            (content.includes('プロジェクト') && content.length < 5000)
        );

        if (isPortalPage) {
            const deepLinks = await extractDeepLinks(page);

            for (const deepLink of deepLinks) {
                try {
                    const deepResponse = await page.goto(deepLink, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    if (deepResponse && deepResponse.status() < 400) {
                        await page.waitForTimeout(1000);
                        const deepFinalUrl = page.url().split('?')[0].split('#')[0];

                        // Check if deep URL is also portal
                        if (PORTAL_URL_PATTERNS.some(pattern => pattern.test(deepFinalUrl))) {
                            continue;
                        }

                        const deepContent = await page.evaluate(() => document.body.innerText);

                        // Check if deep page has more substance
                        if (deepContent.length > content.length && !ERROR_KEYWORDS.some(k => deepContent.includes(k))) {
                            finalUrl = deepFinalUrl;
                            content = deepContent;
                            console.log(`   🔗 Deep Link Upgraded: ${finalUrl}`);
                            break; // Use this deep link
                        }
                    }
                } catch {
                    continue; // Skip failed deep links
                }
            }
        }

        return { finalUrl, content };

    } catch (e) {
        console.error(`   Error verifying ${url}:`, e);
        return null;
    }
}

// --- EXHAUSTIVE COLLECTION WITH GOOGLE SEARCH ---

async function collectForStation(context: BrowserContext, stationName: string): Promise<RedevelopmentEntry[]> {
    const page = await context.newPage();
    const results: RedevelopmentEntry[] = [];
    const seenUrls = new Set<string>();

    // EXHAUSTIVE keyword set (7 keywords)
    const keywords = [
        "再開発",
        "新線 OR 延伸 OR 新駅",
        "タワーマンション OR 大規模マンション OR レジデンス",
        "Park-PFI OR 大規模公園 OR 防災公園",
        "大学移転 OR 病院移転 OR キャンパス",
        "駅ビル建替 OR 駅前開発",
        "都市計画 OR まちづくり OR 市街地再開発"
    ];

    console.log(`\n🔍 [${stationName}] Exhaustive Collection Started`);

    for (const keyword of keywords) {
        try {
            const query = `"${stationName}駅" ${keyword} (site:lg.jp OR site:co.jp)`;

            // GOOGLE SEARCH (FORCED)
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`,
                { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            // Extract search result links
            const links = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a'));
                return anchors
                    .map(a => a.getAttribute('href') || '')
                    .filter(href => href.startsWith('http') && !href.includes('google.com'))
                    .filter(href => href.match(/\.lg\.jp|\.co\.jp/))
                    .slice(0, 10); // Top 10 per keyword
            });

            console.log(`   Keyword "${keyword}": Found ${links.length} links`);

            for (const link of links) {
                if (seenUrls.has(link)) continue;

                const verified = await verifyUrlAndExtractDeep(page, link);
                if (!verified || seenUrls.has(verified.finalUrl)) continue;
                seenUrls.add(verified.finalUrl);

                const { finalUrl, content } = verified;

                // Category & Impact
                const category = determineCategory(content);
                const impact_level = calculateImpactAndFilter(content, category);

                if (!impact_level) {
                    console.log(`   ❌ Below Threshold: ${finalUrl}`);
                    continue;
                }

                // Data Extraction
                const sentences = content.split(/[。\n]/).filter(s => s.length > 20);
                const numericSentences = sentences.filter(s =>
                    s.match(/[0-9０-９]/) &&
                    (s.includes('年') || s.includes('戸') || s.includes('階') || s.includes('m') || s.includes('メートル'))
                );

                if (numericSentences.length === 0) continue;

                let description = numericSentences.slice(0, 3).join('。');
                if (description.length > 300) description = description.substring(0, 300) + '...';

                const scheduleMatch = content.match(/([2２][0-9０-９]{3}|令和[0-9０-９]{1,2})年度?[の\s]*(完了|竣工|開業|完成|予定)/);
                const schedule = scheduleMatch ? scheduleMatch[0] : '計画進行中';

                // Name extraction
                let projectName = `${stationName}周辺${category === 'Infrastructure' ? '基盤整備' : '再開発'}`;
                const title = await page.title();
                const cleanTitle = title.split(/\||-|_/)[0].trim();
                if (cleanTitle.length > 5 && cleanTitle.length < 60) projectName = cleanTitle;

                results.push({
                    station_name: stationName,
                    project_name: projectName,
                    category,
                    schedule,
                    description,
                    source_url: finalUrl,
                    verified_at: new Date().toISOString(),
                    impact_level
                });

                console.log(`   ✅ [Lv.${impact_level}] ${projectName}`);
            }

        } catch (e) {
            console.error(`   Error with keyword "${keyword}":`, e);
        }
    }

    await page.close();

    // EXHAUSTIVE COLLECTION CHECK
    const majorStations = ["東京", "新宿", "渋谷", "大阪", "横浜"];
    if (majorStations.includes(stationName) && results.length < 10) {
        console.log(`   ⚠️ WARNING: ${stationName} has only ${results.length} items (expected ≥10). NON-COMPLIANCE DETECTED.`);
    }

    console.log(`   Total Collected: ${results.length} items`);
    return results;
}

// --- MAIN ---

async function main() {
    console.log('🚀 FINAL PHYSICAL EXECUTION STARTED\n');
    console.log('Features: GOOGLE SEARCH | PORTAL PROHIBITION | DEEP URL EXTRACTION | 50% THRESHOLD\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50,
        args: ['--disable-blink-features=AutomationControlled'] // Anti-detection
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const allResults: RedevelopmentEntry[] = [];

    for (const station of TARGET_STATIONS) {
        const results = await collectForStation(context, station);
        allResults.push(...results);

        // Brief pause between stations
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await browser.close();

    // Save
    const outPath = path.join(process.cwd(), 'data/redevelopment_master.json');
    await fs.writeFile(outPath, JSON.stringify(allResults, null, 2));

    // Report
    console.log('\n--- COLLECTION REPORT ---');
    console.log(`Total Entries: ${allResults.length}`);
    console.log(`Lv.5 (Urban Transform): ${allResults.filter(r => r.impact_level === 5).length}`);
    console.log(`Lv.4 (Hub Formation): ${allResults.filter(r => r.impact_level === 4).length}`);
    console.log(`Lv.3 (Environment): ${allResults.filter(r => r.impact_level === 3).length}`);
    console.log(`Lv.2 (Functional Update): ${allResults.filter(r => r.impact_level === 2).length}`);
    console.log(`\nData saved to: ${outPath}`);

    // Compliance Check
    console.log('\n--- STATION COVERAGE (COMPLIANCE CHECK) ---');
    const stationCounts = TARGET_STATIONS.map(s => ({
        station: s,
        count: allResults.filter(r => r.station_name === s).length
    }));

    stationCounts.forEach(({ station, count }) => {
        const majorStations = ["東京", "新宿", "渋谷", "大阪", "横浜"];
        const threshold = majorStations.includes(station) ? 10 : 5;
        const status = count >= threshold ? '✅' : '⚠️';
        console.log(`${status} ${station}: ${count} items (threshold: ${threshold})`);
    });
}

main().catch(console.error);
