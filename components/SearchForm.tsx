"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PREFECTURES } from "../lib/constants";
import * as wanakana from 'wanakana';

// ローマ字入力用 路線名マッピング (主要路線のみ)
const LINE_KANA_MAP: Record<string, string> = {
    'yamanote': '山手線', 'やまのて': '山手線',
    'chuo': '中央線', 'ちゅうおう': '中央線',
    'sobu': '総武線', 'そうぶ': '総武線',
    'keihin': '京浜東北線', 'けいひん': '京浜東北線',
    'saikyo': '埼京線', 'さいきょう': '埼京線',
    'shonan': '湘南新宿ライン', 'しょうなん': '湘南新宿ライン',
    'tokyu': '東急', 'とうきゅう': '東急',
    'toyoko': '東横線', 'とうよこ': '東横線',
    'denen': '田園都市線', 'でんえん': '田園都市線',
    'odakyu': '小田急', 'おだきゅう': '小田急',
    'keio': '京王', 'けいおう': '京王',
    'seibu': '西武', 'せいぶ': '西武',
    'tobu': '東武', 'とうぶ': '東武',
    'keikyu': '京急', 'けいきゅう': '京急',
    'keisei': '京成', 'けいせい': '京成',
    'metro': 'メトロ', 'めとろ': 'メトロ',
    'ginza': '銀座線', 'ぎんざ': '銀座線',
    'marunouchi': '丸ノ内線', 'まるのうち': '丸ノ内線',
    'hibiya': '日比谷線', 'ひびや': '日比谷線',
    'tozai': '東西線', 'とうざい': '東西線',
    'chiyoda': '千代田線', 'ちよだ': '千代田線',
    'yurakucho': '有楽町線', 'ゆうらくちょう': '有楽町線',
    'hanzomon': '半蔵門線', 'はんぞうもん': '半蔵門線',
    'nanboku': '南北線', 'なんぼく': '南北線',
    'fukutoshin': '副都心線', 'ふくとしん': '副都心線',
    'toei': '都営', 'とえい': '都営',
    'asakusa': '浅草線', 'あさくさ': '浅草線',
    'mita': '三田線', 'みた': '三田線',
    'shinjuku': '新宿線', 'しんじゅく': '新宿線',
    'oedo': '大江戸線', 'おおえど': '大江戸線',
    'yokohama': '横浜線',
    'osaka': '大阪',
    'nagoya': '名古屋',
    'kyoto': '京都',
    'kobe': '神戸',
    'fukuoka': '福岡',
    'sapporo': '札幌',
    'sendai': '仙台'
};

// 型定義
type StationData = {
    name: string;
    kana?: string;
    prefCode: string;
    prefecture?: string;
    lines?: string[];
    coordinates?: [number, number];
    passengerVolume?: number;
};

type Props = {
    loading: boolean;
    onSearch: (station: string, pref: string) => void;
    onPrefetch?: (station: string, pref: string) => void;
    resultRef?: React.RefObject<HTMLDivElement>;
    externalLineSearch?: { line: string; ts: number } | null;
};

type TabType = "station" | "line";

const BRAND = {
    bg: "var(--bg-primary)",
    text: "var(--text-primary)",
    main: "var(--brand-main)",
    accent: "var(--brand-accent)",
    border: "var(--border-color)",
    light: "var(--bg-secondary)"
};

// SVGアイコン
const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

const TrainIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 8h.01" />
        <path d="M15 8h.01" />
        <path d="M12 12h.01" />
        <path d="M4 12h16" />
        <path d="M7 20v2" />
        <path d="M17 20v2" />
    </svg>
);

// 駅名正規化関数
function normalizeStationName(name: string): string {
    let normalized = name.replace(/\([^)]*\)/g, '');
    normalized = normalized.replace(/（[^）]*）/g, '');
    normalized = normalized.trim();
    return normalized;
}

