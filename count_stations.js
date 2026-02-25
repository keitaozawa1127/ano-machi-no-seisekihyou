const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/redevelopment_master.json', 'utf8'));

const stations = {};
data.forEach(p => {
    if (p.station_name) {
        stations[p.station_name] = (stations[p.station_name] || 0) + 1;
    }
});

console.log('=== 駅別プロジェクト数 ===\n');
Object.entries(stations)
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`${s}: ${c}件`));

console.log(`\n合計: ${Object.keys(stations).length}駅, ${data.length}プロジェクト`);
