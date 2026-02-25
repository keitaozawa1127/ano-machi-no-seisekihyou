const https = require('https');

const url = "https://express.heartrails.com/api/json?method=getStations&prefecture=" + encodeURIComponent("東京都");

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.response && json.response.station) {
                console.log("Response fields:", Object.keys(json.response.station[0]));
                console.log("First station:", JSON.stringify(json.response.station[0], null, 2));
                console.log("Total stations:", json.response.station.length);
            } else {
                console.log("No stations found or error:", JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.error(e);
        }
    });
}).on('error', (e) => console.error(e));
