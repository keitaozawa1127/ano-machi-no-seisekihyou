const { fetchMlitData } = require('./lib/mlitService');

(async () => {
    console.time("MLIT Fetch");
    const data = await fetchMlitData(2024, "13"); // Tokyo
    console.timeEnd("MLIT Fetch");

    console.log("Total records:", data.length);
    if (data.length > 0) {
        console.log("Sample:", JSON.stringify(data[0], null, 2));

        // Check finding a station
        const nakanoStation = data.find(r => r.NearestStation === "中野");
        if (nakanoStation) {
            console.log("Nakano Station record:", JSON.stringify(nakanoStation, null, 2));
        }
    }
})();

export {};
