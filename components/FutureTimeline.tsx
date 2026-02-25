"use client";
import { useState, useEffect, useRef } from "react";

type TimelineData = {
    year: number;
    price?: number;
    type?: "actual" | "forecast";
};

type FutureTimelineProps = {
    historicalData?: TimelineData[];
    futureData?: TimelineData[];
};

export default function FutureTimeline({
    historicalData = [],
    futureData = []
}: FutureTimelineProps) {
    const [hoverData, setHoverData] = useState<TimelineData | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // デフォルトデータ
    const defaultData: TimelineData[] = [
        { year: 2020, price: 4500, type: "actual" },
        { year: 2021, price: 4600, type: "actual" },
        { year: 2022, price: 4700, type: "actual" },
        { year: 2023, price: 4800, type: "actual" },
        { year: 2024, price: 4900, type: "actual" },
    ];

    const allData = [...historicalData, ...futureData];
    // データ正規化ロジック (単位変換: 円 -> 万円)
    const normalizedRawData = allData.length > 0 ? allData : defaultData;
    const data = normalizedRawData.map(d => ({
        ...d,
        price: (d.price && d.price >= 1000000) ? d.price / 10000 : d.price
    }));

    data.sort((a, b) => a.year - b.year);

    // 動的に実績の最終年を取得
    const actualData = data.filter(d => d.type === "actual");
    const latestActualYear = actualData.length > 0
        ? Math.max(...actualData.map(d => d.year))
        : data.length > 0 ? data[Math.floor(data.length / 2)].year : 2025;

    // IntersectionObserver で可視状態を検知
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.3 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, []);

    // SVGのサイズ - Padding increased for Y-axis labels
    const width = 600;
    const height = 280;
    const padding = { top: 30, right: 50, bottom: 40, left: 65 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // データの範囲を取得
    const years = data.map(d => d.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    const prices = data.map(d => d.price || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Nice Scale Logic for Y-axis
    const calculateNiceDomain = (min: number, max: number) => {
        // ユーザー要望: 少なくとも500万円の余裕を持たせる
        const paddedMin = Math.max(0, min - 500);
        const paddedMax = max + 500;

        const range = paddedMax - paddedMin || 100;
        // Target rough number of ticks: 4-5
        const roughStep = range / 4;

        // Possible nice steps: 100, 200, 500, 1000, 2000, 5000, 10000...
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalizedStep = roughStep / magnitude;

        let niceStep;
        if (normalizedStep < 1.5) niceStep = 1;
        else if (normalizedStep < 3) niceStep = 2; // 200, 2000
        else if (normalizedStep < 7) niceStep = 5; // 500, 5000
        else niceStep = 10;

        const step = niceStep * magnitude;

        // Round min/max to include strict steps
        const niceMin = Math.floor(paddedMin / step) * step;
        const niceMax = Math.ceil(paddedMax / step) * step;

        // Ensure at least 4 ticks
        if ((niceMax - niceMin) / step < 3) {
            return { min: niceMin, max: niceMax + step, step };
        }

        return { min: niceMin, max: niceMax, step };
    };

    const { min: domainMinPrice, max: domainMaxPrice, step: tickStep } = calculateNiceDomain(minPrice, maxPrice);

    // スケール関数
    const xScale = (year: number) => {
        return padding.left + ((year - minYear) / (maxYear - minYear)) * chartWidth;
    };

    const yScalePrice = (price: number) => {
        return padding.top + chartHeight - ((price - domainMinPrice) / (domainMaxPrice - domainMinPrice)) * chartHeight;
    };

    // ライン生成関数
    const generatePath = (dataset: TimelineData[], getValue: (d: TimelineData) => number, yScale: (v: number) => number) => {
        return dataset.map((d, i) => {
            const x = xScale(d.year);
            const y = yScale(getValue(d));
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');
    };

    // データ分割
    const pastData = data.filter(d => d.year <= latestActualYear);

    // パス生成
    const pricePathSolid = generatePath(pastData, d => d.price || 0, yScalePrice);

    // Y軸目盛り生成
    const priceTicks = [];
    for (let v = domainMinPrice; v <= domainMaxPrice; v += tickStep) {
        priceTicks.push(v);
    }

    // グリッドライン（Y値に対応）
    const gridLines = priceTicks.map(val => yScalePrice(val));

    // ホバー処理
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const x = svgP.x;
        const yearRatio = (x - padding.left) / chartWidth;
        const yearApprox = minYear + yearRatio * (maxYear - minYear);

        let closest = data[0];
        let minDiff = Math.abs(data[0].year - yearApprox);

        for (const d of data) {
            const diff = Math.abs(d.year - yearApprox);
            if (diff < minDiff) {
                minDiff = diff;
                closest = d;
            }
        }

        if (x < padding.left || x > width - padding.right || svgP.y < padding.top || svgP.y > height - padding.bottom) {
            setTooltipVisible(false);
            return;
        }

        setHoverData(closest);
        setHoverPos({ x: xScale(closest.year), y: yScalePrice(closest.price || 0) });
        setTooltipVisible(true);
    };

    const handleMouseLeave = () => {
        setTooltipVisible(false);
    };

    // ツールチップの位置調整
    const getTooltipStyle = () => {
        if (!hoverPos) return {};
        const posPercent = (hoverPos.x / width) * 100;
        const isRightSide = posPercent > 70;

        return {
            left: isRightSide ? 'auto' : `${posPercent}%`,
            right: isRightSide ? `${100 - posPercent}%` : 'auto',
            transform: isRightSide ? 'translate(0, 0)' : 'translate(-50%, 0)',
        };
    };

    const MAIN_COLOR = "#4A4A4A";

    return (
        <div ref={ref} className="w-full relative">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto block"
                preserveAspectRatio="xMidYMid meet"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* グリッド (破線を薄く) */}
                {gridLines.map((y, i) => (
                    <line
                        key={i}
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#E0E0E0"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* X軸 */}
                <line
                    x1={padding.left}
                    y1={height - padding.bottom}
                    x2={width - padding.right}
                    y2={height - padding.bottom}
                    stroke={MAIN_COLOR}
                    strokeWidth="1"
                />

                {/* Y軸（左 - Price） */}
                <line
                    x1={padding.left}
                    y1={padding.top}
                    x2={padding.left}
                    y2={height - padding.bottom}
                    stroke={MAIN_COLOR}
                    strokeWidth="1"
                />

                {/* 左Y軸目盛り (Price) */}
                {priceTicks.map((tick, i) => (
                    <text
                        key={i}
                        x={padding.left - 8}
                        y={yScalePrice(tick) + 4}
                        textAnchor="end"
                        fill={MAIN_COLOR}
                        fontSize="9"
                        fontWeight="normal"
                        fontFamily="Noto Sans JP, sans-serif"
                    >
                        {tick.toLocaleString()}万円
                    </text>
                ))}

                {/* 実績ライン（地価） */}
                <path
                    d={pricePathSolid}
                    fill="none"
                    stroke={MAIN_COLOR}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isVisible ? "animate-draw" : ""}
                    style={{ strokeDasharray: 1000, strokeDashoffset: isVisible ? 0 : 1000 }}
                />

                {/* データポイント */}
                {data.map((d, i) => {
                    const priceY = yScalePrice(d.price || 0);
                    const priceLabelY = priceY - 12;
                    const priceLabelX = xScale(d.year);

                    return (
                        <g key={i} style={{ opacity: isVisible ? 1 : 0, transition: `opacity 0.5s ease-out ${0.5 + i * 0.1}s` }}>
                            <circle
                                cx={xScale(d.year)}
                                cy={priceY}
                                r="4"
                                fill="white"
                                stroke={MAIN_COLOR}
                                strokeWidth="2"
                            />
                            {/* 地価ラベル (オプション: すべての点にラベル表示すると混雑するかもだが、5点ならOK) */}
                            <rect
                                x={priceLabelX - 24}
                                y={priceLabelY - 9}
                                width="48"
                                height="14"
                                rx="2"
                                fill="white"
                                opacity="0.9"
                            />
                            <text
                                x={priceLabelX}
                                y={priceLabelY}
                                textAnchor="middle"
                                fill={MAIN_COLOR}
                                fontSize="8"
                                fontWeight="bold"
                                fontFamily="Noto Sans JP, sans-serif"
                            >
                                {d.price?.toLocaleString()}万円
                            </text>
                        </g>
                    );
                })}

                {/* X軸ラベル */}
                {data.map((d) => (
                    <text
                        key={d.year}
                        x={xScale(d.year)}
                        y={height - padding.bottom + 16}
                        textAnchor="middle"
                        fill={MAIN_COLOR}
                        fontWeight="bold"
                        fontSize="9"
                        fontFamily="Noto Sans JP, sans-serif"
                    >
                        {d.year}
                    </text>
                ))}

                {/* インタラクション用透明レイヤー */}
                <rect
                    x={padding.left}
                    y={padding.top}
                    width={chartWidth}
                    height={chartHeight}
                    fill="transparent"
                />
            </svg>

            {/* ツールチップ (Fade-in) */}
            <div
                className="absolute bg-white/95 backdrop-blur pointer-events-none p-3 rounded-lg shadow-xl border border-gray-200 z-10 text-xs"
                style={{
                    top: '15%',
                    opacity: tooltipVisible && hoverData ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    visibility: hoverData ? 'visible' : 'hidden',
                    ...getTooltipStyle()
                }}
            >
                {hoverData && (
                    <>
                        <div className="font-bold border-b border-gray-300 pb-1 mb-1 text-center font-sans">
                            {hoverData.year}年
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MAIN_COLOR }}></div>
                                <span className="text-gray-600 font-sans">地価</span>
                            </div>
                            <div className="font-bold text-right font-sans">{hoverData.price?.toLocaleString()}万円</div>
                        </div>
                    </>
                )}
            </div>
            <style jsx>{`
                .animate-draw {
                    transition: stroke-dashoffset 2s ease-out;
                }
            `}</style>
        </div>
    );
}
