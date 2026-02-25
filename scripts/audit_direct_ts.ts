
import { fetchExtendedMetrics } from '../lib/mlitApi';
import { fetchHazardFromGSI } from '../lib/external/gsiApi';

async function main() {
    console.log("=== Direct Verification of GSI Logic ===");

    // 1. Test GSI API directly
    const lat = 35.6812;
    const lon = 139.7640;
    console.log(`Testing GSI for Tokyo (${lat}, ${lon})...`);
    const gsiData = await fetchHazardFromGSI(lat, lon);
    console.log("GSI Result:", gsiData);

    // 2. Test fetchExtendedMetrics (integrated)
    console.log("Testing fetchExtendedMetrics for Tokyo...");
    const ext = await fetchExtendedMetrics("東京", lat, lon);
    console.log("ExtendedMetrics Result:", ext);

    // Check if results match expectation
    // Tokyo Elevation ~3m -> Flood Level 3 or 4?
    // < 3.0 -> 4. >= 3.0 -> 3 (if < 5.0).
    const flood = ext.hazardRisk.flood;
    console.log(`Flood Level: ${flood}`);

    if (flood === 3 || flood === 4) {
        console.log("SUCCESS: Flood risk reflects elevation data.");
    } else {
        console.log("FAILURE: Flood risk does not match expectation (Expected 3 or 4).");
    }
}

main();
