const appId = "2d9805922425665c1c3d3408be3aaf19dee9541f";

async function search(word) {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${appId}&searchWord=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.GET_STATS_LIST.RESULT.STATUS !== 0) {
        console.log(`Error searching ${word}:`, data.GET_STATS_LIST.RESULT.ERROR_MSG);
        return;
    }

    const list = data.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
    if (!list) return console.log(word, "Not found");
    const items = Array.isArray(list) ? list : [list];
    console.log(`\n--- Search: ${word} ---`);
    items.slice(0, 5).forEach(i => {
        console.log(`ID: ${i['@id']}, Title: ${i.TITLE?.['$'] || i.TITLE}, StatName: ${i.STAT_NAME?.['$']}`);
    });
}

async function main() {
    await search("社会・人口統計体系");
    await search("経済センサス基礎調査 地域メッシュ");
}
main();
