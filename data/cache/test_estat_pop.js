async function check() {
    const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo?appId=${ESTAT_APP_ID}&statsDataId=0000020201`;
    const res = await fetch(url);
    const json = await res.json();
    const cobjs = json.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ;
    const coarr = Array.isArray(cobjs) ? cobjs : [cobjs];

    for (const co of coarr) {
        if (co['@id'] === 'cat01') {
            const cls = Array.isArray(co.CLASS) ? co.CLASS : [co.CLASS];
            const targets = cls.filter(c => c['@name'].includes('昼夜間人口比率'));
            targets.forEach(t => console.log(t['@code'], t['@name']));
        }
    }
}
check();
