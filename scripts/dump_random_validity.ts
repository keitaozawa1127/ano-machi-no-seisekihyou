// @ts-nocheck
import fs from 'fs';
import path from 'path';

const TARGET_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');

async function dump() {
    const data = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf-8'));
    const stations = Object.values(data) as any[];

    // Shuffle
    for (let i = stations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stations[i], stations[j]] = [stations[j], stations[i]];
    }

    const sample = stations.slice(0, 100);

    const lines: string[] = [];
    lines.push("# Random 100 Stations Validity Check");
    lines.push("| Name | Pref | Current Volume (万人) | Estimated Original (x1/20) | Validity |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");

    sample.forEach(s => {
        const vol = s.passengerVolume;
        const valMan = (vol / 10000).toFixed(2);

        let original = (vol / 20).toFixed(0);

        // If it's very large, maybe it was overwritten, so original calc is meaningless, but let's show it anyway
        // Validity check: Is 'Original' < 100? If so, it was likely '1.8' style.
        // If Current > 1000 (0.1万), it's probably safe.
        // Threshold: 10,000 (1万) -> Original 500. 

        let validity = "✅ OK";
        if (vol < 500) validity = "❓ LOW"; // Less than 500 people/day

        lines.push("| " + s.name + " | " + s.prefecture + " | " + valMan + " | " + original + " | " + validity + " |");
    });

    const outPath = path.join(process.cwd(), 'random_100_check.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Report written to ${outPath}`);
}

dump();
