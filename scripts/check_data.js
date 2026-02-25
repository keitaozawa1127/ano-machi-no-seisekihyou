const fetch = require('node-fetch');

(async () => {
    // 東京 (13) のデータを取得
    const res = await fetch('http://localhost:3000/api/stations?pref=13');
    const data = await res.json();

    if (!data.stations || data.stations.length === 0) {
        console.error('No stations found');
        return;
    }

    console.log('Total stations:', data.stations.length);
    console.log('Sample station:', JSON.stringify(data.stations[0], null, 2));

    // city_code (JISコード) があるか確認
    const hasCityCode = data.stations.every(s => s.city_code || s.cityCode);
    console.log('Has city_code:', hasCityCode);

    if (hasCityCode) {
        // 東京23区 (13101-13123) のサンプル
        const wardStations = data.stations.filter(s => {
            const code = parseInt(s.city_code || s.cityCode, 10);
            return code >= 13101 && code <= 13123;
        });
        console.log('23 Ward stations count:', wardStations.length);
    }
})();
