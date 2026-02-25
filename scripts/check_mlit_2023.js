const https = require('https');

const API_KEY = "2001ce8821b5494fbd7b8fdb4f974313";
const year = 2023;
const area = "13";
const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001?year=${year}&area=${area}`;

const options = {
    headers: {
        "Ocp-Apim-Subscription-Key": API_KEY
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.data && json.data.length > 0) {
                console.log("2023 Record Keys:", Object.keys(json.data[0]));
                const withStation = json.data.find(r => r.NearestStation);
                if (withStation) {
                    console.log("Found Station:", withStation.NearestStation);
                } else {
                    console.log("No station found in 2023 data either.");
                }
            } else {
                console.log("No data or error", json.status);
            }
        } catch (e) {
            console.error(e);
        }
    });
}).on('error', (e) => console.error(e));
