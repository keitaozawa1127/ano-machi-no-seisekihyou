
const http = require('http');
const fs = require('fs');
const path = require('path');

// NGだった駅リスト
const TARGET_STATIONS = [
    { name: "大橋", pref: "40" },
    { name: "琴似", pref: "01" },
    { name: "熊本", pref: "43" }
];

const LOG_FILE = path.join(__dirname, 'audit_ng_log.txt');
const CSV_FILE = path.join(__dirname, 'audit_ng_results.csv');

function diagnose(stationName, prefCode) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ stationName, prefCode, year: null });
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/diagnose',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve({ ok: false, error: 'JSON Parse Error: ' + data.substring(0, 100) });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ ok: false, error: 'Network Error: ' + e.message });
        });

        req.setTimeout(60000, () => {
            req.destroy();
            resolve({ ok: false, error: 'TIMEOUT' });
        });

        req.write(body);
        req.end();
    });
}

function flags(tx, mp, dy) {
    const f = [];
    if (tx === 0) f.push('件数=0');
    if (mp && mp > 500000000) f.push('価格過大');
    if (mp && mp < 1000000) f.push('価格過小');
    if (dy && dy < 2020) f.push('データ古い');
    return f.length > 0 ? f.join(' / ') : '';
}

(async () => {
    console.log(`=== NG RE-AUDIT START: ${TARGET_STATIONS.length} stations ===`);
    fs.writeFileSync(LOG_FILE, `=== NG RE-AUDIT START: ${TARGET_STATIONS.length} stations ===\n`);
    fs.writeFileSync(CSV_FILE, 'station,pref,status,tx,mp_man,year,note\n');

    let okCount = 0;
    let ngCount = 0;

    for (let i = 0; i < TARGET_STATIONS.length; i++) {
        const s = TARGET_STATIONS[i];
        const label = `[${i + 1}/${TARGET_STATIONS.length}] ${s.name} (${s.pref})`;
        // process.stdout.write(`${label} ... `); // This line is replaced by the new console.log

        try {
            const res = await diagnose(s.name, s.pref);
            let status = 'OK';
            let note = '';
            let tx = '', mp = '', yr = '';

            if (res.ok) {
                tx = res.tx5y;
                mp = res.marketPrice;
                yr = res.dataYear;
                const flg = flags(tx, mp, yr);
                if (flg) { status = 'ANOMALY'; note = flg; }
                okCount++;
                const liquid = res.metrics ? res.metrics.liquidity : '-';
                const total = res.totalScore || '-';
                console.log(`OK  tx=${tx}  ${Math.round(mp / 10000)}万円  y=${yr} Lq=${liquid} Score=${total} ${note ? '(!)' : ''}`);
            } else {
                status = 'NG';
                note = res.error || 'Unknown Error';
                ngCount++;
                console.log(`NG: ${note}`);
            }

            fs.appendFileSync(LOG_FILE, `${label} ${status}: ${note}\n`);
            const mpMan = mp ? Math.round(mp / 10000) : '';
            fs.appendFileSync(CSV_FILE, `"${s.name}","${s.pref}","${status}",${tx},${mpMan},${yr},"${note}"\n`);

            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.log(`ERR: ${err.message}`);
        }
    }
    console.log(`=== RE-AUDIT COMPLETE: OK=${okCount}, NG=${ngCount} ===`);
})();

export {};
