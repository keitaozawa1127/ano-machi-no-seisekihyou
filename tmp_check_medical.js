
import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function check() {
    const statsDataId = '0000020309';
    const codes = ['#I0910103', '#I0910105'];
    const area = '20588'; // Ogawa-mura (Nagano)
    const time = '2020100000';
    for (const code of codes) {
        const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdCat01=${encodeURIComponent(code)}&cdArea=${area}&cdTime=${time}`;
        const response = await fetch(url);
        const json = await response.json();
        const value = json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE?.['$'];
        console.log(`Result for ${code} (2020) in 20588:`, value);
    }
}
check();
