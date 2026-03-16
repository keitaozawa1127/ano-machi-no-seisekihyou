import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function fetchAreaMeta(statsId) {
    const url = `${ESTAT_BASE_URL}/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${statsId}`;
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        const areaObj = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find(obj => obj['@id'] === 'area');
        if (areaObj) {
            console.log(JSON.stringify(areaObj.CLASS.slice(0, 10), null, 2));
        } else {
            console.log("area not found");
        }
    } catch (e) {
        console.error(e);
    }
}

fetchAreaMeta('0000020204');
