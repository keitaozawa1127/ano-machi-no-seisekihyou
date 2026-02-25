// @ts-nocheck
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'public/data');

const audit = () => {
    console.log("Starting Granularity Audit...");
    const files = fs.readdirSync(dataDir).filter(f => f.match(/^\d{2}\.json$/));
    const badFiles: string[] = [];
    const goodFiles: string[] = [];

    files.forEach(f => {
        try {
            const content = fs.readFileSync(path.join(dataDir, f), 'utf-8');
            const json = JSON.parse(content);
            const count = json.features?.length || 0;

            if (count < 2) {
                console.log(`[FAIL] ${f}: ${count} features (Needs Fix)`);
                badFiles.push(f.replace('.json', ''));
            } else {
                console.log(`[PASS] ${f}: ${count} features`);
                goodFiles.push(f);
            }
        } catch (e: any) {
            console.log(`[ERROR] ${f}: Invalid JSON`);
            badFiles.push(f.replace('.json', ''));
        }
    });

    console.log("\nAudit Complete.");
    console.log(`Good: ${goodFiles.length}`);
    console.log(`Bad: ${badFiles.length}`);
    if (badFiles.length > 0) {
        console.log(`Prefectures to Fix: ${badFiles.join(", ")}`);
    }
};

audit();
