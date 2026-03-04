const fs = require('fs');
const Kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

async function fixKana() {
    const filePath = 'public/data/stations.json';
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const kuroshiro = new Kuroshiro();
    console.log("Initializing Kuromoji analyzer...");
    await kuroshiro.init(new KuromojiAnalyzer());

    console.log("Analyzer ready. Processing stations...");
    let fixedCount = 0;

    for (const key in data) {
        const station = data[key];
        // Check if kana is missing or contains non-hiragana (excluding extension bar ー)
        if (!station.kana || !/^[ぁ-んー]+$/.test(station.kana)) {
            try {
                // Convert Kanji -> Hiragana
                let originalName = station.name;

                // Some explicit cleanup to help analyzer
                const nameForKana = originalName.replace(/ヶ/g, 'が').replace(/ケ/g, 'け');

                const hiragana = await kuroshiro.convert(nameForKana, { to: 'hiragana' });

                // Remove spaces the analyzer sometimes adds
                let cleanKana = hiragana.replace(/\s+/g, '');

                // Small fixes for common station suffixes that kuromoji might read wrong
                cleanKana = cleanKana.replace(/ちょう$/g, 'まち'); // Mostly "町" is read as "まち" in stations, but not always. We'll leave it to kuromoji except if we know

                // Since Kuromoji's default is usually OK, we just use it directly.
                station.kana = cleanKana;
                fixedCount++;

                if (fixedCount % 100 === 0) {
                    console.log(`Processed ${fixedCount}: ${originalName} -> ${cleanKana}`);
                }
            } catch (err) {
                console.error(`Error converting ${station.name}:`, err);
            }
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`\nFinished! Fixed ${fixedCount} stations.`);
}

fixKana();
