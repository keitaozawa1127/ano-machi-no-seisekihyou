import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function searchDataId(query) {
    const url = `${ESTAT_BASE_URL}/getStatsList?appId=${ESTAT_APP_ID}&searchWord=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        const dataList = json.GET_STATS_LIST.DATALIST_INF.TABLE_INF;
        if (Array.isArray(dataList)) {
            dataList.slice(0, 10).forEach(table => {
                console.log(`ID: ${table['@id']}, Name: ${table.STAT_NAME['$']}, Table: ${table.TITLE['$']}`);
            });
        } else if (dataList) {
             console.log(`ID: ${dataList['@id']}, Name: ${dataList.STAT_NAME['$']}, Table: ${dataList.TITLE['$']}`);
        } else {
            console.log("No data found");
        }
    } catch (e) {
        console.error(e);
    }
}

searchDataId("財政力指数");
