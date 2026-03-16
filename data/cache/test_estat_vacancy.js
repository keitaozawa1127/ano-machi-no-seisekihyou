async function check() {
    const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${ESTAT_APP_ID}&searchWord=${encodeURIComponent('社会・人口統計体系 市区町村')}`;
    const res = await fetch(url);
    const json = await res.json();
    const stats = json.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
    if (!stats) return console.log('No stats found');
    
    const arr = Array.isArray(stats) ? stats : [stats];
    for(const s of arr.slice(0, 50)) {
        console.log(`${s['@id']} : ${s.STAT_NAME?.['$']} - ${s.TITLE?.['$']}`);
    }
}
check();
