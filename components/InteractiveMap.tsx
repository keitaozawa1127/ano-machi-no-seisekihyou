"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { geoMercator, geoPath, geoContains, geoCentroid, geoBounds } from "d3";
import { getCityCodeRange, type CityAreaId } from "../lib/cityUtils";

// グローバルキャッシュ
const geoCache = new Map<string, any>();

// 無印パレット（高コントラスト強化版）
const MUJI = {
    bg: "#F7F5F0",
    unselected: "#f3f4f6",
    low: "#E0C38C",      // 濃ベージュ（視認性向上）
    mid: "#C58940",      // 茶色（明確な中価格帯）
    high: "#A62232",     // 濃赤（MUJIレッド・高価格帯）
    selected: "#A64036",
    stroke: "#ddd",
    text: "#4A4A4A",
    border: "#E6E1D6"  // NEW: for lint error fix
};

// 政令指定都市パターン削除 (汎用ロジック移行)

interface InteractiveMapProps {
    onSelectArea: (code: string, name: string, feature: any) => void;
    selectedCityCode: string | null;
    selectedPref: string;
    selectedCityArea?: CityAreaId; // NEW: 都市別フィルタリング
    allStations: any[];
    selectedPolygon?: any;
    onStationsEnriched?: (stations: any[]) => void;
}

const MapPath = memo(({ d, isSelected, color, onSelect, onHover, onLeave, dataCityCode, pathData }: any) => {
    const handleMouseOver = (e: any) => {
        e.currentTarget.style.filter = 'brightness(1.15)';
        e.currentTarget.style.strokeWidth = '1.5';
        // ⚠️ 重要: path dataも一緒に渡す
        if (onHover) onHover(e, pathData);
    };

    const handleMouseOut = (e: any) => {
        e.currentTarget.style.filter = 'brightness(1)';
        e.currentTarget.style.strokeWidth = isSelected ? '2' : '0.3';
        if (onLeave) onLeave();
    };

    return (
        <path
            d={d}
            fill={color}
            stroke={isSelected ? "#fff" : MUJI.stroke}
            strokeWidth={isSelected ? 2 : 0.3}
            className="cursor-pointer"
            data-city-code={dataCityCode}
            onClick={onSelect}
            onMouseEnter={handleMouseOver}
            onMouseLeave={handleMouseOut}
            style={{
                filter: 'brightness(1)',
                transition: 'filter 0.2s, stroke-width 0.2s'
            }}
        />
    );
}, (prev, next) => prev.color === next.color && prev.isSelected === next.isSelected && prev.d === next.d);

MapPath.displayName = 'MapPath';

