const http = require('http');
const https = require('https');

function fetchJson(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ error: "Parse Error", raw: data.substring(0, 100) }); }
            });
        }).on('error', (e) => resolve({ error: e.message }));
    });
}

async function checkGSIElevation(lat, lon) {
    console.log(`\nChecking GSI Elevation for ${lat}, ${lon}...`);
    const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`;
    const res = await fetchJson(url);
    console.log("Result:", res);
    return res;
}

function getMeshCode(lat, lon) {
    // J-SHIS mesh code (standard mesh)
    // 1st Mesh: lat*1.5, lon-100
    const p = Math.floor(lat * 1.5);
    const u = Math.floor(lon - 100);

    // 2nd Mesh: (lat*1.5 - p)*8, (lon-100 - u)*8
    const q = Math.floor((lat * 1.5 - p) * 8);
    const v = Math.floor((lon - 100 - u) * 8);

    // 3rd Mesh: (lat*1.5 - p - q/8)*80, (lon-100 - u - v/8)*80
    // Actually standard calculation is safer:
    const lat1 = p;
    const lon1 = u;

    const lat2 = q;
    const lon2 = v;

    // Remainder for 3rd
    const latRem2 = (lat * 1.5 - p - q / 8) * 8; // ? No.

    // Let's use standard formula strict
    // 1st: 40min lat, 1deg lon
    // 2nd: 5min lat, 7.5min lon (1st / 8)
    // 3rd: 30sec lat, 45sec lon (2nd / 10)

    const latInMin = lat * 60;
    const lonInMin = lon * 60;

    const mesh1_lat = Math.floor(latInMin / 40);
    const mesh1_lon = Math.floor(lon - 100);

    const remLat1 = latInMin % 40;
    const remLon1 = (lon - 100 - mesh1_lon) * 60;

    const mesh2_lat = Math.floor(remLat1 / 5);
    const mesh2_lon = Math.floor(remLon1 / 7.5);

    const remLat2 = remLat1 % 5;
    const remLon2 = remLon1 % 7.5;

    const mesh3_lat = Math.floor(remLat2 / (30 / 60)); // 0.5 min
    const mesh3_lon = Math.floor(remLon2 / (45 / 60)); // 0.75 min

    return `${mesh1_lat}${mesh1_lon}${mesh2_lat}${mesh2_lon}${mesh3_lat}${mesh3_lon}`;
}

async function checkJSHIS(lat, lon) {
    const meshCode = getMeshCode(lat, lon);
    console.log(`\nChecking J-SHIS for ${lat}, ${lon} -> MeshCode: ${meshCode}...`);

    // J-SHIS S-STRCT API (Surface Structure)
    // http://www.j-shis.bosai.go.jp/map/api/sstrct/meshinfo.php
    // Parameters: x, y (lat/lon) OR code (mesh code)
    // Docs say: http://www.j-shis.bosai.go.jp/map/api/sstrct/meshinfo.php?x=140.0&y=36.0
    // Let's try x,y again but with correct parameter names if previous failed.
    // Previous failed with "Undefined Request". Maybe it needs 'epsg'?

    // Let's try `code`.
    const url = `http://www.j-shis.bosai.go.jp/map/api/sstrct/meshinfo.php?code=${meshCode}`;

    // J-SHIS returns JSONP or JSON?
    // Often it requires ?callback=... for JSONP.
    // But let's try.

    const res = await fetchJson(url);
    if (res.raw) {
        console.log("Raw Response extract:", res.raw.substring(0, 200));
    } else {
        console.log("Result:", res);
    }
    return res;
}

async function main() {
    // Tokyo Station
    await checkGSIElevation(35.6812, 139.7640);

    // J-SHIS check
    await checkJSHIS(35.6812, 139.7640);
}

main();

export {};
