// @ts-nocheck
import fs from 'fs';
import path from 'path';

const TARGET_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');

// Thresholds
const LOW_THRESHOLD = 100;
const HIGH_THRESHOLD = 5000000; // 500万人

// Major cities to watch out for (if they show up in low ranks)
const WATCH_LIST = [
    "千葉", "埼玉", "川口", "船橋", "西船橋", "松戸", "柏", "市川",
    "浦和", "大宮", "川崎", "武蔵小杉", "三鷹", "立川", "八王子",
    "横浜", "藤沢", "相模原", "新潟", "静岡", "浜松", "名古屋",
    "京都", "大阪", "堺", "神戸", "姫路", "岡山", "広島", "北九州",
    "福岡", "博多", "熊本", "鹿児島", "仙台", "札幌"
];

async function check() {
    console.log("Loading data...");
    const data = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf-8'));
    const stations = Object.values(data) as any[];

    console.log(`Total Stations: ${stations.length}`);

    const lines: string[] = [];
    lines.push("# Passenger Volume Audit Report");
    lines.push(`Total Stations: ${stations.length}`);

    // 1. Distribution Stats
    let zeroOrNull = 0;
    let under100 = 0;
    let range100_1k = 0;
    let range1k_10k = 0;
    let range10k_100k = 0;
    let range100k_1m = 0;
    let range1m_plus = 0;
    let over5m = 0;

    const issues_low: any[] = [];
    const issues_high: any[] = [];
    const mid_range_suspects: any[] = [];

    stations.forEach(s => {
        const vol = s.passengerVolume;

        if (!vol || vol === 0) {
            zeroOrNull++;
        } else {
            if (vol < 100) {
                under100++;
                issues_low.push({ name: s.name, vol });
            } else if (vol < 1000) {
                range100_1k++;
            } else if (vol < 10000) {
                range1k_10k++;
            } else if (vol < 100000) {
                range10k_100k++;
                // Check if a major city station is stuck here (unexpectedly low)
                if (WATCH_LIST.some(w => s.name === w)) {
                    mid_range_suspects.push({ name: s.name, vol });
                }
            } else if (vol < 1000000) {
                range100k_1m++;
            } else {
                range1m_plus++;
            }

            if (vol >= HIGH_THRESHOLD) {
                over5m++;
                issues_high.push({ name: s.name, vol });
            }
        }
    });

    lines.push("\n## Distribution");
    lines.push(`| Range | Count |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| 0 or Null | ${zeroOrNull} |`);
    lines.push(`| < 100 | ${under100} |`);
    lines.push(`| 100 - 1k | ${range100_1k} |`);
    lines.push(`| 1k - 10k | ${range1k_10k} |`);
    lines.push(`| 10k - 100k | ${range10k_100k} |`);
    lines.push(`| 100k - 1M | ${range100k_1m} |`);
    lines.push(`| > 1M | ${range1m_plus} |`);

    lines.push("\n## Anomalies: < 100");
    if (issues_low.length > 0) {
        issues_low.slice(0, 20).forEach(i => lines.push(`- ${i.name}: ${i.vol}`));
        if (issues_low.length > 20) lines.push(`- ... and ${issues_low.length - 20} more.`);
    } else {
        lines.push("- None.");
    }

    lines.push("\n## Anomalies: > 5M");
    if (issues_high.length > 0) {
        issues_high.forEach(i => lines.push(`- ${i.name}: ${i.vol}`));
    } else {
        lines.push("- None.");
    }

    lines.push("\n## Watchlist in Mid-Range (10k-100k) [Possible Hidden Majors]");
    mid_range_suspects.sort((a, b) => b.vol - a.vol);
    if (mid_range_suspects.length > 0) {
        lines.push("| Name | Volume | Note |");
        lines.push("| :--- | :--- | :--- |");
        mid_range_suspects.forEach(i => lines.push(`| ${i.name} | ${i.vol} | Check if scale x20 was enough |`));
    } else {
        lines.push("- None. All watched majors are > 100k.");
    }

    const outPath = path.join(process.cwd(), 'passenger_audit_report_raw.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Report written to ${outPath}`);
}

check();
