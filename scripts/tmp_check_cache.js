const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'diagnosis');

const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('_full_v8.json'));
let corrupted = 0;
let healthy = 0;

for (const file of files) {
    const content = fs.readFileSync(path.join(CACHE_DIR, file), 'utf-8');
    try {
        const json = JSON.parse(content);
        if (!json.mlit) {
            corrupted++;
            // console.log(`Corrupted: ${file}`);
        } else {
            healthy++;
        }
    } catch (e) {
        corrupted++;
    }
}

console.log(`Summary: Healthy: ${healthy}, Corrupted: ${corrupted}, Total: ${files.length}`);
