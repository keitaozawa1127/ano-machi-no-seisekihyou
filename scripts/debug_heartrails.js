const https = require('https');

const url = "https://express.heartrails.com/api/json?method=getStations&line=" + encodeURIComponent("JR中央線");

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("Response fields:", Object.keys(json.response.station[0]));
            console.log("First station:", JSON.stringify(json.response.station[0], null, 2));
        } catch (e) {
            console.error(e);
        }
    });
}).on('error', (e) => console.error(e));
