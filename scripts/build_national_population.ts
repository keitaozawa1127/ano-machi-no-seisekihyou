import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const EXCEL_PATH = path.join(__dirname, '../data/ipss_population_2023_all.xlsx');
const OUT_JSON = path.join(__dirname, '../data/population_projection.json');

async function build() {
    console.log(`[1] Loading Excel file from ${EXCEL_PATH}...`);
    if (!fs.existsSync(EXCEL_PATH)) {
        console.error("Excel file not found. Run inspect_ipss_excel.ts or download it first.");
        return;
    }

    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    console.log(`[2] Parsing sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Find headers
    const headerRowIdx = 3;
    const headers = rows[headerRowIdx];

    const colPref = headers.indexOf("都道府県");
    const colCity = headers.indexOf("市区町村");
    const colYear = headers.indexOf("年");
    const colTotal = headers.indexOf("総数");
    const colCode = headers.indexOf("コード");

    const col0_14 = headers.findIndex(h => typeof h === 'string' && h.includes("0～14歳") && h.includes("再掲"));
    const col15_64 = headers.findIndex(h => typeof h === 'string' && h.includes("15～64歳") && h.includes("再掲"));
    const col65_plus = headers.findIndex(h => typeof h === 'string' && h.includes("65歳以上") && h.includes("再掲"));

    if (colPref === -1 || colCity === -1 || colYear === -1 || colTotal === -1 || col0_14 === -1) {
        console.error("Could not find required columns. Headers:", headers.map((h, i) => `${i}:${h}`).join(", "));
        return;
    }

    console.log(`[3] Headers mapped. Index -> Pref:${colPref}, City:${colCity}, Year:${colYear}, Total:${colTotal}, 0-14:${col0_14}, 15-64:${col15_64}, 65+:${col65_plus}`);

    const result: any = {};
    let processedRows = 0;

    // Data starts from row 5 (index 4 or later)
    for (let i = 5; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < colTotal) continue;

        const prefName = row[colPref];
        const cityName = row[colCity];
        const yearStr = row[colYear];

        if (!prefName || !yearStr) continue;

        // "北海道" etc. can be both pref and city in some contexts, but usually city is null for pref total.
        // If city is null or empty, it means prefecture total or national total. We skip those, or we can keep them!
        // The MLIT matching looks for `city`.
        if (!cityName || typeof cityName !== 'string') {
            continue; // Skip whole prefecture totals
        }

        const cleanYear = parseInt(String(yearStr).replace("年", "").trim());
        if (isNaN(cleanYear)) continue;

        const totalPop = row[colTotal] === '-' || row[colTotal] === '…' ? 0 : parseInt(String(row[colTotal]));
        const pop0_14 = row[col0_14] === '-' || row[col0_14] === '…' ? 0 : parseInt(String(row[col0_14]));
        const pop15_64 = row[col15_64] === '-' || row[col15_64] === '…' ? 0 : parseInt(String(row[col15_64]));
        const pop65_plus = row[col65_plus] === '-' || row[col65_plus] === '…' ? 0 : parseInt(String(row[col65_plus]));

        // Generate a unique key for the dictionary
        const key = `${prefName}_${cityName}`;

        if (!result[key]) {
            result[key] = {
                code: String(row[colCode] || ""),
                prefecture: prefName,
                city: cityName,
                data: []
            };
        }

        result[key].data.push({
            year: cleanYear,
            total: totalPop,
            ageStructure: {
                "0-14": pop0_14,
                "15-64": pop15_64,
                "65+": pop65_plus
            }
        });

        processedRows++;
    }

    console.log(`[4] Finished processing ${processedRows} rows. Found ${Object.keys(result).length} unique municipalities.`);

    // Write to JSON
    fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
    console.log(`[5] Wrote output to ${OUT_JSON} (${fs.statSync(OUT_JSON).size} bytes).`);
}

build().catch(console.error);
