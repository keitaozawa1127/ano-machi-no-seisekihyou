import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

async function search() {
    // 社会・人口統計体系 (0000020204) のメタ情報を確認
    const statsDataId = '0000020201';
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}`;

    const res = await fetch(url);
    const json: any = await res.json();
    
    const cats = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find((c: any) => c['@id'] === 'cat01');
    const populationMetrics = cats.CLASS.filter((c: any) => 
        c['@name'].includes('人口') || 
        c['@name'].includes('歳')
    );
    
    console.log(JSON.stringify(populationMetrics.slice(0, 50), null, 2));

    const times = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ.find((c: any) => c['@id'] === 'time');
    console.log('Available Times (Latest 10):', JSON.stringify(times.CLASS.slice(-10), null, 2));
}

search();
