import fs from 'fs';
import config from 'dotenv';
config.config({ path: '.env.local' });
import { getFullDiagnosisData } from './lib/mlitServiceCore';

async function run() {
    const output: any = {};
    try {
        const data1 = await getFullDiagnosisData("東戸塚", "14");
        output["東戸塚"] = { success: true, txCount: data1.mlit.rawTransactions.length };
    } catch (e: any) {
        output["東戸塚"] = { success: false, error: e.message };
    }

    try {
        const data2 = await getFullDiagnosisData("保土ヶ谷", "14");
        output["保土ヶ谷"] = { success: true, txCount: data2.mlit.rawTransactions.length };
    } catch (e: any) {
        output["保土ヶ谷"] = { success: false, error: e.message };
    }

    fs.writeFileSync('test_output.json', JSON.stringify(output, null, 2));
}
run();