// 路線を主要路線優先でソート
function sortLinesByPriority(lines: string[]): string[] {
    const priority = (line: string): number => {
        if (line.includes('JR東海道') || line.includes('JR山手') || line.includes('JR大阪環状') ||
            line.includes('JR京浜東北') || line.includes('JR中央') || line.includes('JR総武') ||
            line.includes('JR横須賀') || line.includes('JR湘南新宿') || line.includes('JR埼京') ||
            line.includes('JR常磐') || line.includes('JR東北') || line.includes('JR高崎')) {
            return 1;
        }
        if (line.startsWith('JR')) return 2;
        if (line.includes('メトロ') || line.includes('東急') || line.includes('阪急') ||
            line.includes('阪神') || line.includes('京急') || line.includes('小田急') ||
            line.includes('東武') || line.includes('西武') || line.includes('京王') ||
            line.includes('相鉄') || line.includes('京成') || line.includes('近鉄') ||
            line.includes('南海') || line.includes('都営') || line.includes('大阪メトロ') ||
            line.includes('御堂筋') || line.includes('谷町') || line.includes('四つ橋')) {
            return 3;
        }
        return 4;
    };

    return [...lines].sort((a, b) => {
        const pa = priority(a);
        const pb = priority(b);
        if (pa !== pb) return pa - pb;
        return a.localeCompare(b, 'ja');
    });
}

// 公式ラインカラー辞書（関東・関西の主要路線を網羅）
const LINE_COLORS: Record<string, string> = {
    // === JR東日本 ===
    '山手線': '#9ACD32', '京浜東北線': '#00B2E5', '根岸線': '#00B2E5', '中央線快速': '#F15A22', '中央線': '#F15A22',
    '中央本線': '#F15A22', 'JR中央本線': '#F15A22', '総武線快速': '#0068B7', '総武線': '#FFD400', '総武線各駅停車': '#FFD400',
    '埼京線': '#00AC9A', '川越線': '#00AC9A', '湘南新宿ライン': '#E21F26', '横須賀線': '#0068B7', '東海道線': '#F68B1E',
    '東海道本線': '#F68B1E', '上野東京ライン': '#E21F26', '高崎線': '#F68B1E', '宇都宮線': '#F68B1E', '東北本線': '#F68B1E',
    '常磐線快速': '#00B261', '常磐線': '#00B261', '武蔵野線': '#F15A22', '京葉線': '#C9252F', '南武線': '#FFD400',
    '横浜線': '#7FC342', '青梅線': '#F68B1E', '五日市線': '#F68B1E', '八高線': '#8B4513', '相模線': '#7FC342',
    // === 東京メトロ ===
    '銀座線': '#F39700', '丸ノ内線': '#E60012', '日比谷線': '#8BA2AE', '東西線': '#00A7DB', '千代田線': '#00BB85',
    '有楽町線': '#C1A470', '半蔵門線': '#8F76D6', '南北線': '#00ADA9', '副都心線': '#9C5E31',
    // === 都営地下鉄 ===
    '都営浅草線': '#E85298', '浅草線': '#E85298', '都営三田線': '#0079C2', '三田線': '#0079C2', '都営新宿線': '#6CBB5A',
    '新宿線': '#6CBB5A', '都営大江戸線': '#B6007A', '大江戸線': '#B6007A',
    // === 東急電鉄 ===
    '東横線': '#DA0442', '東急東横線': '#DA0442', '田園都市線': '#20A288', '東急田園都市線': '#20A288', '目黒線': '#009BBF',
    '東急目黒線': '#009BBF', '大井町線': '#F18C43', '東急大井町線': '#F18C43', '池上線': '#EE86A7', '東急池上線': '#EE86A7',
    '東急多摩川線': '#AE0378',
    // === 小田急電鉄 ===
    '小田原線': '#2288CC', '小田急線': '#2288CC', '小田急小田原線': '#2288CC', '江ノ島線': '#2288CC', '小田急江ノ島線': '#2288CC',
    '多摩線': '#2288CC', '小田急多摩線': '#2288CC',
    // === 京王電鉄 ===
    '京王線': '#DD0067', '井の頭線': '#9ED44C', '京王井の頭線': '#9ED44C', '相模原線': '#DD0067', '京王相模原線': '#DD0067',
    '高尾線': '#DD0067', '京王高尾線': '#DD0067',
    // === 西武鉄道 ===
    '西武池袋線': '#0068B7', '池袋線': '#0068B7', '西武新宿線': '#0068B7', '西武秩父線': '#0068B7', '西武多摩湖線': '#0068B7',
    // === 京急電鉄 ===
    '京急本線': '#E8334A', '京急線': '#E8334A', '空港線': '#E8334A', '京急空港線': '#E8334A', '久里浜線': '#E8334A',
    '京急久里浜線': '#E8334A',
    // === 京成電鉄 ===
    '京成本線': '#0060A8', '京成線': '#0060A8', '成田スカイアクセス': '#FFA500', '押上線': '#0060A8', '京成押上線': '#0060A8',
    // === 相鉄 ===
    '相鉄本線': '#004B97', '相鉄線': '#004B97', 'いずみ野線': '#004B97', '相鉄いずみ野線': '#004B97', '相鉄新横浜線': '#004B97',
    // === 東武鉄道 ===
    '東武伊勢崎線': '#0068B7', '東武スカイツリーライン': '#0068B7', '東上線': '#0068B7', '東武東上線': '#0068B7',
    '東武野田線': '#0068B7', 'アーバンパークライン': '#0068B7',
    // === りんかい線・つくばエクスプレス ===
    'りんかい線': '#00ACD2', 'つくばエクスプレス': '#0073CF',
    // === 横浜市営地下鉄 ===
    'ブルーライン': '#0068B7', '横浜市ブルーライン': '#0068B7', 'グリーンライン': '#00A040', '横浜市グリーンライン': '#00A040',
    // === 大阪メトロ ===
    '御堂筋線': '#E5171F', '谷町線': '#522886', '四つ橋線': '#0078BA', '中央線(大阪)': '#00A650', '千日前線': '#E44D93',
    '堺筋線': '#814721', '長堀鶴見緑地線': '#A9CC51', '今里筋線': '#EE7B1A',
    // === JR西日本 ===
    '大阪環状線': '#E50012', '阪和線': '#F47321', '関西本線': '#00A6BC', '大和路線': '#00A6BC', '東西線(JR)': '#E5006F',
    'JR東西線': '#E5006F', '神戸線': '#0072BC', 'JR神戸線': '#0072BC', '宝塚線': '#00A650', 'JR宝塚線': '#00A650',
    '奈良線': '#A57C50',
    // === 阪急電鉄 ===
    '阪急神戸線': '#940028', '阪急宝塚線': '#940028', '阪急京都線': '#940028',
    // === 阪神電車 ===
    '阪神本線': '#F6891F', '阪神なんば線': '#F6891F',
    // === 近畿日本鉄道 ===
    '近鉄奈良線': '#E60012', '近鉄大阪線': '#E60012', '近鉄京都線': '#E60012', '近鉄南大阪線': '#E60012',
    // === 南海電鉄 ===
    '南海本線': '#0068B7', '南海高野線': '#0068B7',
};

