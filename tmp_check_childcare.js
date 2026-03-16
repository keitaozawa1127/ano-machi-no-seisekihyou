
import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function check() {
    const statsDataId = '0000020210';
    const areas = ['13101']; 
    const year = '2021100000';
    const codes = ['J250302'];
    for (const area of areas) {
        const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdCat01=${code}&cdArea=${area}&cdTime=${year}`;
        const response = await fetch(url);
        const json = await response.json();
        const value = json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE?.['$'];
        console.log(`A1405 (0-5 population) in ${area} (${year}): ${value}`);
    }
}
check();
