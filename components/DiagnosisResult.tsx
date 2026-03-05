"use client";

import { useState } from "react";

import RiskGauge from "./RiskGauge";
import CityRadar from "./CityRadar";
import FutureTimeline from "./FutureTimeline";
import PopulationPyramid from "./PopulationPyramid";
import RedevelopmentTimeline from "./RedevelopmentTimeline";

type DiagnosisResultProps = {
    data: {
        verdict: string;
        headline: string;
        reasons: { label: string; value: string }[];
        rules: { label: string; value: string }[];
        note: string;
        debug: { score: number; dataYear?: number; stationName?: string };
        trendData?: { year: number; price: number; txCount?: number }[];
        marketPrice: number;
        yoy?: number;
        tx5y?: number;
        trend?: "UP" | "DOWN" | "FLAT";
        dataYear?: string | number;
        lines?: { name: string; color?: string; passengers?: number }[];
        name?: string;
        extendedMetrics?: {
            futurePopulationRate: number;
            populationProjection?: {
                year: number;
                total: number;
                ageStructure: {
                    "0-14": number;
                    "15-64": number;
                    "65+": number;
                };
            }[];
            sourceCity?: string;
            hazardRisk: {
                flood: { level: number; description: string };
                landslide: { level: number; description: string };
            };
        };
        totalScore?: number;
        metrics?: {
            asset: number;
            safety: number;
            future: number;
            convenience: number;
            liquidity: number;
        };
        redevelopmentProjects?: any[];
        metadata?: {
            sources: {
                realEstate: { name: string; year: number };
                population: { name: string; version: string; baseYear: number; targetYear: number };
                algorithm: { name: string; year: number };
                hazard?: { name: string; year: number };
                redevelopment?: { name: string; version: string };
            }
        };
    };
    onStock?: () => void;
    isStocked?: boolean;
    onLineClick?: (lineName: string) => void;
};

// 5-Level Bar Component
const LevelBar = ({ level, max = 5 }: { level: number; max?: number }) => {
    return (
        <div className="flex gap-1 h-3">
            {[...Array(max)].map((_, i) => (
                <div
                    key={i}
                    className={`flex-1 rounded-sm ${i < level ? "bg-[var(--brand-main)]" : "bg-[#E0E0E0]"}`}
                ></div>
            ))}
        </div>
    );
};

