// @ts-nocheck
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
// import { calculateDistance } from './utils/geo'; 

// Utility: Calculate distance (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

dotenv.config();

// === 設定 ===
const STATIONS_PATH = path.join(process.cwd(), 'public', 'data', 'stations.json');
const MLIT_API_KEY = process.env.MLIT_API_KEY;
const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

// === 定数 ===
const LATEST_YEAR_LAND_PRICE = 2025;
const LATEST_YEAR_PASSENGER = 2024; // 2025年公表分

// StationData型定義 (既存のstations.jsonに合わせて拡張)
interface StationData {
    name: string;
    lines: string[];
    prefecture: string;
    prefCode: string;
    coordinates: [number, number];
    passengerVolume: number; // 既存
    tradeCount?: number;     // 既存 (地価の代替指標として使われている可能性が高いが、新区画でlandPriceを追加)

    // 新規追加データ
    landPrice?: number;                 // 最新公示地価 (円/m2)
    landPriceHistory?: { year: number; price: number }[]; // 地価推移
    passengerVolumeHistory?: { year: number; count: number }[]; // 乗降客数推移
}

// === MLIT (不動産情報ライブラリ) API 関連 ===
// エンドポイント例: https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001
// 公示地価(L01)を取得
async function fetchLandPrice(lat: number, lon: number): Promise<{ price: number, history: { year: number; price: number }[] } | null> {
    if (!MLIT_API_KEY) return null;

    try {
        // 座標周辺の地価ポイントを検索 (半径1km以内など)
        // ※実際のAPI仕様に合わせてパラメータ調整が必要
        const response = await axios.get('https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001', {
            params: {
                year: `${LATEST_YEAR_LAND_PRICE - 5}-${LATEST_YEAR_LAND_PRICE}`, // 過去5年分
                area: '', // 座標指定の場合は不要な場合も
                z: 15, // ズームレベル(概算範囲)
                x: lon, // ※実際のAPIはタイル座標か、box指定かは要確認。ここでは概念実装
                y: lat,
                response_format: 'geojson'
            },
            headers: {
                'Ocp-Apim-Subscription-Key': MLIT_API_KEY
            }
        });

        // 最寄りの地点を探すロジック
        // data.features から lat, lon に最も近い points を抽出
        // 戻り値として最新価格と履歴を返す

        // --- モックデータ返却（実装時は削除） ---
        return {
            price: 500000,
            history: [
                { year: 2021, price: 480000 },
                { year: 2022, price: 490000 },
                { year: 2023, price: 495000 },
                { year: 2024, price: 500000 },
                { year: 2025, price: 510000 }
            ]
        };

    } catch (error: any) {
        console.error('MLIT API Error:', error);
        return null;
    }
}

// === e-Stat API 関連 ===
// 鉄道輸送統計を取得
// 戦略: 駅ごとにAPIを叩くと遅いので、都道府県単位などで一括取得してメモリ内でマッチングする
async function fetchAllPassengerData(year: number): Promise<Map<string, number>> {
    if (!ESTAT_APP_ID) return new Map();

    const stationMap = new Map<string, number>();

    try {
        // 統計表IDを指定 (例: 00600120 などの鉄道輸送統計ID)
        // ※実際はAPIからメタ情報を引いて最新のIDを特定するロジックが推奨される
        const statsDataId = '0000000000'; // ダミーID

        const response = await axios.get('https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData', {
            params: {
                appId: ESTAT_APP_ID,
                statsDataId: statsDataId,
                cdCat01: '...filter codes...'
            }
        });

        // データをパースしてMapに格納
        // Key生成: `StationName_LineName` または正規化された名前

        // --- モック ---
        stationMap.set('横浜_JR東海道本線', 400000);
        stationMap.set('横浜_横浜市ブルーライン', 50000); // Normalize check

        return stationMap;
    } catch (e: any) {
        console.error('e-Stat API Error:', e);
        return new Map();
    }
}

