// @ts-nocheck
import { getFullDiagnosisData } from '../lib/mlitServiceCore';

async function testPerf() {
    const station = process.argv[2] || "高松";
    const prefCode = process.argv[3] || "37";

    console.log(`\n================================`);
    console.log(`[TEST] Direct core performance test for: ${station} (PrefCode: ${prefCode})`);

    const startTime = Date.now();
    try {
        const result = await getFullDiagnosisData(station, prefCode);
        const endTime = Date.now();
        const seconds = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n[RESULT] Ext Data City: ${result.ext?.sourceCity || 'None'}`);
        console.log(`[RESULT] MLIT Trend: ${result.mlit?.trend}`);
        console.log(`[RESULT] Time Taken: ---> ${seconds} seconds <---`);
        console.log(`================================\n`);
    } catch (e: any) {
        console.error(`[TEST] Error:`, e);
    }
}

testPerf();
