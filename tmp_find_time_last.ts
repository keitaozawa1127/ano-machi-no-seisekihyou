import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function fetchTimeMeta(statsId) {
    const url = `${ESTAT_BASE_URL}/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${statsId}`;
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        const timeObj = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find(obj => obj['@id'] === 'time');
        if (timeObj) {
            console.log(JSON.stringify(timeObj.CLASS.slice(-5), null, 2));
        } else {
            console.log("time not found");
        }
    } catch (e) {
        console.error(e);
    }
}

const statsId = process.argv[2] || '0000020204';
fetchTimeMeta(statsId);
