// @ts-nocheck
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const EXCEL_PATH = path.join(__dirname, '../data/ipss_population_2023.xlsx');
const OUT_PATH = path.join(__dirname, '../data/population_projection.json');

// 型定義
type AgeStructure = {
    "0-14": number;
    "15-64": number;
    "65+": number;
};

type PopulationData = {
    year: number;
    total: number;
    ageStructure: AgeStructure;
};

type CityData = {
    code: string;
    prefecture: string;
    city: string;
    data: PopulationData[];
};

type OutputJson = Record<string, CityData>; // Key: "東京都千代田区" などのユニークな名前

async function convert() {
    console.log(`Reading Excel: ${EXCEL_PATH}`);
    if (!fs.existsSync(EXCEL_PATH)) {
        console.error("Excel file not found.");
        return;
    }

    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0]; // 最初のシート
    console.log(`Sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];

    // JSONに変換 (ヘッダー行などを考慮)
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });


    // ヘッダー行を探す（"都道府県コード"が含まれる行など）
    let headerRowIndex = -1;
    for (let i = 0; i < 20; i++) {
        const row = rows[i] || [];
        // "都道府県コード" や "総数" などのキーワードを探す (IPSSフォーマットに合わせる)
        if (row.includes("都道府県") && row.includes("市区町村")) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.error("Header not found. Please check Excel structure.");
        // デバッグ用に最初の数行を表示
        console.log("Details:", rows.slice(0, 5));
        return;
    }

    console.log(`Header found at row ${headerRowIndex}`);
    const header = rows[headerRowIndex];

    // 列インデックスの特定
    const colPrefCode = header.indexOf("都道府県コード") !== -1 ? header.indexOf("都道府県コード") : 0; // 仮
    const colCityCode = header.indexOf("市区町村コード") !== -1 ? header.indexOf("市区町村コード") : 2; // 仮
    const colPrefName = header.indexOf("都道府県名") !== -1 ? header.indexOf("都道府県名") : 1;
    const colCityName = header.indexOf("市区町村名") !== -1 ? header.indexOf("市区町村名") : 3;

    // 年（2020, 2025...）のカラムを探す
    // ※IPSSのExcelは、列方向に年×属性（総数、男、女、年齢）が展開されていることが多い
    // ここでは簡易実装として、モックJSONの構造を生成するダミーロジックとする
    // （実データが手元にないため、ユーザー環境での実行時に調整が必要）

    console.warn("NOTE: Actual column parsing logic depends on exact Excel structure.");
    console.warn("For now, this script expects the Excel file to be present.");

    // ダミー処理: ファイルがあれば成功ログを出すが、変換はしない（モックJSONを使用中）
    console.log("Conversion logic skipped in this environment (file structure unknown).");
    console.log("Please rely on 'population_projection.json' (mock data for major cities) for now.");
}

convert();
