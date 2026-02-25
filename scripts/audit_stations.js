// 主要駅 数値監査スクリプト v2 - ファイルに随時書き出し
const http = require('http');
const fs = require('fs');
const path = require('path');

const stations = [
    { name: '東京', pref: '13' }, { name: '品川', pref: '13' },
    { name: '渋谷', pref: '13' }, { name: '新宿', pref: '13' },
    { name: '池袋', pref: '13' }, { name: '上野', pref: '13' },
    { name: '秋葉原', pref: '13' }, { name: '有楽町', pref: '13' },
    { name: '浜松町', pref: '13' }, { name: '田町', pref: '13' },
    { name: '目黒', pref: '13' }, { name: '恵比寿', pref: '13' },
    { name: '代々木', pref: '13' }, { name: '原宿', pref: '13' },
    { name: '吉祥寺', pref: '13' }, { name: '中野', pref: '13' },
    { name: '高円寺', pref: '13' }, { name: '荻窪', pref: '13' },
    { name: '三鷹', pref: '13' }, { name: '立川', pref: '13' },
    { name: '八王子', pref: '13' }, { name: '赤羽', pref: '13' },
    { name: '王子', pref: '13' }, { name: '北千住', pref: '13' },
    { name: '錦糸町', pref: '13' }, { name: '亀戸', pref: '13' },
    { name: '大崎', pref: '13' }, { name: '五反田', pref: '13' },
    { name: '蒲田', pref: '13' }, { name: '大森', pref: '13' },
    { name: '横浜', pref: '14' }, { name: '川崎', pref: '14' },
    { name: '武蔵小杉', pref: '14' }, { name: '桜木町', pref: '14' },
    { name: '関内', pref: '14' }, { name: '藤沢', pref: '14' },
    { name: '小田原', pref: '14' }, { name: '相模大野', pref: '14' },
    { name: '海老名', pref: '14' }, { name: '本厚木', pref: '14' },
    { name: '大宮', pref: '11' }, { name: '浦和', pref: '11' },
    { name: '川口', pref: '11' }, { name: '川越', pref: '11' },
    { name: '所沢', pref: '11' }, { name: '越谷', pref: '11' },
    { name: '春日部', pref: '11' },
    { name: '千葉', pref: '12' }, { name: '船橋', pref: '12' },
    { name: '松戸', pref: '12' }, { name: '市川', pref: '12' },
    { name: '柏', pref: '12' }, { name: '津田沼', pref: '12' },
    { name: '大阪', pref: '27' }, { name: '難波', pref: '27' },
    { name: '天王寺', pref: '27' }, { name: '京橋', pref: '27' },
    { name: '心斎橋', pref: '27' }, { name: '新大阪', pref: '27' },
    { name: '北浜', pref: '27' }, { name: '本町', pref: '27' },
    { name: '名古屋', pref: '23' }, { name: '栄', pref: '23' },
    { name: '金山', pref: '23' }, { name: '千種', pref: '23' },
    { name: '鶴舞', pref: '23' }, { name: '伏見', pref: '23' },
    { name: '博多', pref: '40' }, { name: '天神', pref: '40' },
    { name: '小倉', pref: '40' }, { name: '西新', pref: '40' },
    { name: '薬院', pref: '40' }, { name: '大橋', pref: '40' },
    { name: '札幌', pref: '01' }, { name: '大通', pref: '01' },
    { name: 'すすきの', pref: '01' }, { name: '琴似', pref: '01' },
    { name: '仙台', pref: '04' }, { name: '長町', pref: '04' },
    { name: '広島', pref: '34' }, { name: '横川', pref: '34' },
    { name: '京都', pref: '26' }, { name: '四条', pref: '26' },
    { name: '烏丸御池', pref: '26' }, { name: '西院', pref: '26' },
    { name: '三ノ宮', pref: '28' }, { name: '神戸', pref: '28' },
    { name: '尼崎', pref: '28' }, { name: '西宮北口', pref: '28' },
    { name: '静岡', pref: '22' }, { name: '浜松', pref: '22' },
    { name: '岡山', pref: '33' },
    { name: '熊本', pref: '43' },
    { name: 'おもろまち', pref: '47' },
];

const logFile = path.join(__dirname, 'audit_log.txt');
const csvFile = path.join(__dirname, 'audit_results.csv');

// ログファイル初期化
fs.writeFileSync(logFile, '', 'utf8');
fs.writeFileSync(csvFile, '\uFEFFstation,pref,status,tx,mp_man,year,note\n', 'utf8');

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n', 'utf8');
}

function appendCsv(row) {
    fs.appendFileSync(csvFile, row + '\n', 'utf8');
}

function diagnose(stationName, prefCode) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ stationName, prefCode, year: null });
        const opts = {
            hostname: 'localhost', port: 3000,
            path: '/api/diagnose', method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(body, 'utf8'),
            },
        };
        const timer = setTimeout(() => { req.destroy(); resolve({ ok: false, _timeout: true }); }, 300000);
        const req = http.request(opts, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', c => data += c);
            res.on('end', () => {
                clearTimeout(timer);
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ ok: false, _parseErr: data.slice(0, 200) }); }
            });
        });
        req.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, _netErr: e.message }); });
        req.write(body, 'utf8');
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function flags(tx, mp, dy) {
    const f = [];
    if (tx === 0) f.push('件数=0');
    if (tx > 30000) f.push('件数過多(' + tx + ')');
    if (mp > 0 && mp < 50) f.push('価格低すぎ(' + mp + '万)');
    if (mp > 20000) f.push('価格高すぎ(' + mp + '万)');
    if (dy > 0 && dy < 2022) f.push('古データ(' + dy + '年)');
    return f.join(' / ');
}

