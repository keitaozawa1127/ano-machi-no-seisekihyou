// Verify API city_code response
const http = require('http');

http.get('http://localhost:3000/api/stations?pref=13', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('Total stations:', json.stations.length);
        console.log('Source:', json.source);

        // Find Nakano-ku stations
        const nakano = json.stations.filter(s => s.city === '中野区');
        console.log('\n中野区の駅数:', nakano.length);
        if (nakano.length > 0) {
            console.log('Sample station:', JSON.stringify(nakano[0], null, 2));
            console.log('\ncity_code values:');
            nakano.forEach(s => console.log(`  ${s.name}: city_code="${s.city_code}"`));
        }

        // Check all stations with city_code
        const withCode = json.stations.filter(s => s.city_code && s.city_code !== '');
        console.log('\nStations with city_code:', withCode.length);
        if (withCode.length > 0) {
            console.log('Sample with code:', JSON.stringify(withCode[0], null, 2));
        }
    });
}).on('error', e => console.error('Error:', e));

export {};
