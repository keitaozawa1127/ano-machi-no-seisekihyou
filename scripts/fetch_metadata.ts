// @ts-nocheck

const URL = 'https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/metadata_light.xml';

async function main() {
    console.log("Fetching metadata...");
    const res = await fetch(URL);
    const text = await res.text();

    // Simple regex search for flood related entries
    console.log("Searching for '01_flood' or 'shinsuishin'...");

    const lines = text.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('shinsuishin') || line.includes('flood')) {
            console.log(`Line ${i}: ${line.trim()}`);
        }
    });

    // Also verify min/max zoom
    // Look for <Url> tag patterns
}

main();

export {};
