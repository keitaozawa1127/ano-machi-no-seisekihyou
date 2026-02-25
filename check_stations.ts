import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/cache/14_2023.json', 'utf8'));

const stations = new Set();
data.forEach((t: any) => {
    if (t.NearestStation) stations.add(t.NearestStation);
});

const arr = Array.from(stations).sort();

console.log(Object.keys(data[0]));
// Let's find a transaction with "東戸塚" in its values just in case
const match = data.filter((t: any) => JSON.stringify(t).includes("戸塚"));
console.log("Transactions with 戸塚:", match.length);
console.log(match[0]);