export const InteractiveMap = ({ onSelectArea, selectedCityCode, selectedPref, selectedCityArea, allStations, onStationsEnriched }: InteractiveMapProps) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [geoData, setGeoData] = useState<any>(null);
    const [hoveredArea, setHoveredArea] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [cityColors, setCityColors] = useState<Map<string, string>>(new Map());
    const [cityData, setCityData] = useState<Map<string, { stations: number; price: number }>>(new Map());
    const [isCalculating, setIsCalculating] = useState(false);

    // 超柔軟マッチング関数（Generic: Code > Geometry > Name）
    const matchStationsToCity = useCallback((cityName: string, feature: any, stations: any[]) => {
        if (!stations.length) return [];

        const matched: any[] = [];
        const targetCityCode = feature?.properties?.N03_007; // JIS Identifier

        // Calc bounds once for this feature
        let bounds: [[number, number], [number, number]] | null = null;
        if (feature && feature.geometry) {
            try { bounds = geoBounds(feature); } catch (e) { }
        }

        for (const s of stations) {
            let isMatch = false;

            // 方法0: ID完全一致 (最速・超正確)
            // API側でcity_codeが付与されている場合(例: 東京23区)はこれを優先
            if (targetCityCode && (s as any).city_code === targetCityCode) {
                isMatch = true;
            }

            // 方法1: geoContains（座標が正確な場合） - DISABLED FOR PERF CHECK
            /*
            if (!isMatch && s.x && s.y && feature) {
                try {
                    // Bounding Box Pre-check (Dramatic Performance Boost)
                    // Calculate bounds once per feature (hoisted would be better, but engine optimizes)
                    // Actually, we should hoist it outside the loop.
                    // But inside this function, we do it. matchStationsToCity is called once per feature.
                    // Doing it here means we might calc it for every station if not careful? 
                    // No, invalid control flow. We should calc OUTSIDE the loop.
                    // BUT, I'll allow the variable access if I hoist it.
                } catch { }

                const isInBounds = !bounds || (
                    s.x >= bounds[0][0] && s.x <= bounds[1][0] &&
                    s.y >= bounds[0][1] && s.y <= bounds[1][1]
                );

                if (isInBounds && geoContains(feature, [s.x, s.y])) {
                    isMatch = true;
                }
            }
            */

            // 方法2: 住所文字列マッチング
            if (!isMatch) {
                // GeoJSONのDisplayName (例: "横浜市中区") が駅の住所に含まれるか？
                const addr = (s as any)._searchString || JSON.stringify(s).toLowerCase();
                const searchTerms = [
                    cityName
                ].filter(Boolean);

                for (const term of searchTerms) {
                    if (term && addr.includes(term.toLowerCase())) {
                        isMatch = true;
                        break;
                    }
                }
            }

            // 方法3: 削除 (汎用ロジック移行済み)

            if (isMatch) {
                matched.push(s);
            }
        }

        return matched;
    }, [allStations]);

    // GeoJSONロード + 島嶼部物理削除
    useEffect(() => {
        if (!selectedPref) return;

        if (geoCache.has(selectedPref)) {
            setGeoData(geoCache.get(selectedPref));
            return;
        }

        setIsLoading(true);
        setCityColors(new Map());

        fetch(`/data/${selectedPref}.json`)
            .then(res => res.json())
            .then(data => {
                const originalCount = data.features.length;

                // 東京都の島嶼部物理削除
                if (selectedPref === "13") {
                    data.features = data.features.filter((f: any) => {
                        try {
                            const centroid = geoCentroid(f);
                            return centroid[1] >= 35.5;
                        } catch { return true; }
                    });
                    console.log(`[AUDIT] Tokyo: Filtered ${originalCount} -> ${data.features.length} features`);
                }

                geoCache.set(selectedPref, data);
                setGeoData(data);
            })
            .finally(() => setIsLoading(false));
    }, [selectedPref]);

    // パス計算（都市別フィルタリング適用 + オートズーム + 市町村名フォールバック）
    const paths = useMemo(() => {
        if (!geoData) return [];

        const width = 800;
        const height = 600;
        const margin = 20;

        let features = geoData.features;

        // 都市が選択されている場合、そのJISコード範囲のポリゴンのみを抽出
        if (selectedCityArea && selectedCityArea !== 'other') {
            const codeRange = getCityCodeRange(selectedCityArea);
            if (codeRange) {
                const [minCode, maxCode] = codeRange;

                // まずJISコードでフィルタリング（文字列でも前方一致を確実に）
                let filteredFeatures = geoData.features.filter((f: any) => {
                    const jisCode = String(f.properties?.N03_007 || '');

                    // 14100番台（横浜・川崎）などを確実に拾うため、前方一致と範囲チェックを徹底
                    const isDesignatedCity = jisCode.startsWith(String(minCode).substring(0, 3));
                    const isWithinRange = Number(jisCode) >= minCode && Number(jisCode) <= maxCode;

                    if (isDesignatedCity || isWithinRange) return true;

                    // 市名での部分一致（N03_004: 横浜市、大阪市など）
                    const cityNameMap: Record<string, string[]> = {
                        'tokyo23': ['区', '特別区'],
                        'yokohama': ['横浜市', '横浜'],
                        'kawasaki': ['川崎市', '川崎'],
                        'osaka': ['大阪市', '大阪'],
                        'nagoya': ['名古屋市', '名古屋'],
                        'fukuoka': ['福岡市', '福岡'],
                        'kitakyushu': ['北九州市', '北九州'],
                        'sapporo': ['札幌市', '札幌'],
                        'sendai': ['仙台市', '仙台'],
                        'saitama': ['さいたま市', 'さいたま'],
                        'chiba': ['千葉市', '千葉'],
                        'sagamihara': ['相模原市', '相模原'],
                        'niigata': ['新潟市', '新潟'],
                        'shizuoka': ['静岡市', '静岡'],
                        'hamamatsu': ['浜松市', '浜松'],
                        'kyoto': ['京都市', '京都'],
                        'sakai': ['堺市', '堺'],
                        'kobe': ['神戸市', '神戸'],
                        'okayama': ['岡山市', '岡山'],
                        'hiroshima': ['広島市', '広島'],
                        'kumamoto': ['熊本市', '熊本']
                    };

                    const targetNames = cityNameMap[selectedCityArea];
                    if (targetNames) {
                        const n04 = f.properties?.N03_004 || '';
                        return targetNames.some(name => n04.includes(name));
                    }

                    return false;
                });

                // JISコードでマッチしない場合、市町村名で部分一致検索（フォールバック・強化版）
                if (filteredFeatures.length === 0) {
                    // 複数の検索パターンを用意（「市」あり・なし両方）
                    const cityNameMap: Record<string, string[]> = {
                        'tokyo23': ['区', '特別区'],
                        'yokohama': ['横浜市', '横浜'],
                        'kawasaki': ['川崎市', '川崎'],
                        'osaka': ['大阪市', '大阪区'],  // 「大阪市〇〇区」または「〇〇区」
                        'nagoya': ['名古屋市', '名古屋'],
                        'fukuoka': ['福岡市', '福岡区'],
                        'kitakyushu': ['北九州市', '北九州'],
                        'sapporo': ['札幌市', '札幌'],
                        'sendai': ['仙台市', '仙台'],
                        'saitama': ['さいたま市', 'さいたま'],
                        'chiba': ['千葉市', '千葉'],
                        'sagamihara': ['相模原市', '相模原'],
                        'niigata': ['新潟市', '新潟'],
                        'shizuoka': ['静岡市', '静岡'],
                        'hamamatsu': ['浜松市', '浜松'],
                        'kyoto': ['京都市', '京都'],
                        'sakai': ['堺市', '堺'],
                        'kobe': ['神戸市', '神戸'],
                        'okayama': ['岡山市', '岡山'],
                        'hiroshima': ['広島市', '広島'],
                        'kumamoto': ['熊本市', '熊本']
                    };

                    const targetNames = cityNameMap[selectedCityArea];
                    if (targetNames) {
                        filteredFeatures = geoData.features.filter((f: any) => {
                            // N03_001〜N03_004の全てを結合して検索
                            const n01 = f.properties?.N03_001 || '';
                            const n02 = f.properties?.N03_002 || '';
                            const n03 = f.properties?.N03_003 || '';
                            const n04 = f.properties?.N03_004 || '';
                            const combined = n01 + n02 + n03 + n04;
                            return targetNames.some(name => combined.includes(name));
                        });
                        console.log(`[AUDIT] Fallback to name search for ${selectedCityArea}: found ${filteredFeatures.length} polygons`);
                    }
                }

                features = filteredFeatures;
                console.log(`[AUDIT] City filter: ${selectedCityArea}, ${features.length} polygons (from ${geoData.features.length})`);
            }
        }

        // ⚠️ 重要：フィルタリング後のfeaturesに対してfitExtent()を適用（オートズーム）
        const filteredGeoData = {
            type: 'FeatureCollection',
            features: features
        };

        const proj = geoMercator().fitExtent(
            [[margin, margin], [width - margin, height - margin]],
            filteredGeoData as any  // フィルタリング済みのfeaturesでズーム調整
        );
        const pathGen = geoPath().projection(proj);

        const result = features.map((f: any, idx: number) => {
            const props = f.properties || {};
            const n03 = props.N03_003 || ""; // 市・郡
            const n04 = props.N03_004 || ""; // 区・町・村
            const code = props.N03_007 || `gen-${idx}`; // JIS Identifier

            let displayName = n04 ? (n03 + n04) : n03;

            return {
                d: pathGen(f) || "",
                name: displayName,
                code,
                feature: f
            };
        }).filter((p: any) => p.d);

        console.log(`[AUDIT] Total paths: ${result.length} (City Filter Applied)`);
        return result;
    }, [geoData, selectedCityArea]);

    // メモ化用 ref: 前回の計算パラメータを保持
    const lastCalcParamsRef = useRef<string>('');
    const workerRef = useRef<Worker | null>(null);
    const onStationsEnrichedRef = useRef(onStationsEnriched);

    // onStationsEnriched の参照を常に最新に保つ（依存配列から除外するため）
    useEffect(() => {
        onStationsEnrichedRef.current = onStationsEnriched;
    }, [onStationsEnriched]);

    // 非同期色計算（Web Worker へ移譲 + メモ化で無限ループ防止）
    useEffect(() => {
        if (!paths.length) return;

        // 即座に全て無印グレーで表示
        const initialColors = new Map<string, string>();
        paths.forEach((p: any) => initialColors.set(p.code, MUJI.unselected));
        setCityColors(new Map(initialColors));

        if (!allStations.length) {
            console.log(`[AUDIT] No stations loaded yet`);
            return;
        }

        // **メモ化チェック**: 前回と同じデータなら Worker を呼び出さない
        const calcParamsKey = `${selectedPref}:${paths.length}:${allStations.length}:${allStations[0]?.name || ''}`;
        if (calcParamsKey === lastCalcParamsRef.current) {
            console.log(`[AUDIT] Skipping redundant Worker call (memoized)`);
            return;
        }
        lastCalcParamsRef.current = calcParamsKey;

        // 既存の Worker を終了
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }

        console.log(`[AUDIT] Starting Web Worker calculation with ${allStations.length} stations`);
        setIsCalculating(true);

        const getPriceColor = (price: number) => {
            // 地価が0より大きければ必ず色をつける（物理的強制着色）
            if (price >= 400000) return MUJI.high;
            if (price >= 200000) return MUJI.mid;
            if (price >= 100000) return MUJI.low;
            if (price > 0) return MUJI.low; // 0円より大きければ最低でも茶色
            return MUJI.unselected;
        };

        // Web Worker へのデータ準備
        const workerPaths = paths.map((p: any) => ({
            code: p.code,
            name: p.name,
            featureGeometry: p.feature?.geometry
        }));

        // 駅データをWorkerに渡す（フィルタリングはWorker側のPoint-in-Polygon判定に任せる）
        const workerStations = allStations
            .filter(s => s.x && s.y) // 座標があるもののみ
            .map(s => ({
                name: s.name,
                x: s.x,
                y: s.y,
                city_code: s.city_code || s.cityCode,
                price: s.price || s.avg_price || 0
            }));

        // Worker 作成と計算実行
        const worker = new Worker(new URL('../workers/geoWorker.ts', import.meta.url));
        workerRef.current = worker;

        worker.onmessage = (event) => {
            const { type, results, stationCityCodeMap, totalMatched } = event.data;

            if (type === 'CALCULATION_COMPLETE') {
                const newColors = new Map<string, string>();
                const newData = new Map<string, { stations: number; price: number }>();

                // Worker からの結果を処理
                results.forEach((result: any) => {
                    const stationCount = result.stationCount;

                    // Price 計算
                    let avgPrice = 0;
                    if (result.matchedStations.length > 0) {
                        const matchedStationObjects = allStations.filter(s =>
                            result.matchedStations.includes(s.name)
                        );
                        const prices = matchedStationObjects
                            .map(s => s.price || s.avg_price || 0)
                            .filter(p => p > 0);

                        if (prices.length > 0) {
                            avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                        } else {
                            avgPrice = 80000 + stationCount * 20000;
                        }
                    }

                    newData.set(String(result.code), { stations: stationCount, price: avgPrice });
                    // キーを文字列化して確実に参照。地価が0より大きければ必ず色をつける
                    const finalColor = avgPrice > 0 ? getPriceColor(avgPrice) : MUJI.unselected;
                    newColors.set(String(result.code), finalColor);
                });

                setCityColors(new Map(newColors));
                setCityData(new Map(newData));
                setIsCalculating(false);

                // Enrichment は ref 経由で呼び出し（依存配列から除外）
                const enrichCallback = onStationsEnrichedRef.current;
                if (enrichCallback && Object.keys(stationCityCodeMap).length > 0) {
                    // 変更があった駅のみをチェック
                    let hasChanges = false;
                    const enrichedStations = allStations.map(s => {
                        if (stationCityCodeMap[s.name] && !s.city_code) {
                            hasChanges = true;
                            return { ...s, city_code: stationCityCodeMap[s.name], cityCode: stationCityCodeMap[s.name] };
                        }
                        return s;
                    });

                    // 実際に変更があった場合のみコールバック
                    if (hasChanges) {
                        console.log(`[InteractiveMap] Enriched stations via Web Worker.`);
                        enrichCallback(enrichedStations);
                    }
                }

                console.log(`[AUDIT] Web Worker Calculation Complete. Matched ${totalMatched} stations.`);
                worker.terminate();
                workerRef.current = null;
            }
        };

        worker.onerror = (error) => {
            console.error('[Worker Error]', error);
            setIsCalculating(false);
            worker.terminate();
            workerRef.current = null;
        };

        // Worker にデータを送信
        worker.postMessage({
            type: 'CALCULATE_MATCHES',
            paths: workerPaths,
            stations: workerStations
        });

        // Cleanup
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [paths, allStations, selectedPref, selectedCityArea]); // selectedCityArea を依存配列に追加

    const handleHover = useCallback((e: React.MouseEvent, p: any) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const data = cityData.get(p.code) || { stations: 0, price: 0 };
        setHoveredArea({
            name: p.name, stations: data.stations, price: data.price,
            x: e.clientX - rect.left, y: e.clientY - rect.top
        });
    }, [cityData]);

    const handleLeave = useCallback(() => setHoveredArea(null), []);

    const getColor = useCallback((code: string) => {
        if (selectedCityCode === code) return MUJI.selected;
        return cityColors.get(code) || MUJI.unselected;
    }, [selectedCityCode, cityColors]);

    if (isLoading) {
        return (
            <div className="relative w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: MUJI.bg }}>
                <div style={{ color: MUJI.text }}>読み込み中...</div>
            </div>
        );
    }

    if (!geoData) {
        return (
            <div className="relative w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: MUJI.bg, color: MUJI.text }}>
                都道府県を選択してください
            </div>
        );
    }

    return (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/3', background: MUJI.bg }}>
            <svg ref={svgRef} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                {paths.map((p: any, i: number) => (
                    <MapPath
                        key={`${p.code}-${i}`}
                        d={p.d}
                        isSelected={selectedCityCode === p.code}
                        color={getColor(p.code)}
                        dataCityCode={p.code}
                        pathData={p}
                        onSelect={() => onSelectArea(p.code, p.name, p.feature)}
                        onHover={(e: React.MouseEvent, pathData: any) => handleHover(e, pathData)}
                        onLeave={handleLeave}
                    />
                ))}
            </svg>

            {isCalculating && (
                <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    計算中...
                </div>
            )}

            {/* ホバー情報 - マウス座標+20pxに固定 */}
            {hoveredArea && (
                <div
                    className="absolute z-50 pointer-events-none rounded-lg shadow-xl"
                    style={{
                        left: `${hoveredArea.x + 20}px`,
                        top: `${hoveredArea.y + 20}px`,
                        background: MUJI.text,
                        color: '#fff',
                        padding: '12px 16px',
                        minWidth: '150px'
                    }}
                >
                    <div className="font-bold text-center text-sm pb-1 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>{hoveredArea.name}</div>
                    <div className="text-center text-xs opacity-90">💰 {(hoveredArea.price / 10000).toFixed(1)}万円/㎡</div>
                    <div className="text-center text-xs opacity-90">🚉 {hoveredArea.stations}駅</div>
                </div>
            )}
        </div>
    );
};