const fs = require('fs');
const https = require('https');
const http = require('http');

// Read redevelopment_master.json
const data = JSON.parse(fs.readFileSync('./data/redevelopment_master.json', 'utf-8'));

console.log(`Total projects: ${data.length}`);
console.log('Starting link validation...\n');

let checked = 0;
let broken = [];
let working = [];

function checkUrl(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            method: 'HEAD',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = protocol.request(url, options, (res) => {
            resolve({ url, status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
        });

        req.on('error', (err) => {
            resolve({ url, status: 'ERROR', ok: false, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ url, status: 'TIMEOUT', ok: false });
        });

        req.end();
    });
}

async function validateAll() {
    for (const project of data) {
        const result = await checkUrl(project.source_url);
        checked++;

        if (!result.ok) {
            broken.push({
                station: project.station_name,
                project: project.project_name,
                url: project.source_url,
                status: result.status,
                error: result.error
            });
            console.log(`❌ [${checked}/${data.length}] ${project.station_name} - ${project.project_name}: ${result.status}`);
        } else {
            working.push({ station: project.station_name, project: project.project_name });
            console.log(`✅ [${checked}/${data.length}] ${project.station_name} - ${project.project_name}: ${result.status}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`Total:   ${data.length}`);
    console.log(`Working: ${working.length}`);
    console.log(`Broken:  ${broken.length}`);

    if (broken.length > 0) {
        console.log('\n=== BROKEN LINKS ===');
        broken.forEach(b => {
            console.log(`\nStation: ${b.station}`);
            console.log(`Project: ${b.project}`);
            console.log(`URL:     ${b.url}`);
            console.log(`Status:  ${b.status}`);
            if (b.error) console.log(`Error:   ${b.error}`);
        });

        fs.writeFileSync('./broken_links.json', JSON.stringify(broken, null, 2));
        console.log('\nBroken links saved to broken_links.json');
    }
}

validateAll().catch(console.error);

export {};
