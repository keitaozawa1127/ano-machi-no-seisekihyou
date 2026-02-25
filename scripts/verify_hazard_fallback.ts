
import { checkFloodRisk, checkLandslideRisk, checkGroundAmplification } from '../lib/external/hazardMapApi';

async function main() {
    console.log("=== Verification of Hazard Map Fallback (Elevation Based) ===");

    // 1. Edogawa-Hirai (Lowland, Flood Risk)
    // 35.7067, 139.8431
    console.log("\nTesting Edogawa-Hirai (Sea Level Lowland)...");
    const f1 = await checkFloodRisk(35.7067, 139.8431);
    const a1 = await checkGroundAmplification(35.7067, 139.8431);
    console.log(`Flood Risk: ${f1} (Expected High/3-5)`);
    console.log(`Amp: ${a1} (Expected Soft/2.2)`);

    // 2. Musashi-Kosugi (Lowland/Reclaimed?)
    // 35.5759, 139.6595
    console.log("\nTesting Musashi-Kosugi...");
    const f2 = await checkFloodRisk(35.5759, 139.6595);
    console.log(`Flood Risk: ${f2}`);

    // 3. Mount Takao or similar High Ground/Slope?
    // 35.625, 139.243 (Takao-san area)
    console.log("\nTesting Takao Area (Slope)...");
    const l3 = await checkLandslideRisk(35.625, 139.243);
    const f3 = await checkFloodRisk(35.625, 139.243);
    console.log(`Landslide Risk: ${l3} (Expected > 0)`);
    console.log(`Flood Risk: ${f3} (Expected 0)`);
}

main();
