
import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function check() {
    const statsDataId = '0000020203';
    const cdCat = 'C350202';
    const area = '34202'; // Kure-shi
    const time = '2021100000';
    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdCat01=${cdCat}&cdArea=${area}&cdTime=${time}`;
    const response = await fetch(url);
    const json = await response.json();
    console.log('Result for C350202 (2021) in 34202:', JSON.stringify(json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE, null, 2));
}
check();
