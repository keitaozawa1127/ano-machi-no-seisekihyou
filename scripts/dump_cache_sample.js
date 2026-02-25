const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../data/cache/13_2024.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

console.log("Total records: " + data.length);
console.log("Sample records (first 10):");
data.slice(0, 10).forEach(t => {
    console.log(`Muni: '${t.Municipality}', District: '${t.DistrictName}', Station: '${t.NearestStation}'`);
});

const uniqMuni = Array.from(new Set(data.map(t => t.Municipality))).sort();
console.log("Unique Municipalities (first 20):", uniqMuni.slice(0, 20));

// Check "千代田区" existence
console.log("Has 千代田区:", uniqMuni.includes("千代田区"));

// Check keys in district_coords for Chiyoda-ku
const dcPath = path.join(__dirname, '../data/district_coords.json');
const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
if (dc["東京都"] && dc["東京都"]["千代田区"]) {
    console.log("\nDistrict Coords Keys for 千代田区:", Object.keys(dc["東京都"]["千代田区"]));
}

export {};
