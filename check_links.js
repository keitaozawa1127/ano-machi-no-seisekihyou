// Link validation script for redevelopment_master.json
const fs = require('fs');
const https = require('https');
const http = require('http');

const jsonPath = './public/data/redevelopment_master.json';
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log(`Total projects: ${data.length}\n`);

let checkedCount = 0;
let errorCount = 0;
const errors = [];

function checkURL(url, projectName, index) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.request(url, { method: 'HEAD', timeout: 20000 }, (res) => {
            checkedCount++;
            if (res.statusCode >= 400) {
                errorCount++;
                const error = `[${index}] ${projectName}: ${res.statusCode} - ${url}`;
                errors.push(error);
                console.log(`❌ ${error}`);
            } else {
                console.log(`✅ [${index}] ${projectName}: ${res.statusCode}`);
            }
            resolve();
        });

        req.on('error', (e) => {
            checkedCount++;
            errorCount++;
            const error = `[${index}] ${projectName}: ERROR - ${e.message} - ${url}`;
            errors.push(error);
            console.log(`❌ ${error}`);
            resolve();
        });

        req.on('timeout', () => {
            req.destroy();
            checkedCount++;
            errorCount++;
            const error = `[${index}] ${projectName}: TIMEOUT - ${url}`;
            errors.push(error);
            console.log(`❌ ${error}`);
            resolve();
        });

        req.end();
    });
}

async function checkAll() {
    const promises = data.map((project, index) =>
        checkURL(project.source_url, project.project_name, index)
    );

    await Promise.all(promises);

    console.log(`\n===== SUMMARY =====`);
    console.log(`Total checked: ${checkedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Success rate: ${((checkedCount - errorCount) / checkedCount * 100).toFixed(1)}%`);

    if (errors.length > 0) {
        console.log(`\n===== ERRORS (${errors.length}) =====`);
        errors.forEach(e => console.log(e));
    }
}

checkAll();
