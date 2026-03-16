import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

async function checkYears() {
    const statsDataId = '0000020201';
    const cat01 = 'A1101';
    const area = '13103'; // 港区
    
    // getStatsData without cdTime to see all available times for this metric
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdCat01=${cat01}&cdArea=${area}`;

    const res = await fetch(url);
    const json: any = await res.json();
    
    if (json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE) {
        console.log('Values:', JSON.stringify(json.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE.slice(-5), null, 2));
    } else {
        console.log('No values found for A1301 in 13103');
        console.log(JSON.stringify(json.GET_STATS_DATA?.RESULT, null, 2));
    }
}

checkYears();
