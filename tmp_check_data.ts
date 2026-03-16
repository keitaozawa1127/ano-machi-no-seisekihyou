import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function checkData(time) {
    const url = `${ESTAT_BASE_URL}/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=0000020204&cdCat01=D2201&cdArea=13101&cdTime=${time}`;
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        console.log(`Time: ${time}, Value: ${json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE?.['$']}`);
    } catch (e) {
        console.error(e);
    }
}

checkData('2022100000');
checkData('2023100000');
