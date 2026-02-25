// @ts-nocheck
import fs from 'fs';
import path from 'path';

const STATIONS_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');
const PATCH_PATH = path.join(process.cwd(), 'station_data_clean_patch.json');

// Standard Prefectures Map (Name -> Code) for verification
const PREF_MAP: Record<string, string> = {
    "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05", "山形県": "06", "福島県": "07",
    "茨城県": "08", "栃木県": "09", "群馬県": "10", "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14",
    "新潟県": "15", "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
    "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25", "京都府": "26", "大阪府": "27",
    "兵庫県": "28", "奈良県": "29", "和歌山県": "30", "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34",
    "山口県": "35", "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
    "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45", "鹿児島県": "46", "沖縄県": "47"
};

async function main() {
    console.log('Starting Patch Application...');

    // Load Data
    const rawData = fs.readFileSync(STATIONS_PATH, 'utf-8');
    const stations = JSON.parse(rawData);

    // Load Patch
    if (!fs.existsSync(PATCH_PATH)) {
        console.error('Patch file not found!');
        process.exit(1);
    }
    const patchToken = fs.readFileSync(PATCH_PATH, 'utf-8');
    const patch = JSON.parse(patchToken);

    console.log(`Target File Size: ${(rawData.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Patch Entries: ${Object.keys(patch).length}`);

    // Apply Patch
    let appliedCount = 0;
    for (const key of Object.keys(patch)) {
        if (stations[key]) {
            // Apply updates
            Object.assign(stations[key], patch[key]);
            appliedCount++;
        }
    }
    console.log(`Applied ${appliedCount} updates.`);

    // Save
    const updatedJson = JSON.stringify(stations, null, 2);
    fs.writeFileSync(STATIONS_PATH, updatedJson);
    console.log(`File Saved. New Size: ${(updatedJson.length / 1024 / 1024).toFixed(2)} MB`);

    // Post-Validation
    console.log('Running Post-Application Validation...');
    const errors = [];
    let checkedCount = 0;

    for (const key of Object.keys(stations)) {
        const s = stations[key];
        const expectedCode = PREF_MAP[s.prefecture];
        if (expectedCode && expectedCode !== s.prefCode) {
            errors.push({ key, name: s.name, pref: s.prefecture, code: s.prefCode });
        }
        checkedCount++;
    }

    console.log(`Checked ${checkedCount} stations.`);
    if (errors.length === 0) {
        console.log('SUCCESS: 0 Mismatches found.');

        // Verify Nakayama specific check
        const nakayama = stations['中山_神奈川県'];
        if (nakayama) {
            console.log('Verification [Nakayama_Kanagawa]:', JSON.stringify(nakayama));
            if (nakayama.prefCode === '14') console.log('Nakayama OK: 14 matches Kanagawa');
        }

    } else {
        console.error(`FAILURE: Found ${errors.length} remaining mismatches.`);
        console.log(JSON.stringify(errors.slice(0, 3), null, 2));
    }

}

main().catch(console.error);
