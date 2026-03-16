require('dotenv').config();
const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo?appId=${process.env.ESTAT_APP_ID}&statsDataId=0000020203`;
fetch(url).then(res => res.json()).then(json => {
    const cobjs = json.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ;
    const cat01 = cobjs.find(c => c['@id'] === 'cat01');
    const classes = Array.isArray(cat01.CLASS) ? cat01.CLASS : [cat01.CLASS];
    const targets = classes.filter(c => c['@name'].includes('事業所') || c['@name'].includes('企業'));
    console.log(targets);
});
