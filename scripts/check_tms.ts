
async function main() {
    const url = "https://disaportal.gsi.go.jp/data/map/01_flood_l2_shinsuishin_data/13/7278/4967.png";
    console.log(`Checking Inverted Y URL: ${url}`);

    try {
        const res = await fetch(url);
        if (res.ok) {
            console.log("SUCCESS! TMS Inversion is the key.");
        } else {
            console.log(`Failed: ${res.status}`);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