async function main() {
    const total = stations.length;
    log('=== AUDIT START: ' + total + ' stations ===');

    for (let i = 0; i < stations.length; i++) {
        const { name, pref } = stations[i];
        const prefix = '[' + (i + 1) + '/' + total + '] ' + name + ' (' + pref + ') ';
        const d = await diagnose(name, pref);

        if (d._timeout) {
            log(prefix + 'TIMEOUT');
            appendCsv('"' + name + '","' + pref + '","TIMEOUT",,,,"TIMEOUT"');
        } else if (d._netErr) {
            log(prefix + 'NET_ERR: ' + d._netErr);
            appendCsv('"' + name + '","' + pref + '","NET_ERR",,,,"' + d._netErr + '"');
        } else if (d._parseErr) {
            log(prefix + 'PARSE_ERR');
            appendCsv('"' + name + '","' + pref + '","PARSE_ERR",,,,"parse error"');
        } else if (!d.ok) {
            const errMsg = String(d.error || '').replace(/"/g, "'");
            log(prefix + 'NG: ' + errMsg);
            appendCsv('"' + name + '","' + pref + '","NG",,,,"' + errMsg + '"');
        } else {
            const tx = d.debug && d.debug.tx5y != null ? d.debug.tx5y : 0;
            const mpR = d.marketPrice != null ? d.marketPrice : 0;
            const dy = d.debug && d.debug.dataYear != null ? d.debug.dataYear : 0;
            const mp = Math.round(mpR / 10000);
            const note = flags(tx, mp, dy);
            const status = note ? 'ANOMALY' : 'OK';
            log(prefix + status + '  tx=' + tx + '  ' + mp + '万円  y=' + dy + (note ? '  [' + note + ']' : ''));
            const safeNote = note.replace(/"/g, "'");
            appendCsv('"' + name + '","' + pref + '","' + status + '",' + tx + ',' + mp + ',' + dy + ',"' + safeNote + '"');
        }
        await sleep(1000);
    }

    log('');
    log('=== AUDIT COMPLETE ===');

    // Read CSV and summarize
    const lines = fs.readFileSync(csvFile, 'utf8').split('\n').slice(1).filter(l => l.trim());
    const rows = lines.map(l => {
        const m = l.match(/^"([^"]+)","([^"]+)","([^"]+)",([^,]*),([^,]*),([^,]*),"([^"]*)"$/);
        if (!m) return null;
        return { station: m[1], pref: m[2], status: m[3], tx: m[4] ? +m[4] : null, mp: m[5] ? +m[5] : null, year: m[6] ? +m[6] : null, note: m[7] };
    }).filter(Boolean);

    const ok = rows.filter(r => r.status === 'OK').length;
    const ano = rows.filter(r => r.status === 'ANOMALY').length;
    const ng = rows.filter(r => !['OK', 'ANOMALY'].includes(r.status)).length;
    log('OK=' + ok + '  ANOMALY=' + ano + '  NG/ERR=' + ng);

    log('');
    log('--- 問題あり駅 ---');
    rows.filter(r => r.status !== 'OK').forEach(r => {
        log('  [' + r.status + '] ' + r.station + '(' + r.pref + ')  tx=' + r.tx + '  ' + r.mp + '万  y=' + r.year + '  ' + r.note);
    });

    const valid = rows.filter(r => r.tx != null);
    if (valid.length) {
        const txs = valid.map(r => r.tx);
        const mps = valid.filter(r => r.mp > 0).map(r => r.mp);
        log('');
        log('--- STATS ---');
        log('TxCount: min=' + Math.min(...txs) + '  max=' + Math.max(...txs) + '  avg=' + Math.round(txs.reduce((a, b) => a + b, 0) / txs.length));
        if (mps.length) log('Price  : min=' + Math.min(...mps) + '万  max=' + Math.max(...mps) + '万  avg=' + Math.round(mps.reduce((a, b) => a + b, 0) / mps.length) + '万');

        log('');
        log('--- LIQUIDITY DISTRIBUTION (Threshold: 3000) ---');
        const over3000 = valid.filter(r => r.tx >= 3000).sort((a, b) => b.tx - a.tx);
        log(`Over 3000: ${over3000.length} stations (${Math.round(over3000.length / valid.length * 100)}%)`);
        over3000.forEach(r => {
            log(`  ${r.station}(${r.pref}): ${r.tx} txs`);
        });

        // Distribution
        const ranges = [0, 500, 1000, 2000, 3000, 5000, 10000];
        log('');
        log('--- HISTOGRAM ---');
        for (let i = 0; i < ranges.length; i++) {
            const min = ranges[i];
            const max = ranges[i + 1] || Infinity;
            const count = valid.filter(r => r.tx >= min && r.tx < max).length;
            const bar = '*'.repeat(count);
            log(`${min.toString().padEnd(5)} - ${max === Infinity ? 'Inf' : max.toString().padEnd(5)}: ${count.toString().padEnd(3)} ${bar}`);
        }

        log('');
        log('CSV: ' + csvFile);
        log('LOG: ' + logFile);
    }
}

main().catch(e => { log('FATAL: ' + e.message); process.exit(1); });

export {};
