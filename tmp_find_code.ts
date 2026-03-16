import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
const ESTAT_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json';

async function fetchMeta(statsId) {
    const url = `${ESTAT_BASE_URL}/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${statsId}`;
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        const cats = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find(obj => obj['@id'] === 'cat01');
        if (cats) {
            const financialCapability = cats.CLASS.filter(c => c['@name'].includes('財政力指数'));
            console.log(JSON.stringify(financialCapability, null, 2));
        } else {
            console.log("cat01 not found");
        }
    } catch (e) {
        console.error(e);
    }
}

const statsId = process.argv[2] || '0000020101';
fetchMeta(statsId);
