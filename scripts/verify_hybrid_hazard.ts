
import { checkFloodRisk, checkLandslideRisk, checkGroundAmplification } from '../lib/external/hazardMapApi';

async function main() {
    console.log("=== Verification of Hazard Map Hybrid Implementation ===");

    // 1. Arakawa River Center (Should be Flood Risk via Image Analysis)
    // 35.7495, 139.8247
    console.log("\nTesting Arakawa River Center (Flood/Image)...");
    const f1 = await checkFloodRisk(35.7495, 139.8247);
    console.log(`Flood Risk: ${f1} (Expected > 0, likely 3 or 5)`);

    // 2. Okutama Area (Should be Landslide Risk via Image Analysis)
    // 35.8533, 139.0411 (Center of tile 15/29039/12883)
    console.log("\nTesting Okutama Area (Landslide/Image)...");
    const l2 = await checkLandslideRisk(35.8533, 139.0411);
    console.log(`Landslide Risk: ${l2} (Expected > 0, likely 4)`);

    // 3. Edogawa-Hirai (Sea Level 0, Soft Ground via Elevation Fallback)
    // 35.7067, 139.8431
    console.log("\nTesting Edogawa-Hirai (Ground/Elevation)...");
    const a3 = await checkGroundAmplification(35.7067, 139.8431);
    console.log(`Ground Amp: ${a3} (Expected > 1.5, Soft)`);

    // 4. Safe Place (Tokyo Station?)
    // 35.6812, 139.7671
    console.log("\nTesting Tokyo Station...");
    const f4 = await checkFloodRisk(35.6812, 139.7671);
    const l4 = await checkLandslideRisk(35.6812, 139.7671);
    console.log(`Flood: ${f4}, Landslide: ${l4} (Expected 0)`);
}

main();