// 公式ラインカラーを取得（部分一致対応）
function getLineColor(lineName: string): string {
    if (LINE_COLORS[lineName]) return LINE_COLORS[lineName];

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
    if (lineName.includes('JR') || lineName.startsWith('JR')) return '#00A040';
    if (lineName.includes('メトロ') || lineName.includes('地下鉄')) return '#0068B7';

    let hash = 0;
    for (let i = 0; i < lineName.length; i++) {
        hash = lineName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash >> 8) % 20);
    const lightness = 40 + (Math.abs(hash >> 16) % 15);

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


export default function SearchForm({ loading, onSearch, onPrefetch, resultRef, externalLineSearch }: Props) {
    const [selectedPref, setSelectedPref] = useState<{ code: string, name: string } | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>("station");

    const [stationQuery, setStationQuery] = useState("");
    const [showStationSuggestions, setShowStationSuggestions] = useState(false);
    const [apiSuggestions, setApiSuggestions] = useState<StationData[]>([]);

    // Line Logic
    const [lineQuery, setLineQuery] = useState("");
    const [showLineSuggestions, setShowLineSuggestions] = useState(false);
    const [selectedLineForStation, setSelectedLineForStation] = useState("");
    const [showLineStationSelect, setShowLineStationSelect] = useState(false); // For custom select UI

    // Prefetch timer logic
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = useCallback((station: StationData) => {
        if (!onPrefetch) return;
        const normalizedName = normalizeStationName(station.name);
        hoverTimerRef.current = setTimeout(() => {
            onPrefetch(normalizedName, station.prefCode);
        }, 300);
    }, [onPrefetch]);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);

    const [allStations, setAllStations] = useState<StationData[]>([]);

    // データ読み込み
    useEffect(() => {
        const loadStations = async () => {
            try {
                const response = await fetch(`/data/stations.json?v=${new Date().getTime()}`);
                const rawData = await response.json();

                const normalizedStations: StationData[] = Object.values(rawData).map((station: any) => {
                    const prefCode = String(station.prefCode || "").padStart(2, '0');
                    return {
                        name: station.name || "",
                        kana: station.kana, // Inject reading form local
                        prefCode: prefCode,
                        prefecture: station.prefecture,
                        lines: Array.isArray(station.lines)
                            ? station.lines.map((l: string) => l === 'グリーンライン' ? '横浜市グリーンライン' : l)
                            : (station.lines ? [station.lines === 'グリーンライン' ? '横浜市グリーンライン' : station.lines] : []),
                        coordinates: station.coordinates,
                        passengerVolume: station.passengerVolume || 0
                    };
                });
                setAllStations(normalizedStations);
            } catch (error) {
                console.error('[データ読込エラー]', error);
            }
        };
        loadStations();
    }, []);

    // 外部（DiagnosisResult等）からの路線検索リクエストの監視
    useEffect(() => {
        if (externalLineSearch) {
            setActiveTab("line");
            setLineQuery(externalLineSearch.line);
            setSelectedLineForStation(externalLineSearch.line);
            setShowLineSuggestions(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [externalLineSearch]);

    // 漢字判定
    const isKanji = (text: string) => {
        return /[\u4e00-\u9faf]/.test(text);
    };

    // 駅名検索 (Strict Local First + API Backup)
    useEffect(() => {
        if (!stationQuery || stationQuery.length < 1) {
            setApiSuggestions([]);
            return;
        }

        const normalizedInput = wanakana.toHiragana(stationQuery);

        // ローカル補完ロジック (API Backup)
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/stations?name=${encodeURIComponent(normalizedInput)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.stations) {
                        const enriched = data.stations.map((apiS: any) => {
                            const localMatch = allStations.find(local => local.name === apiS.name);
                            if (localMatch) {
                                return localMatch;
                            }
                            return {
                                name: apiS.name,
                                kana: apiS.kana,
                                prefCode: apiS.pref || "13",
                                prefecture: apiS.prefecture || "不明",
                                lines: apiS.lines || [],
                                passengerVolume: 0
                            } as StationData;
                        });
                        setApiSuggestions(enriched);
                    }
                }
            } catch (e) {
                // Ignore API error
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [stationQuery, allStations]);

    // 統合サジェスト生成 (Synchronous Local hit + Async API append)
    const stationSuggestions = useMemo(() => {
        if (!stationQuery) return [];

        const normalizedInput = wanakana.toHiragana(stationQuery);
        const normalizedRomaji = wanakana.toRomaji(stationQuery).toLowerCase();

        // 1. Local Search (Physical)
        const localMatches = allStations
            .filter(s => {
                const nameMatch = s.name.startsWith(stationQuery) || s.name.includes(stationQuery);
                const kanaMatch = s.kana && (s.kana === normalizedInput || s.kana.startsWith(normalizedInput));
                const romajiMatch = s.kana && wanakana.toRomaji(s.kana).toLowerCase().startsWith(normalizedRomaji);
                return nameMatch || kanaMatch || romajiMatch;
            })
            .sort((a, b) => (b.passengerVolume || 0) - (a.passengerVolume || 0));

        // 2. API Merge
        const newApiSuggestions = apiSuggestions.filter(apiS =>
            !localMatches.find(local => local.name === apiS.name)
        );

        return [...localMatches, ...newApiSuggestions].slice(0, 50);
    }, [stationQuery, allStations, apiSuggestions]);

    // 路線ごとの総乗降客数を計算（ソート用）
    const lineVolumeMap = useMemo(() => {
        const map = new Map<string, number>();
        allStations.forEach(s => {
            s.lines?.forEach(line => {
                const current = map.get(line) || 0;
                map.set(line, current + (s.passengerVolume || 0));
            });
        });
        return map;
    }, [allStations]);

    // 路線サジェスト (Enhanced with Romanji Map)
    const lineSuggestions = useMemo(() => {
        if (!lineQuery || lineQuery.length < 1) return [];

        let searchTarget = lineQuery.toLowerCase();
        const normalizedKana = wanakana.toHiragana(lineQuery);

        // 変換マップを用いて部分一致する漢字の路線名を収集
        const matchedKanjiLines = new Set<string>();
        for (const [key, val] of Object.entries(LINE_KANA_MAP)) {
            if (key.startsWith(normalizedKana) || key.startsWith(searchTarget)) {
                matchedKanjiLines.add(val);
            }
        }

        if (LINE_KANA_MAP[searchTarget]) {
            searchTarget = LINE_KANA_MAP[searchTarget];
        } else {
            const mappedKey = Object.keys(LINE_KANA_MAP).find(k => normalizedKana.includes(k) || searchTarget.includes(k));
            if (mappedKey) {
                searchTarget = LINE_KANA_MAP[mappedKey];
            }
        }

        const allLines = Array.from(new Set(allStations.flatMap(s => s.lines || [])));
        return allLines
            .filter(line => {
                if (line.toLowerCase().includes(searchTarget) || line.includes(normalizedKana)) return true;
                // マップでマッチした漢字路線名が含まれているかもチェック
                for (const kanji of matchedKanjiLines) {
                    if (line.includes(kanji)) return true;
                }
                return false;
            })
            .sort((a, b) => {
                const volA = lineVolumeMap.get(a) || 0;
                const volB = lineVolumeMap.get(b) || 0;
                if (volA !== volB) return volB - volA;
                return a.length - b.length;
            })
            .slice(0, 50);
    }, [lineQuery, allStations, lineVolumeMap]);

    // Stations within selected line
    const stationsInSelectedLine = useMemo(() => {
        if (!selectedLineForStation) return [];
        return allStations
            .filter(s => s.lines?.includes(selectedLineForStation))
            .sort((a, b) => (b.passengerVolume || 0) - (a.passengerVolume || 0));
    }, [selectedLineForStation, allStations]);

    // Handlers
    const handleStationSelect = (station: StationData) => {
        (document.activeElement as HTMLElement)?.blur();
        setStationQuery(station.name);
        setShowStationSuggestions(false);
        const targetPrefCode = station.prefCode;
        const normalizedName = normalizeStationName(station.name);
        onSearch(normalizedName, targetPrefCode);
        setTimeout(() => resultRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    const handleLineSelect = (line: string) => {
        (document.activeElement as HTMLElement)?.blur();
        setLineQuery(line);
        setShowLineSuggestions(false);
        setSelectedLineForStation(line);
        setShowLineStationSelect(false);
    };

    const handleLineStationChange = (station: StationData) => {
        (document.activeElement as HTMLElement)?.blur();
        setShowLineStationSelect(false);
        const normalizedName = normalizeStationName(station.name);
        const targetPrefCode = station.prefCode;
        onSearch(normalizedName, targetPrefCode);
        setTimeout(() => resultRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    return (
        <div className="w-full relative" style={{ background: BRAND.bg }}>
            <div className="bg-white shadow-lg rounded-2xl">
                {/* Tabs */}
                <div className="grid grid-cols-2 w-full rounded-t-2xl overflow-hidden">
                    <button
                        className="px-8 py-4 font-bold text-sm transition-all flex items-center justify-center gap-2"
                        style={{
                            background: activeTab === "station" ? "var(--brand-main)" : "#F3F4F6",
                            color: activeTab === "station" ? "white" : "#9CA3AF"
                        }}
                        onClick={() => setActiveTab("station")}
                    >
                        <SearchIcon />
                        <span>駅名で検索</span>
                    </button>
                    <button
                        className="px-8 py-4 font-bold text-sm transition-all flex items-center justify-center gap-2"
                        style={{
                            background: activeTab === "line" ? "var(--brand-main)" : "#F3F4F6",
                            color: activeTab === "line" ? "white" : "#9CA3AF"
                        }}
                        onClick={() => setActiveTab("line")}
                    >
                        <TrainIcon />
                        <span>路線名で検索</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 pb-6">
                    {/* Station Search */}
                    {activeTab === "station" && (
                        <div>
                            <h2 className="text-xl font-bold mb-4" style={{ color: BRAND.text }}>駅名を入力</h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full px-6 py-4 text-lg rounded-lg border-2 focus:outline-none focus:border-[var(--brand-main)] focus:ring-4 focus:ring-[var(--brand-main)]/20 transition-all"
                                    style={{ borderColor: BRAND.border, color: BRAND.text }}
                                    placeholder="駅名を入力 (例: 新宿、横浜)"
                                    value={stationQuery}
                                    onChange={(e) => {
                                        setStationQuery(e.target.value);
                                        setShowStationSuggestions(true);
                                    }}
                                    onFocus={() => setShowStationSuggestions(true)}
                                    // Use minimal delay for blur to allow click
                                    onBlur={() => setTimeout(() => setShowStationSuggestions(false), 200)}
                                />
                                {showStationSuggestions && stationSuggestions.length > 0 && (
                                    <div
                                        className="absolute z-50 w-full mt-2 bg-white border-2 rounded-lg shadow-xl max-h-96 overflow-y-auto"
                                        style={{ borderColor: BRAND.border }}
                                        onMouseDown={(e) => e.preventDefault()} // Prevent blur on mousedown
                                    >
                                        {stationSuggestions.map((station, idx) => (
                                            <button
                                                key={idx}
                                                className="w-full text-left px-6 py-3 hover:bg-[#F7F5F0] transition-colors border-b"
                                                style={{ borderColor: BRAND.border, color: BRAND.text }}
                                                onClick={() => handleStationSelect(station)}
                                                onMouseEnter={() => handleMouseEnter(station)}
                                                onMouseLeave={handleMouseLeave}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="font-bold text-base">{station.name}</div>
                                                    {station.passengerVolume && (
                                                        <div className="text-xs font-bold text-[var(--brand-main)]">
                                                            {(station.passengerVolume / 10000).toFixed(1)}万人/日
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 whitespace-normal leading-relaxed">
                                                    {station.prefecture} • {station.lines?.join(' / ')}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Line Search */}
                    {activeTab === "line" && (
                        <div>
                            <h2 className="text-xl font-bold mb-4" style={{ color: BRAND.text }}>路線名を入力</h2>
                            <div className="relative mb-5">
                                <input
                                    type="text"
                                    className="w-full px-6 py-4 text-lg rounded-lg border-2 focus:outline-none focus:border-[var(--brand-main)] focus:ring-4 focus:ring-[var(--brand-main)]/20 transition-all"
                                    style={{ borderColor: BRAND.border, color: BRAND.text }}
                                    placeholder="路線名を入力 (例: 山手線、東急東横)"
                                    value={lineQuery}
                                    onChange={(e) => {
                                        setLineQuery(e.target.value);
                                        setShowLineSuggestions(true);
                                    }}
                                    onFocus={() => setShowLineSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowLineSuggestions(false), 200)}
                                />
                                {showLineSuggestions && lineSuggestions.length > 0 && (
                                    <div
                                        className="absolute z-50 w-full mt-2 bg-white border-2 rounded-lg shadow-xl max-h-96 overflow-y-auto"
                                        style={{ borderColor: BRAND.border }}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        {lineSuggestions.map((line, idx) => (
                                            <button
                                                key={idx}
                                                className="w-full text-left px-6 py-3 hover:bg-[#F7F5F0] transition-colors border-b flex items-center justify-between"
                                                style={{ borderColor: BRAND.border, color: BRAND.text }}
                                                onClick={() => handleLineSelect(line)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: getLineColor(line) }}></div>
                                                    <div className="font-medium text-lg">{line}</div>
                                                </div>
                                                <div className="text-xs font-bold text-gray-500">
                                                    {((lineVolumeMap.get(line) || 0) / 10000).toFixed(1)}万人/日
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Stations in Line (Custom Select UI for Prefetching) */}
                            {selectedLineForStation && stationsInSelectedLine.length > 0 && (
                                <div className="mb-5 relative">
                                    <label className="block text-sm font-bold mb-2" style={{ color: BRAND.text }}>
                                        {selectedLineForStation} の駅を選択
                                    </label>
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-3 rounded-lg border-2 transition-all flex justify-between items-center bg-white"
                                        style={{ borderColor: BRAND.border, color: BRAND.text }}
                                        onClick={() => setShowLineStationSelect(!showLineStationSelect)}
                                        disabled={loading}
                                    >
                                        <span>{loading ? "診断中..." : "駅を選択してください"}</span>
                                        <svg className={`w-5 h-5 transition-transform ${showLineStationSelect ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </button>

                                    {showLineStationSelect && !loading && (
                                        <div
                                            className="absolute z-50 w-full mt-2 bg-white border-2 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                                            style={{ borderColor: BRAND.border }}
                                        >
                                            {stationsInSelectedLine.map((station, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-[#F7F5F0] transition-colors border-b text-sm"
                                                    style={{ borderColor: BRAND.border, color: BRAND.text }}
                                                    onClick={() => handleLineStationChange(station)}
                                                    onMouseEnter={() => handleMouseEnter(station)}
                                                    onMouseLeave={handleMouseLeave}
                                                >
                                                    <span className="font-bold">{station.name}</span>
                                                    <span className="ml-2 text-xs text-gray-500">({station.prefecture})</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="mt-6 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BRAND.accent }}></div>
                            <p className="mt-4 text-sm" style={{ color: BRAND.text }}>データを分析中...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}