// RiskCard Component (extracted for cleaner render)
const RiskCard = ({ title, level, mainValue, description, action, source, sourceYear }: any) => {
    // Risk Level Color Logic
    const getRiskColor = (lvl: number) => {
        if (lvl >= 4) return "#C0392B"; // High Risk (Red)
        if (lvl === 3) return "#E67E22"; // Caution (Orange)
        return "#889E81"; // Safe (Sage Green)
    };

    const activeColor = getRiskColor(level);

    // Text Color Class for Action
    const getActionColorClass = (lvl: number) => {
        if (lvl >= 4) return "text-[#C0392B]";
        if (lvl === 3) return "text-[#E67E22]";
        return "text-[#708271]";
    };

    return (
        <div className="bg-white rounded-xl p-5 pb-8 md:p-8 md:pb-12 shadow-sm border border-[#E8E6DF] relative overflow-hidden group hover:shadow-md transition-shadow">
            {/* Top Border Indicator */}
            <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ backgroundColor: activeColor }}
            ></div>

            <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-[#4A544C] tracking-widest flex items-center gap-2">
                    {title}
                </h3>

                {/* Unified Risk Indicator (Badge + Dots) */}
                <div className="flex flex-col items-center gap-2">
                    {/* Badge with synchronized color */}
                    <div
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white"
                        style={{
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: activeColor,
                            color: activeColor
                        }}
                    >
                        Lv.{level}
                    </div>

                    {/* 5-Dot Circle Indicator */}
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((dotIndex) => (
                            <div
                                key={dotIndex}
                                className="w-1.5 h-1.5 rounded-full transition-colors"
                                style={{
                                    backgroundColor: dotIndex <= level
                                        ? activeColor
                                        : "#E0E0E0"
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mb-4">
                {mainValue}
            </div>

            <div className="space-y-2">
                <p className="text-xs text-[#4A544C] font-medium leading-relaxed">
                    {description}
                </p>
                {action && (
                    <div className={`text-xs font-bold flex items-start gap-1 ${getActionColorClass(level)}`}>
                        <span className="shrink-0">⚠</span>
                        <span>{action}</span>
                    </div>
                )}
            </div>

            <div className="mt-8 text-right">
                <div className="text-[9px] text-[#6D7C70]">出典: {source} {sourceYear ? `(${sourceYear}年版)` : ""}</div>
            </div>
        </div>
    );
};

// 公式ラインカラー辞書（関東・関西の主要路線を網羅）
const LINE_COLORS: Record<string, string> = {
    // === JR東日本 ===
    '山手線': '#9ACD32',        // ウグイス色
    '京浜東北線': '#00B2E5',    // スカイブルー
    '根岸線': '#00B2E5',
    '中央線快速': '#F15A22',    // オレンジ
    '中央線': '#F15A22',
    '中央本線': '#F15A22',
    'JR中央本線': '#F15A22',
    '総武線快速': '#0070B9',    // ネイビー
    '総武線': '#FFD400',        // カナリアイエロー
    '総武線各駅停車': '#FFD400',
    '埼京線': '#2E8B57',        // グリーン
    '川越線': '#2E8B57',
    '湘南新宿ライン': '#E21F26', // 赤
    '横須賀線': '#0070B9',      // ネイビー
    '東海道線': '#F68B1E',      // オレンジ
    '東海道本線': '#F68B1E',
    '上野東京ライン': '#E21F26',
    '高崎線': '#F68B1E',
    '宇都宮線': '#F68B1E',
    '東北本線': '#F68B1E',
    '常磐線快速': '#00B261',    // 緑
    '常磐線': '#00B261',
    '武蔵野線': '#F15A22',      // オレンジ
    '京葉線': '#DC143C',        // ワインレッド
    '南武線': '#FFD700',        // 黄色
    '横浜線': '#7FC342',        // 黄緑
    '青梅線': '#F68B1E',
    '五日市線': '#F68B1E',
    '八高線': '#8B4513',
    '相模線': '#00A6BF',        // 濃い水色系

    // === 東京メトロ ===
    '銀座線': '#FF9500',        // オレンジ
    '丸ノ内線': '#F62E36',      // 赤
    '日比谷線': '#B5B5AC',      // シルバー
    '東西線': '#009BBF',        // スカイブルー
    '千代田線': '#00BB85',      // グリーン
    '有楽町線': '#C1A470',      // ゴールド
    '半蔵門線': '#8F76D6',      // パープル
    '南北線': '#00AC9B',        // エメラルド
    '副都心線': '#9C5E31',      // ブラウン

    // === 都営地下鉄 ===
    '都営浅草線': '#E85298',    // ローズ
    '浅草線': '#E85298',
    '都営三田線': '#0079C2',    // ブルー
    '三田線': '#0079C2',
    '都営新宿線': '#B3C146',    // リーフグリーン
    '新宿線': '#B3C146',
    '都営大江戸線': '#B6275D',  // マゼンタ
    '大江戸線': '#B6275D',

    // === 東急電鉄 ===
    '東横線': '#DA0442',        // 赤
    '東急東横線': '#DA0442',
    '田園都市線': '#20A288',    // グリーン
    '東急田園都市線': '#20A288',
    '目黒線': '#009BBF',        // ブルー
    '東急目黒線': '#009BBF',
    '大井町線': '#F18C43',      // オレンジ
    '東急大井町線': '#F18C43',
    '池上線': '#EE86A7',        // ピンク
    '東急池上線': '#EE86A7',
    '東急多摩川線': '#AE0378',  // マゼンタ

    // === 小田急電鉄 ===
    '小田原線': '#2288CC',      // ブルー
    '小田急線': '#2288CC',
    '小田急小田原線': '#2288CC',
    '江ノ島線': '#2288CC',
    '小田急江ノ島線': '#2288CC',
    '多摩線': '#2288CC',
    '小田急多摩線': '#2288CC',

    // === 京王電鉄 ===
    '京王線': '#DD0067',        // マゼンタ
    '井の頭線': '#9ED44C',      // 黄緑
    '京王井の頭線': '#9ED44C',
    '相模原線': '#DD0067',
    '京王相模原線': '#DD0067',
    '高尾線': '#DD0067',
    '京王高尾線': '#DD0067',

    // === 西武鉄道 ===
    '西武池袋線': '#0068B7',    // ブルー
    '池袋線': '#0068B7',
    '西武新宿線': '#0068B7',
    '西武秩父線': '#0068B7',
    '西武多摩湖線': '#0068B7',

    // === 京急電鉄 ===
    '京急本線': '#E8334A',      // 赤
    '京急線': '#E8334A',
    '空港線': '#E8334A',
    '京急空港線': '#E8334A',
    '久里浜線': '#E8334A',
    '京急久里浜線': '#E8334A',

    // === 京成電鉄 ===
    '京成本線': '#0060A8',      // ブルー
    '京成線': '#0060A8',
    '成田スカイアクセス': '#FFA500',
    '押上線': '#0060A8',
    '京成押上線': '#0060A8',

    // === 相鉄 ===
    '相鉄本線': '#002B69',      // YOKOHAMA NAVYBLUE
    '相鉄線': '#002B69',
    'いずみ野線': '#002B69',
    '相鉄いずみ野線': '#002B69',
    '相鉄新横浜線': '#002B69',

    // === 東武鉄道 ===
    '東武伊勢崎線': '#0068B7',  // ブルー
    '東武スカイツリーライン': '#0068B7',
    '東上線': '#0068B7',
    '東武東上線': '#0068B7',
    '東武野田線': '#0068B7',
    'アーバンパークライン': '#0068B7',

    // === りんかい線・つくばエクスプレス ===
    'りんかい線': '#00ACD2',    // スカイブルー
    'つくばエクスプレス': '#0073CF', // ブルー

    // === 横浜市営地下鉄 ===
    'ブルーライン': '#0068B7',
    '横浜市ブルーライン': '#0068B7',
    'グリーンライン': '#00A040',
    '横浜市グリーンライン': '#00A040',

    // === 大阪メトロ ===
    '御堂筋線': '#E5171F',      // 赤
    '谷町線': '#522886',        // 紫
    '四つ橋線': '#0078BA',      // ブルー
    '中央線(大阪)': '#00A650',
    '千日前線': '#E44D93',      // ピンク
    '堺筋線': '#814721',        // 茶
    '長堀鶴見緑地線': '#A9CC51',// 黄緑
    '今里筋線': '#EE7B1A',      // オレンジ

    // === JR西日本 ===
    '大阪環状線': '#E50012',    // 赤
    '阪和線': '#F47321',        // オレンジ
    '関西本線': '#00A6BC',      // シアン
    '大和路線': '#00A6BC',
    '東西線(JR)': '#E5006F',    // ピンク
    'JR東西線': '#E5006F',
    '神戸線': '#0072BC',        // ブルー
    'JR神戸線': '#0072BC',
    '宝塚線': '#00A650',        // 緑
    'JR宝塚線': '#00A650',
    '奈良線': '#A57C50',        // 茶

    // === 阪急電鉄 ===
    '阪急神戸線': '#940028',    // マルーン
    '阪急宝塚線': '#940028',
    '阪急京都線': '#940028',

    // === 阪神電車 ===
    '阪神本線': '#F6891F',      // オレンジ
    '阪神なんば線': '#F6891F',

    // === 近畿日本鉄道 ===
    '近鉄奈良線': '#E60012',    // 赤
    '近鉄大阪線': '#E60012',
    '近鉄京都線': '#E60012',
    '近鉄南大阪線': '#E60012',

    // === 南海電鉄 ===
    '南海本線': '#0068B7',      // ブルー
    '南海高野線': '#0068B7',
};

// 公式ラインカラーを取得（部分一致対応）
function getLineColor(lineName: string): string {
    // 1. 完全一致
    if (LINE_COLORS[lineName]) {
        return LINE_COLORS[lineName];
    }

    // 2. 部分一致（最長一致キーを優先）
    let bestMatchColor = '';
    let maxMatchLength = 0;

    for (const [key, color] of Object.entries(LINE_COLORS)) {
        if (lineName.includes(key)) {
            if (key.length > maxMatchLength) {
                bestMatchColor = color;
                maxMatchLength = key.length;
            }
        }
    }

    if (bestMatchColor) return bestMatchColor;

    // 3. JR路線のデフォルト（上記に一致しないJR）
    if (lineName.includes('JR') || lineName.startsWith('JR')) {
        return '#00A040'; // JRグリーン
    }

    // 4. 地下鉄系のデフォルト
    if (lineName.includes('メトロ') || lineName.includes('地下鉄')) {
        return '#0068B7';
    }

    // 5. ハッシュベースの固定色（マイナー路線用）
    let hash = 0;
    for (let i = 0; i < lineName.length; i++) {
        hash = lineName.charCodeAt(i) + ((hash << 5) - hash);
    }
    // 彩度と明度を維持したHSLをHEXに変換
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash >> 8) % 20);
    const lightness = 40 + (Math.abs(hash >> 16) % 15);

    // HSL to HEX変換
    const hslToHex = (h: number, s: number, l: number): string => {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };

    return hslToHex(hue, saturation, lightness);
}

export default function DiagnosisResult({ data, onStock, isStocked, onLineClick }: DiagnosisResultProps) {
    const [activeTab, setActiveTab] = useState<"asset" | "safety" | "future" | "liquidity" | "convenience">("asset");

    // 完全な路線データマッピング（コーポレートカラー + 利用者数）
    const getCompleteLineData = (stationName: string) => {
        const completeData: Record<string, { name: string; color: string; passengers: number }[]> = {
            "武蔵小杉": [
                { name: "JR南武線", color: "#FFD700", passengers: 250000 },
                { name: "東急東横線", color: "#DA0442", passengers: 200000 },
                { name: "JR横須賀線", color: "#0070B9", passengers: 180000 },
                { name: "東急目黒線", color: "#009BBF", passengers: 120000 }
            ],
            "新宿": [
                { name: "JR山手線", color: "#9ACD32", passengers: 650000 },
                { name: "JR中央線", color: "#F15A22", passengers: 600000 },
                { name: "JR総武線", color: "#FFD400", passengers: 550000 },
                { name: "JR埼京線", color: "#2E8B57", passengers: 500000 },
                { name: "JR湘南新宿ライン", color: "#E21F26", passengers: 480000 },
                { name: "小田急小田原線", color: "#2288CC", passengers: 450000 },
                { name: "京王線", color: "#DD0067", passengers: 420000 },
                { name: "東京メトロ丸ノ内線", color: "#F62E36", passengers: 400000 },
                { name: "都営新宿線", color: "#B3C146", passengers: 350000 },
                { name: "都営大江戸線", color: "#B6275D", passengers: 320000 }
            ],
            "渋谷": [
                { name: "JR山手線", color: "#9ACD32", passengers: 500000 },
                { name: "東急東横線", color: "#DA0442", passengers: 450000 },
                { name: "東急田園都市線", color: "#20A288", passengers: 420000 },
                { name: "JR埼京線", color: "#2E8B57", passengers: 400000 },
                { name: "JR湘南新宿ライン", color: "#E21F26", passengers: 380000 },
                { name: "京王井の頭線", color: "#9ED44C", passengers: 350000 },
                { name: "東京メトロ銀座線", color: "#FF9500", passengers: 300000 },
                { name: "東京メトロ半蔵門線", color: "#8F76D6", passengers: 280000 },
                { name: "東京メトロ副都心線", color: "#9C5E31", passengers: 250000 }
            ],
            "東京": [
                { name: "JR山手線", color: "#9ACD32", passengers: 600000 },
                { name: "JR中央線", color: "#F15A22", passengers: 550000 },
                { name: "JR京浜東北線", color: "#00B2E5", passengers: 520000 },
                { name: "JR東海道線", color: "#F68B1E", passengers: 500000 },
                { name: "東京メトロ丸ノ内線", color: "#F62E36", passengers: 550000 },
                { name: "東京メトロ東西線", color: "#009BBF", passengers: 500000 },
                { name: "JR総武線", color: "#FFD400", passengers: 480000 },
                { name: "JR京葉線", color: "#DC143C", passengers: 400000 },
                { name: "東京メトロ千代田線", color: "#00BB85", passengers: 450000 },
                { name: "JR横須賀線", color: "#0070B9", passengers: 450000 }
            ],
            "横浜": [
                { name: "JR東海道線", color: "#F68B1E", passengers: 500000 },
                { name: "JR横須賀線", color: "#0070B9", passengers: 480000 },
                { name: "JR湘南新宿ライン", color: "#E21F26", passengers: 470000 },
                { name: "JR京浜東北線", color: "#00B2E5", passengers: 450000 },
                { name: "JR根岸線", color: "#00B2E5", passengers: 420000 },
                { name: "JR横浜線", color: "#7FC342", passengers: 400000 },
                { name: "東急東横線", color: "#DA0442", passengers: 380000 },
                { name: "京急本線", color: "#E8334A", passengers: 350000 },
                { name: "相鉄本線", color: "#002B69", passengers: 330000 },
                { name: "横浜高速鉄道みなとみらい線", color: "#003A70", passengers: 310000 },
                { name: "横浜市営地下鉄ブルーライン", color: "#0068B7", passengers: 300000 }
            ],
            "品川": [
                { name: "JR山手線", color: "#9ACD32", passengers: 450000 },
                { name: "JR京浜東北線", color: "#00B2E5", passengers: 420000 },
                { name: "JR東海道線", color: "#F68B1E", passengers: 400000 },
                { name: "JR横須賀線", color: "#00ACD1", passengers: 380000 },
                { name: "京急本線", color: "#D9171E", passengers: 350000 },
                { name: "東海道新幹線", color: "#1E50A0", passengers: 300000 }
            ],
            "大宮": [
                { name: "JR埼京線", color: "#2E8B57", passengers: 250000 },
                { name: "JR京浜東北線", color: "#00B2E5", passengers: 230000 },
                { name: "JR宇都宮線", color: "#F68B1E", passengers: 210000 },
                { name: "JR高崎線", color: "#F68B1E", passengers: 200000 },
                { name: "東武アーバンパークライン", color: "#0068B7", passengers: 130000 },
                { name: "埼玉新都市交通伊奈線", color: "#B3C146", passengers: 80000 },
                { name: "東北新幹線", color: "#00B261", passengers: 70000 },
                { name: "上越新幹線", color: "#00B261", passengers: 60000 },
                { name: "北陸新幹線", color: "#C1A470", passengers: 50000 }
            ]
        };

        return completeData[stationName] || [];
    };

    // サーバーからの路線データとマージ
    const mergeLineData = (serverLines: { name: string; color?: string; passengers?: number }[]) => {
        const stationName = data.debug?.stationName || data.name || "";
        const completeLines = getCompleteLineData(stationName);

        if (completeLines.length > 0) {
            return completeLines;
        }

        // サーバーデータがある場合はそのまま使用（フォールバック）
        return serverLines.map(line => ({
            name: line.name,
            color: line.color || getLineColor(line.name), // コーポレートカラー動的解決
            passengers: line.passengers // デフォルト値の10万人を削除
        }));
    };

    // 路線データを統合
    const displayLines = data.lines && data.lines.length > 0
        ? mergeLineData(data.lines)
        : mergeLineData([]);

    // 利用者数で降順ソート
    const sortedLines = [...displayLines].sort((a, b) => (b.passengers || 0) - (a.passengers || 0));

    // --- バックエンドスコアを直接使用（フロントエンド計算ロジック削除済み） ---
    const { totalScore, metrics } = data;

    // Fallback for types if old response cached (Safety Check)
    const safeTotalScore = totalScore ?? 0;
    const safeMetrics = metrics ?? { asset: 0, safety: 0, future: 0, convenience: 0, liquidity: 0 };

    // Rank calculation logic (same as CityRadar)
    const getRank = (score: number): string => {
        if (score >= 80) return "S";
        if (score >= 60) return "A";
        if (score >= 40) return "B";
        if (score >= 20) return "C";
        return "D";
    };

    // Premium Metallic Color Palette (Harmonized with Sage Green)
    const getRankColor = (rank: string): string => {
        switch (rank) {
            case "S": return "#C5A059"; // Premium Gold
            case "A": return "#889E81"; // Sage Green
            case "B": return "#9B9B7A"; // Muted Olive
            case "C": return "#A7907F"; // Warm Taupe (Earth)
            default: return "#9A8A7C";  // Stone Gray (D, Earth)
        }
    };

    const rank = getRank(safeTotalScore);
    const rankColor = getRankColor(rank);

    // Verdict Logic (Stamp)
    const getVerdictInfo = (verdict: string) => {
        switch (verdict) {
            case "safe":
                return { label: "推奨", sub: "RECOMMENDED", color: "#1B4D3E" }; // Sage Green
            case "caution":
                return { label: "注意", sub: "CAUTION", color: "#E67E22" }; // Orange
            case "risky":
                return { label: "要確認", sub: "CHECK", color: "#C0392B" }; // Red (custom urgency)
            default:
                return { label: "判定中", sub: "PENDING", color: "#7F8C8D" };
        }
    };

    const vInfo = getVerdictInfo(data.verdict);

    // Dynamic Source Year
    const sourceYear = data.debug?.dataYear || new Date().getFullYear();

    // Source Label Component
    const SourceCredit = ({ source, year }: { source: string; year?: string | number }) => (
        <div className="text-[10px] text-[#6D7C70] text-right mt-2 font-medium tracking-wide">
            出典: {source} {year ? `(${year}年版)` : ""}
        </div>
    );

    // Level Description Logic (Refined)
    const getFloodLevelInfo = (level: number) => {
        if (level === 0) return { text: "区域外", desc: "ハザードマップの浸水想定区域に含まれていません。", action: null };
        if (level <= 2) return { text: "0.5m未満", desc: "床下浸水相当。", action: "情報の確認と避難の準備を推奨します。" };
        if (level <= 4) return { text: "0.5m~3.0m", desc: "1階が浸水。", action: "2階への垂直避難が必要です。" };
        return { text: "3.0m以上", desc: "2階まで浸水。", action: "早期のエリア外避難が必須です。" };
    };

    const getLandslideLevelInfo = (level: number) => {
        if (level === 0) return { text: "区域外", desc: "土砂災害警戒区域に含まれていません。", action: null };
        if (level <= 2) return { text: "要注意", desc: "土砂災害警戒区域（イエローゾーン）に近いエリアです。", action: "崖や斜面から離れてください。" };
        return { text: "警戒区域", desc: "土砂災害警戒区域等のリスクがあります。", action: "地盤や崖の状況確認が必要です。" };
    };

    const getGroundLevelInfo = (amp: number) => {
        let level = 1;
        if (amp >= 2.0) level = 5;
        else if (amp >= 1.4) level = 3;

        const mainText = amp.toFixed(2);
        const desc = "表層地盤増幅率"; // Used as unit/label
        const action = level === 5 ? "特に揺れやすい地盤です。耐震性の高い建物が推奨されます。"
            : level === 3 ? "揺れやすい地盤です。家具の固定など対策が必要です。"
                : "比較的安定した地盤です。";

        return { level, mainText, desc, action };
    };

    const getEvacLevelInfo = (distance: number) => {
        let level = 1;
        if (distance > 1000) level = 5;
        else if (distance > 500) level = 3;

        const mainText = `${Math.floor(distance)}`;
        const desc = "最短避難距離";

        const action = level === 1 ? `非常に近く安心です。`
            : level === 3 ? `標準的な距離です。`
                : `避難経路の事前確認が重要です。`;

        return { level, mainText, desc, action };
    };

    return (
        <section className="relative mt-8 mb-20 mx-auto w-full max-w-[1000px] px-2 md:px-0">
            {/* Main Container - Nordic Paper Style */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-[var(--bg-primary)] p-5 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--brand-main)] via-[var(--brand-light)] to-[var(--brand-main)] opacity-20"></div>

                {/* 1. Header & Score Overview */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-0 gap-10">
                    <div className="flex-1 relative z-10 w-full">
                        {/* Station Name Heading */}
                        {data.debug.stationName && (
                            <div className="mb-0">
                                <h1 className="text-4xl md:text-7xl !font-serif font-medium tracking-tight mb-4" style={{ fontFamily: '"Zen Old Mincho", serif' }}>
                                    {data.name || data.debug.stationName}
                                </h1>

                                {/* Lines Badge Display (Sorted by Passengers with Passenger Count) */}
                                {sortedLines.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {sortedLines
                                            .map((line, idx) => (
                                                <div
                                                    key={line.name}
                                                    className="inline-flex items-center gap-2.5 px-4 py-2 bg-slate-50 rounded-full border border-slate-200 hover:border-slate-300 transition-all"
                                                >
                                                    <div
                                                        className="w-1 h-4 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: line.color || '#889E81' }}
                                                    />
                                                    <span className="text-xs font-medium text-slate-600 tracking-wide">
                                                        {line.name}
                                                    </span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stamp Effect */}
                        <div className="relative inline-block mt-2 transform -rotate-2 origin-left hover:rotate-0 transition-transform duration-500">
                            <div className="stamp-text text-xl md:text-2xl font-bold tracking-widest px-6 py-2 border-[3px] rounded-lg opacity-80"
                                style={{ color: vInfo.color, borderColor: vInfo.color }}>
                                {vInfo.label}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RiskGauge: Full-Width Safety Score (mb-20で固定) */}
                <div className="w-full mb-20">
                    <RiskGauge score={safeTotalScore} rank={rank} rankColor={rankColor} />
                </div>

                {/* Logic Explanation: Directly Below RiskGauge */}
                <div className="mb-12">
                    <h2 className="text-xs tracking-widest uppercase text-slate-500 mb-6 font-sans">
                        判定の根拠
                    </h2>
                    <ul className="space-y-4">
                        {data.rules.map((rule, i) => (
                            <li key={`rule-${i}`} className="flex gap-4 items-start text-sm">
                                <span className="text-[var(--brand-main)]/40 font-bold mt-0.5 text-xs">0{i + 1}</span>
                                <div>
                                    <strong className="block mb-1 font-medium text-slate-700 text-sm">{rule.label}</strong>
                                    <span className="text-slate-500 leading-relaxed text-sm block">{rule.value}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* FIXED SUMMARY SECTION (Radar Only) */}
                <div className="mb-24">
                    <h2 className="text-sm font-bold text-[#4A544C] tracking-widest uppercase mb-8 flex items-center gap-3">
                        <span className="w-1 h-5 bg-[#708271] rounded-full"></span>
                        スコア内訳
                    </h2>

                    <div className="flex flex-col gap-12">
                        <div className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                {/* Left: Radar Chart */}
                                <div className="w-full max-w-md mx-auto">
                                    <CityRadar
                                        assetScore={safeMetrics.asset}
                                        convenienceScore={safeMetrics.convenience}
                                        safetyScore={safeMetrics.safety}
                                        futureScore={safeMetrics.future}
                                        liquidityScore={safeMetrics.liquidity}
                                    />
                                </div>

                                {/* Right: Score Bars */}
                                <div className="w-full space-y-5 px-4">
                                    {[
                                        { label: "資産性", score: safeMetrics.asset, id: "asset" },
                                        { label: "安全性", score: safeMetrics.safety, id: "safety" },
                                        { label: "将来性", score: safeMetrics.future, id: "future" },
                                        { label: "流動性", score: safeMetrics.liquidity, id: "liquidity" },
                                        { label: "利便性", score: safeMetrics.convenience, id: "convenience" }
                                    ].map((metric) => {
                                        const mRank = getRank(metric.score);
                                        const mColor = getRankColor(mRank);
                                        return (
                                            <div key={metric.id} className="flex items-center gap-4">
                                                {/* Rank Badge */}
                                                <div
                                                    className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-sm font-bold text-white shadow-sm"
                                                    style={{ backgroundColor: mColor }}
                                                >
                                                    {mRank}
                                                </div>

                                                {/* Label (Noto Sans JP) */}
                                                <div className="w-16 text-sm font-bold text-[#4A544C] font-sans">
                                                    {metric.label}
                                                </div>

                                                {/* Bar Chart (Dynamic Rank Color) */}
                                                <div className="flex-1 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${metric.score}%`, backgroundColor: mColor }}
                                                    />
                                                </div>

                                                {/* Score Value (Lining Nums) */}
                                                <div className="w-8 text-right text-sm font-bold text-[#4A544C] lining-nums">
                                                    {metric.score}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="text-right mt-6 pr-2">
                                        <SourceCredit
                                            source={data.metadata?.sources.algorithm.name || "自社独自アルゴリズム算出"}
                                            year={data.metadata?.sources.algorithm.year || new Date().getFullYear()}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Detail Toggle (5 Tabs) */}
                <div className="flex justify-center mb-12">
                    <div className="flex flex-wrap justify-center gap-1 md:gap-2 bg-[var(--bg-primary)] p-1.5 md:rounded-full rounded-2xl max-w-full">
                        {[
                            { id: "asset", label: "資産性" },
                            { id: "safety", label: "安全性" },
                            { id: "future", label: "将来性" },
                            { id: "liquidity", label: "流動性" },
                            { id: "convenience", label: "利便性" }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-3 md:px-6 py-2 md:py-2.5 rounded-full text-[11px] md:text-xs font-bold tracking-widest transition-all
                                    ${activeTab === tab.id
                                        ? "bg-white text-[var(--brand-main)] shadow-sm"
                                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content Area */}
                <div className="min-h-[400px]">
                    {/* 1. 資産性 (Asset) */}
                    {activeTab === "asset" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
                            {/* Market Price Card */}
                            <div className="bg-white rounded-xl p-5 sm:p-10 shadow-sm border border-[#E8E6DF] relative overflow-hidden flex flex-col justify-center">
                                <h3 className="text-sm font-bold text-[#5F6E6F] tracking-widest mb-4">市場価格相場(70㎡換算)</h3>
                                <div className="flex flex-wrap items-center gap-y-2 min-h-[40px]">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[32px] font-bold text-[#4A544C] tracking-tight font-feature-settings-tnum">
                                            {data.marketPrice && data.marketPrice > 0 ? (data.marketPrice / 10000).toLocaleString() : "---"}
                                        </span>
                                        {data.marketPrice && data.marketPrice > 0 && (
                                            <span className="text-[14px] font-normal text-[#4A544C]">万円</span>
                                        )}
                                    </div>
                                    {(data.yoy !== undefined && !isNaN(data.yoy)) && (
                                        <div className="ml-6 flex items-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-sm border border-gray-100">
                                                <span className="text-[10px] font-bold text-[#5F6E6F]">前年比</span>
                                                <span className={`text-sm font-bold ${data.yoy >= 0 ? 'text-[#526453]' : 'text-[#C06C5F]'}`}>
                                                    {data.yoy > 0 ? '+' : ''}{data.yoy}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <SourceCredit source="国土交通省 不動産取引価格情報" year={data.dataYear} />
                                </div>
                            </div>

                            {/* Land Price Trend Graph */}
                            <div className="bg-white rounded-xl p-5 sm:p-10 shadow-sm border border-[#E8E6DF] relative overflow-hidden flex flex-col justify-center w-full">
                                <h3 className="text-sm font-bold text-[#4A544C] tracking-widest mb-4">
                                    地価推移実績（過去5年）
                                </h3>
                                <div className="w-full">
                                    <FutureTimeline
                                        historicalData={(data.trendData || []).map(d => ({
                                            year: d.year,
                                            price: d.price,
                                            type: "actual" as const
                                        }))}
                                        futureData={[]}
                                    />
                                </div>
                                <div className="mt-4 flex flex-col items-end gap-1">
                                    <SourceCredit source="国土交通省 不動産取引価格情報" year="2020-2024" />
                                    <div className="text-[9px] text-gray-400">※対象範囲: 駅周辺半径2km以内の取引事例</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. 安全性 (Safety) */}
                    {activeTab === "safety" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
                            {data.extendedMetrics ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-6">
                                    {/* River Flood Risk */}
                                    {(() => {
                                        const { level, description } = data.extendedMetrics.hazardRisk.flood;
                                        let mainText = "区域外";
                                        if (level >= 5) mainText = "3.0m以上";
                                        else if (level >= 3) mainText = "0.5m~3.0m";
                                        else if (level >= 1) mainText = "0.5m未満";

                                        let action: string | null = null;
                                        if (level >= 5) action = "早期の立ち退き避難が必要です。";
                                        else if (level >= 3) action = "2階以上への垂直避難を検討してください。";
                                        else if (level >= 1) action = "床下浸水への備えを確認してください。";

                                        return (
                                            <RiskCard
                                                title="河川氾濫リスク"
                                                level={level}
                                                mainValue={<div className="font-bold text-[32px] text-[#4A544C] font-feature-settings-tnum">{mainText}</div>}
                                                description={description}
                                                action={action}
                                                source={data.metadata?.sources.hazard?.name || "国土交通省 ハザードマップポータルサイト"}
                                                sourceYear={data.metadata?.sources.hazard?.year || data.dataYear}
                                            />
                                        );
                                    })()}

                                    {/* Landslide Risk */}
                                    {(() => {
                                        const { level, description } = data.extendedMetrics.hazardRisk.landslide;
                                        let mainText = "区域外";
                                        if (level >= 4) mainText = "警戒区域等";
                                        else if (level >= 1) mainText = "注意";

                                        let action: string | null = null;
                                        if (level >= 4) action = "崖や斜面の状況に注意が必要です。";

                                        return (
                                            <RiskCard
                                                title="土砂災害リスク"
                                                level={level}
                                                mainValue={<div className="font-bold text-[32px] text-[#4A544C] font-feature-settings-tnum">{mainText}</div>}
                                                description={description}
                                                action={action}
                                                source={data.metadata?.sources.hazard?.name || "国土交通省 ハザードマップポータルサイト"}
                                                sourceYear={data.metadata?.sources.hazard?.year || data.dataYear}
                                            />
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center py-20 text-[var(--text-muted)] font-light tracking-widest text-sm">
                                    詳細データがありません
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. 将来性 (Future) */}
                    {activeTab === "future" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
                            {/* Future Population */}
                            <div className="bg-white rounded-xl p-5 sm:p-10 shadow-sm border border-[#E8E6DF] relative overflow-hidden flex flex-col justify-center w-full">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-[#4A544C] tracking-widest inline-block mr-2">
                                        将来人口推計
                                    </h3>
                                    {data.extendedMetrics?.sourceCity && (
                                        <span className="text-xs text-gray-500">
                                            （{data.extendedMetrics.sourceCity}全体）
                                        </span>
                                    )}
                                </div>

                                {data.extendedMetrics?.populationProjection ? (
                                    <>
                                        <PopulationPyramid
                                            baseYear={data.metadata?.sources.population.baseYear}
                                            targetYear={data.metadata?.sources.population.targetYear}
                                            data2020={
                                                data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))?.ageStructure
                                                    ? [
                                                        { ageGroup: "0-14歳", population: data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))!.ageStructure["0-14"] / data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))!.total * 100 },
                                                        { ageGroup: "15-64歳", population: data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))!.ageStructure["15-64"] / data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))!.total * 100 },
                                                        { ageGroup: "65歳以上", population: data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))!.ageStructure["65+"] / data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.baseYear || 2020))!.total * 100 }
                                                    ]
                                                    : []
                                            }
                                            data2050={
                                                data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))?.ageStructure
                                                    ? [
                                                        { ageGroup: "0-14歳", population: data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))!.ageStructure["0-14"] / data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))!.total * 100 },
                                                        { ageGroup: "15-64歳", population: data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))!.ageStructure["15-64"] / data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))!.total * 100 },
                                                        { ageGroup: "65歳以上", population: data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))!.ageStructure["65+"] / data.extendedMetrics.populationProjection.find(d => d.year === (data.metadata?.sources.population.targetYear || 2050))!.total * 100 }
                                                    ]
                                                    : []
                                            }
                                        />
                                        <div className="mt-2 text-[10px] text-gray-400 text-right leading-relaxed">
                                            ※出典：{data.metadata?.sources.population.name || "国立社会保障・人口問題研究所「日本の地域別将来推計人口」"}
                                            {data.metadata?.sources.population.version ? `（${data.metadata?.sources.population.version}）` : ""}<br />
                                            ※駅周辺の固有値ではなく、所在自治体全体の推計です。
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-10 text-center flex flex-col items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                        <div className="text-gray-400 mb-2">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        </div>
                                        <div className="text-sm text-gray-500 font-medium tracking-wide">
                                            公的な詳細推計データは未収録です
                                        </div>
                                        <div className="text-xs text-gray-400 mt-2">
                                            ※この行政区の人口推計データは国勢調査のデータソースに含まれていません
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Redevelopment Timeline */}
                            <div className="bg-white rounded-xl p-5 sm:p-10 shadow-sm border border-[#E8E6DF] relative overflow-hidden flex flex-col justify-center w-full">
                                <RedevelopmentTimeline data={data.redevelopmentProjects} metadata={data.metadata?.sources.redevelopment} />
                            </div>
                        </div>
                    )}

                    {/* 4. 流動性 (Liquidity) */}
                    {activeTab === "liquidity" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
                            {/* Transaction Volume Card */}
                            <div className="bg-white rounded-xl p-5 sm:p-10 shadow-sm border border-[#E8E6DF] relative overflow-hidden flex flex-col justify-center">
                                <h3 className="text-sm font-bold text-[#5F6E6F] tracking-widest mb-4">取引件数(5年累計)</h3>
                                <div className="flex items-baseline min-h-[40px]">
                                    <span className="text-[32px] font-bold text-[#4A544C] font-feature-settings-tnum">
                                        {data.tx5y !== undefined && data.tx5y > 0 ? data.tx5y : "---"}
                                    </span>
                                    {data.tx5y !== undefined && data.tx5y > 0 && (
                                        <span className="text-[14px] ml-1 font-normal text-[#4A544C]">件</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-4 max-w-md leading-relaxed z-10">
                                    過去5年間に駅周辺（半径2km以内）で行われた不動産取引の総件数です。<br />
                                    取引件数が多いほど市場が活発で、売却時に買い手が見つかりやすい「流動性の高さ」を示します。
                                </p>
                                <div className="mt-6 flex justify-end z-10">
                                    <SourceCredit source={data.metadata?.sources.realEstate?.name || "国土交通省 不動産取引価格情報"} year={data.metadata?.sources.realEstate?.year || data.dataYear} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. 利便性 (Convenience) */}
                    {activeTab === "convenience" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
                            <div className="bg-white rounded-xl p-5 sm:p-10 shadow-sm border border-[#E8E6DF] relative overflow-hidden w-full">
                                <h3 className="text-sm font-bold text-[#4A544C] tracking-widest mb-6">
                                    乗り入れ路線インデックス
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sortedLines.length > 0 ? (
                                        sortedLines.map((line, idx) => (
                                            <button
                                                key={line.name}
                                                className="w-full text-left bg-[#F8F9FA] hover:bg-[#F0F2F1] hover:border-[var(--brand-main)]/50 transition-colors border text-sm border-[#E8E6DF] rounded-xl p-5 flex items-center justify-between shadow-sm group"
                                                onClick={() => onLineClick?.(line.name)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-1.5 h-10 rounded-full shrink-0"
                                                        style={{ backgroundColor: line.color || '#889E81' }}
                                                    />
                                                    <div className="font-bold text-slate-700">
                                                        {line.name}
                                                    </div>
                                                </div>
                                                <div className="text-[var(--brand-main)]/50 group-hover:text-[var(--brand-main)] group-hover:translate-x-1 transition-all">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M5 12h14"></path>
                                                        <path d="m12 5 7 7-7 7"></path>
                                                    </svg>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-center py-10 text-slate-400 text-sm">
                                            路線データがありません
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >

            {/* Semantic Decoration: 'Paper' shadow layer - Made subtle */}
            < div className="absolute top-4 left-4 w-full h-full bg-[#E8E6DF] -z-20 rounded-xl opacity-60" ></div >
        </section >
    );
}
