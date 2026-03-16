import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

async function checkResidentRegister() {
    const statsDataId = '0003412356'; // 住民基本台帳
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}`;

    const res = await fetch(url);
    const json: any = await res.json();
    
    if (json.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ) {
        const cat01 = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find((c: any) => c['@id'] === 'cat01');
        const metrics = cat01.CLASS.filter((c: any) => c['@name'].includes('15') || c['@name'].includes('年少'));
        console.log('Metrics:', JSON.stringify(metrics, null, 2));

        const timeObj = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find((c: any) => c['@id'] === 'time');
        console.log('Times:', JSON.stringify(timeObj.CLASS.slice(-5), null, 2));
    } else {
        console.log('Table 0003412356 not found or metadata missing.');
    }
}

checkResidentRegister();
