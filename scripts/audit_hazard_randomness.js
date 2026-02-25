const http = require('http');

function diagnose(stationName) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ stationName, prefCode: "13", year: 2024 });
        const opts = {
            hostname: 'localhost', port: 3000,
            path: '/api/diagnose?t=' + Date.now() + Math.random(), method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(body, 'utf8'),
            },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ ok: false }); }
            });
        });
        req.on('error', () => resolve({ ok: false }));
        req.write(body);
        req.end();
    });
}

async function runTest() {
    console.log("=== Checking Hazard Data Randomness for 'Tokyo' ===");
    const results = [];
    for (let i = 0; i < 5; i++) {
        const res = await diagnose("東京");
        if (res.ok && res.extendedMetrics) {
            results.push(res.extendedMetrics);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("Results for Tokyo (5 runs):");
    results.forEach((r, i) => {
        console.log(`[${i + 1}] Flood:${r.hazardRisk.flood}, Landslide:${r.hazardRisk.landslide}, Amp:${r.groundAmplification}, Pop:${r.futurePopulationRate}`);
    });

    // Check consistency
    if (results.length === 0) {
        console.log("No data received.");
        return;
    }

    const first = JSON.stringify(results[0]);
    const isConsistent = results.every(r => JSON.stringify(r) === first);

    console.log("\nCONCLUSION:");
    if (isConsistent) {
        console.log("Data is CONSISTENT (Not Random).");
    } else {
        console.log("Data is VARIES (Random/Mock confirmed).");
    }
}

runTest();
