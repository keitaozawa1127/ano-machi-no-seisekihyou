// @ts-nocheck
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const OUT_FILE = path.join(__dirname, '../data/ipss_population_2023_all.xlsx');

async function inspect() {
    const workbook = xlsx.readFile(OUT_FILE);
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const out = [];
    for (let i = 0; i < 20; i++) {
        out.push(rows[i]);
    }
    fs.writeFileSync(path.join(__dirname, 'first_rows.json'), JSON.stringify(out, null, 2));
    console.log("Wrote first_rows.json");
}
inspect().catch(console.error);
