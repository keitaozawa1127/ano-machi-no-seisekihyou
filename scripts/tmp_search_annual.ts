import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

async function searchAnnual() {
    // 住民基本台帳に基づく人口データを検索
    const searchWord = '住民基本台帳 年少人口';
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${ESTAT_APP_ID}&searchWord=${encodeURIComponent(searchWord)}`;

    const res = await fetch(url);
    const json: any = await res.json();
    
    console.log(JSON.stringify(json.GET_STATS_LIST.DATALIST_INF.TABLE_INF.slice(0, 5), null, 2));
}

searchAnnual();
