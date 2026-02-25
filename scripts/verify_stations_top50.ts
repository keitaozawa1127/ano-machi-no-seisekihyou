// @ts-nocheck
import fs from 'fs';
import path from 'path';

const TARGET_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');

// Known "True" values for top stations (approximate daily passengers)
const OFFICIAL_DATA: Record<string, number> = {
    "新宿": 3500000,
    "渋谷": 3300000,
    "池袋": 2600000,
    "大阪": 2300000,
    "横浜": 2300000,
    "名古屋": 1200000,
    "東京": 900000,
    "品川": 1000000,
    "新橋": 800000,
    "大宮": 700000,
    "京都": 700000,
};

async function check() {
    console.log("Reading data...");
    const data = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf-8'));
    const stations = Object.values(data) as any[];

    // Sort by volume
    stations.sort((a, b) => (b.passengerVolume || 0) - (a.passengerVolume || 0));

    const top50 = stations.slice(0, 50);

    const lines: string[] = [];
    lines.push("# Top 50 Stations Verification Report");
    lines.push("| Rank | Station | App Value (万人) | Official (万人) | Deviation |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");

    top50.forEach((s, i) => {
        const appVal = s.passengerVolume;
        const appValMan = (appVal / 10000).toFixed(1);

        let officialVal = OFFICIAL_DATA[s.name];
        let officialDisplay = "-";
        let deviation = "-";

        if (officialVal) {
            officialDisplay = (officialVal / 10000).toFixed(1);
            const diff = Math.abs(appVal - officialVal);
            const rate = (diff / officialVal) * 100;

            if (rate < 1.0) deviation = "OK";
            else deviation = `${rate.toFixed(1)}%`;
        }

        lines.push(`| ${i + 1} | ${s.name} | ${appValMan} | ${officialDisplay} | ${deviation} |`);
    });

    // Check distinct specific stations
    const CHECK_TARGETS = ["東京", "渋谷", "新宿", "池袋"];
    lines.push("\n## Specific Check");
    lines.push("| Name | Value (万人) | Data Source Status |");
    lines.push("| :--- | :--- | :--- |");

    CHECK_TARGETS.forEach(name => {
        const found = stations.find(s => s.name === name);
        if (found) {
            const appVal = found.passengerVolume;
            const appValMan = (appVal / 10000).toFixed(1);
            const status = appVal > 500000 ? "✅ OK (Major)" : "❌ ERROR (Too Low)";
            lines.push(`| ${name} | ${appValMan} | ${status} |`);
        } else {
            lines.push(`| ${name} | NOT FOUND | ❌ MISSING |`);
        }
    });

    const outPath = path.join(process.cwd(), 'top50_check.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Report written to ${outPath}`);
}

check();
