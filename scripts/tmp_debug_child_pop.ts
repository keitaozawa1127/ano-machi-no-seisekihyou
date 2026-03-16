import dotenv from 'dotenv';
dotenv.config();

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

async function check() {
    // 港区 (13103) の 15歳未満人口 (A1301) を取得してみる
    const statsDataId = '0000020201';
    const cat01 = 'A1301';
    const area = '13103';
    const time = '2023100000';
    
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdCat01=${cat01}&cdArea=${area}&cdTime=${time}`;

    const res = await fetch(url);
    const json: any = await res.json();
    
    console.log(JSON.stringify(json, null, 2));
}

check();