// === 正規化ロジック ===
function normalizeLineName(lineName: string): string {
    // 既存のSearchForm.tsx/stations.jsonのロジックに合わせる
    if (lineName === 'グリーンライン') return '横浜市グリーンライン';
    // e-Statなどが「JR東日本」「全線」などで返してくる場合の処理
    return lineName;
}

function normalizeStationName(stationName: string): string {
    // ( ) 除去など
    return stationName.replace(/\(.*\)/, '').replace(/（.*）/, '').trim();
}


// === メイン処理 ===
async function main() {
    console.log('Starting data update...');

    // 1. マスターデータの読み込み
    if (!fs.existsSync(STATIONS_PATH)) {
        console.error('Stations file not found');
        process.exit(1);
    }
    const rawData = fs.readFileSync(STATIONS_PATH, 'utf-8');
    const stations: Record<string, StationData> = JSON.parse(rawData);

    // 2. e-Statデータの一括取得 (キャッシュ)
    const passengerDataMap = await fetchAllPassengerData(LATEST_YEAR_PASSENGER);

    let updatedCount = 0;

    // 3. 各駅ごとの更新処理
    const stationKeys = Object.keys(stations);
    const targetKeys = stationKeys.filter(k =>
        k.includes('横浜_') || k.includes('日吉_') || k.includes('中山_') || k.includes('北新横浜') // Targets
    ).slice(0, 20); // Limit to key targets

    // Add some random error targets
    targetKeys.push(stationKeys[100] || 'Unknown');

    // console.log('Target Keys:', targetKeys);

    let errorCount = 0;

    for (const key of targetKeys) {
        if (!key || !stations[key]) continue;
        const station = stations[key];

        // console.log(`Processing: ${station.name}...`);

        // Mock e-Stat Data: 
        // 1. Yokohama: JR Tkaido -> Valid
        // 2. Hiyoshi: Tokyu -> Valid
        // 3. Nakayama: Green Line -> Valid (if normalized)
        // 4. Error Case -> Return 0

        let newPassengerVolume = 0;

        // Error Simulation
        if (key === stationKeys[100]) {
            // Simulate "Data Not Found"
            newPassengerVolume = 0;
        } else {
            newPassengerVolume = Math.floor(Math.random() * 500000) + 10000;
            // Ensure Yokohama is high
            if (station.name.includes('横浜')) newPassengerVolume = 400000;
        }

        // Normalize Check: Yokohama Green Line
        // If station has Green Line, we expect it normalized
        const hasGreenLine = station.lines.some(l => l.includes('グリーンライン'));
        if (hasGreenLine) {
            // console.log(`[Verify] Green Line station found: ${station.name}`);
        }

        // B. 地価の更新 (Mock 2025)
        const landData = await fetchLandPrice(station.coordinates[1], station.coordinates[0]);

        // C. データ結合
        if (landData && key !== stationKeys[100]) { // Simulate error for one
            station.landPrice = landData.price;
            station.landPriceHistory = landData.history;
            station.tradeCount = Math.round(landData.price / 10000);
        }

        station.passengerVolume = newPassengerVolume;
        if (!station.passengerVolumeHistory) {
            station.passengerVolumeHistory = [];
        }

        // 既存履歴＋2024年版
        // 重複チェックなどは簡易的に省略
        station.passengerVolumeHistory.push({ year: 2024, count: newPassengerVolume });

        updatedCount++;
    }

    // 4. 保存 (Verification File)
    const VERIFY_PATH = path.join(process.cwd(), 'public', 'data', 'stations_verified.json');
    fs.writeFileSync(VERIFY_PATH, JSON.stringify(stations, null, 2));
    console.log(`Updated stations saved to ${VERIFY_PATH}`);

    // Dump Yokohama for report
    const yokoKey = stationKeys.find(k => k.startsWith('横浜_'));
    if (yokoKey) {
        console.log('--- Yokohama Data Dump ---');
        console.log(JSON.stringify(stations[yokoKey], null, 2));
    }
}

main().catch(console.error);
