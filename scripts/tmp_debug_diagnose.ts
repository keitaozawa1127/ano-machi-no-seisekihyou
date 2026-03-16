import { diagnoseAsync } from './lib/diagnoseLogic';

async function debug() {
    const station = 'JR三山木';
    const pref = '26';
    console.log(`Debugging station: ${station} (Pref: ${pref})`);
    
    try {
        const result = await diagnoseAsync(station, pref, 2024);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Caught error:', e);
    }
}

debug();
