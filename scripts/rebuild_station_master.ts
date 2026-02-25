import fs from 'fs';
import path from 'path';

const TARGET_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');
const REF_PATH = path.join(process.cwd(), 'temp_reference_stations.json');
const REPORT_PATH = path.join(process.cwd(), 'station_rebuild_report.json');

// Normalization Helpers
const normalize = (s: string) => s.replace(/[ヶケ]/g, 'ヶ').replace(/[ノ之]/g, 'ノ').trim();

// Pref Map
const PREF_NAME_TO_CODE: Record<string, string> = {
    "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05", "山形県": "06", "福島県": "07",
    "茨城県": "08", "栃木県": "09", "群馬県": "10", "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14",
    "新潟県": "15", "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
    "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25", "京都府": "26", "大阪府": "27",
    "兵庫県": "28", "奈良県": "29", "和歌山県": "30", "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34",
    "山口県": "35", "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
    "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45", "鹿児島県": "46", "沖縄県": "47"
};

async function main() {
    console.log('Starting Station Master Rebuild...');

    // Load Data
    const targetData = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf-8'));
    const refData = JSON.parse(fs.readFileSync(REF_PATH, 'utf-8')); // This is an Array of Prefectures

    // 1. Build Reference Index
    console.log('Building Reference Index...');
    const refIndex: Record<string, { pref: string, lines: string[], address: string }[]> = {};

    // refData is [ { name: {ja: "Hokkaido"}, lines: [ { name: {ja: "Line"}, stations: [...] } ] } ]

    // We need to handle the structure carefully.
    // Based on snippet: Pref -> Lines -> Stations

    let refStationCount = 0;

    for (const prefObj of refData) {
        // prefObj.name.ja might be "北海道"
        const currentPrefName = prefObj.name?.ja;

        if (!prefObj.lines) continue;

        for (const lineObj of prefObj.lines) {
            const lineName = lineObj.name?.ja || "";
            if (!lineObj.stations) continue;

            for (const stationObj of lineObj.stations) {
                const rawName = stationObj.name?.ja;
                if (!rawName) continue;

                const name = normalize(rawName);

                // Extract precise address if available
                const loc = stationObj.location;
                // Prefer location.administrativeArea1.ja over parent prefObj (checked by Yanoguchi case)
                const precisePref = loc?.administrativeArea1?.ja || currentPrefName;
                const city = loc?.locality1?.ja || "";

                if (!refIndex[name]) refIndex[name] = [];

                // Deduplicate entry for same station on multiple lines
                const existing = refIndex[name].find(e => e.pref === precisePref);
                if (existing) {
                    if (!existing.lines.includes(lineName)) existing.lines.push(lineName);
                } else {
                    refIndex[name].push({
                        pref: precisePref,
                        lines: [lineName],
                        address: city
                    });
                }
                refStationCount++;
            }
        }
    }
    console.log(`Indexed ${refStationCount} reference stations.`);

    // 2. Patch Target
    const report: any[] = [];
    let patchedCount = 0;

    for (const key of Object.keys(targetData)) {
        const station = targetData[key];
        const normName = normalize(station.name);

        const candidates = refIndex[normName];

        if (!candidates) {
            // No strict match found in Reference
            // Keep as is, or flag? ignoring for now to avoid breaking smaller stations reference might miss
            continue;
        }

        // Find Best Match by Line overlap
        // Station lines: ["JR南武線"]
        // Candidate lines: ["JR南武線(川崎～立川)"]

        let bestMatch = null;
        let maxScore = -1;

        for (const cand of candidates) {
            let score = 0;
            for (const tLine of station.lines) {
                const tNorm = normalize(tLine);
                for (const cLine of cand.lines) {
                    const cNorm = normalize(cLine);
                    if (cNorm.includes(tNorm) || tNorm.includes(cNorm)) {
                        score++;
                    }
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestMatch = cand;
            }
        }

        if (bestMatch && maxScore > 0) {
            // We found a line match. Verify/Patch Prefecture.
            const oldPref = station.prefecture;
            const newPref = bestMatch.pref;
            const expectedCode = PREF_NAME_TO_CODE[newPref];

            const needsUpdate = (oldPref !== newPref) || (station.prefCode !== expectedCode);
            const isNameNorm = (station.name !== normName); // Just check internal normalization

            if (needsUpdate) {
                station.prefecture = newPref;
                station.prefCode = expectedCode;
                // Optional: Update municipalities/address if empty
                if (!station.municipalities || station.municipalities.length === 0) {
                    station.municipalities = [bestMatch.address];
                }

                report.push({
                    key,
                    name: station.name,
                    change: { from: oldPref, to: newPref },
                    reason: `Reference matched on lines: ${bestMatch.lines.slice(0, 2).join(',')}`
                });
                patchedCount++;
            }
        }
    }

    // 3. Save
    fs.writeFileSync(TARGET_PATH, JSON.stringify(targetData, null, 2));
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log(`Patch Complete. Updated ${patchedCount} stations.`);
    console.log(`Report saved to ${REPORT_PATH}`);

    // Yanoguchi Check
    const yanoguchi = Object.values(targetData).find((s: any) => s.name === '矢野口') as any;
    if (yanoguchi) {
        console.log(`VERIFICATION [Yanoguchi]: ${yanoguchi.prefecture} (Code: ${yanoguchi.prefCode})`);
    } else {
        console.log('VERIFICATION [Yanoguchi]: Not found in target?');
    }
}

main().catch(console.error);
