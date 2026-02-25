
import { checkFloodRisk, checkLandslideRisk } from '../lib/external/hazardMapApi';

async function main() {
    console.log("=== Verification of Hazard Map Refactoring ===");

    // 1. Arakawa River Center (Should be Flood Risk via Image Analysis)
    // 35.7495, 139.8247
    console.log("\nTesting Arakawa River Center (Flood)...");
    const f1 = await checkFloodRisk(35.7495, 139.8247);
    console.log(`Flood Risk: Lv.${f1.level} - ${f1.description}`);

    // 2. Okutama Area (Should be Landslide Risk via Image Analysis)
    // 35.8533, 139.0411 (Center of tile 15/29039/12883)
    console.log("\nTesting Okutama Area (Landslide)...");
    const l2 = await checkLandslideRisk(35.8533, 139.0411);
    console.log(`Landslide Risk: Lv.${l2.level} - ${l2.description}`);

    // 3. Tokyo Station (Safe)
    // 35.6812, 139.7671
    console.log("\nTesting Tokyo Station...");
    const f3 = await checkFloodRisk(35.6812, 139.7671);
    const l3 = await checkLandslideRisk(35.6812, 139.7671);
    console.log(`Flood: Lv.${f3.level}, Landslide: Lv.${l3.level}`);
}

main();
