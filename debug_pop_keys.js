
const fs = require('fs');
const path = require('path');

const POPULATION_DATA_FILE = path.join(process.cwd(), 'data', 'population_projection.json');

try {
    const raw = fs.readFileSync(POPULATION_DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const keys = Object.keys(data);

    console.log("Total keys:", keys.length);

    const target = "川崎市中原区";
    console.log(`Checking for "${target}":`, keys.includes(target));

    const target2 = "新宿区";
    console.log(`Checking for "${target2}":`, keys.includes(target2));

    // Fuzzy check
    const fuzzy = keys.find(k => k.includes("中原区"));
    console.log(`Fuzzy match for "中原区":`, fuzzy);

    if (fuzzy) {
        console.log(`Key code for fuzzy match:`, fuzzy.split('').map(c => c.charCodeAt(0)));
    }

} catch (e) {
    console.error(e);
}
