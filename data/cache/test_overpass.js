const url = 'https://overpass-api.de/api/interpreter';
const body = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:500,35.681236,139.767125););out count;`;

fetch(url, {
    method: 'POST',
    body: body,
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AnoMachiApp/1.0'
    }
}).then(res => res.text()).then(text => console.log(text)).catch(e => console.error(e));
