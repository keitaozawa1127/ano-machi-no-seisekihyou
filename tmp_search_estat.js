const fs = require('fs');
const https = require('https');

const APP_ID = '754023770e5917f938a167b66723223126ec177b'; // Same as previous scripts

function fetchMeta(query) {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${APP_ID}&searchKind=2&searchWord=${encodeURIComponent(query)}`;
    
    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        });
    });
}

const query = process.argv[2] || '財政力指数';
fetchMeta(query);
