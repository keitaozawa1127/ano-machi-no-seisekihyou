const fs = require('fs');
const path = require('path');

const cacheFile = path.join(process.cwd(), 'data/cache/13_2024.json');

try {
    const data = fs.readFileSync(cacheFile, 'utf8');
    const json = JSON.parse(data);

    console.log("Total records:", json.length);
    console.log("First record keys:", Object.keys(json[0]));

    // Find first record with NearestStation (or similar)
    const withStation = json.find(r => r.NearestStation || r.Station || r['最寄駅']);
    if (withStation) {
        console.log("Record with station found:");
        console.log(JSON.stringify(withStation, null, 2));
    } else {
        console.log("No record with 'NearestStation' found.");
        // Print sample to see what IS there
        console.log("Sample record:", JSON.stringify(json[0], null, 2));
    }
} catch (e) {
    console.error(e);
}

export {};
