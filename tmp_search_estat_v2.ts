import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function fetchMeta(query) {
    const url = `${ESTAT_BASE_URL}/getStatsList?appId=${ESTAT_APP_ID}&searchKind=2&searchWord=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
}

const query = process.argv[2] || '財政力指数';
fetchMeta(query);
