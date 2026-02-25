"use client";
import { useEffect, useState, useRef } from "react";

type CityRadarProps = {
    assetScore?: number;       // 資産性 (0-100)
    safetyScore?: number;      // 安全性 (0-100)
    futureScore?: number;      // 将来性 (0-100)
    liquidityScore?: number;   // 流動性 (0-100)
    convenienceScore?: number; // 利便性 (0-100)
};

// スコアから評価ランクを取得
function getRank(score: number): string {
    if (score >= 80) return "S";
    if (score >= 60) return "A";
    if (score >= 40) return "B";
    if (score >= 20) return "C";
    return "D";
}

// ランクの色を取得
function getRankColor(rank: string): string {
    switch (rank) {
        case "S": return "#C5A059"; // Premium Gold
        case "A": return "#889E81"; // Sage Green
        case "B": return "#9B9B7A"; // Muted Olive
        case "C": return "#A7907F"; // Warm Taupe
        default: return "#9A8A7C";  // Stone Gray
    }
}

export default function CityRadar({
    assetScore = 50,
    safetyScore = 50,
    futureScore = 50,
    liquidityScore = 50,
    convenienceScore = 50
}: CityRadarProps) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const scores = [assetScore, safetyScore, futureScore, liquidityScore, convenienceScore];
    const labels = ['資産性', '安全性', '将来性', '流動性', '利便性'];

    // SVGのサイズ - 300px standard
    const size = 300;
    const center = size / 2;
    // Maximize radius for "object-contain" feel within the 320px container
    // 320px height container, 5 items.
    const maxRadius = 90; // Increased from 65 to 90 to fill the space

    // ランク判定 & カラー定義 (Updated palette with S-rank special styling)
    // ランク判定 (Color logic moved to getRankColor helper)
    // const getRankInfo = ... REMOVED: Unused legacy palette

    // IntersectionObserver
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsVisible(true);
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    // 5角形の頂点を計算
    const getPoint = (index: number, score: number) => {
        const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
        const radius = (score / 100) * maxRadius;
        return {
            x: center + Math.cos(angle) * radius,
            y: center + Math.sin(angle) * radius
        };
    };

    // 背景の同心円用の5角形
    const getPolygonPoints = (radiusPercent: number) => {
        return Array.from({ length: 5 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const radius = maxRadius * radiusPercent;
            return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
        }).join(' ');
    };

    const dataPoints = scores.map((score, i) => getPoint(i, score));
    const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';

    // ラベルの位置
    const getLabelPoint = (index: number) => {
        const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
        const radius = maxRadius + 25; // Adjusted for visual balance
        return {
            x: center + Math.cos(angle) * radius,
            y: center + Math.sin(angle) * radius
        };
    };

    return (
        <div ref={ref} className="w-full h-[320px] flex items-center justify-center">
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full h-full p-2"
                style={{ maxHeight: '320px', maxWidth: '320px' }}
            >
                {/* 背景の同心円 */}
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((percent, i) => (
                    <polygon
                        key={i}
                        points={getPolygonPoints(percent)}
                        fill="none"
                        stroke="#E6E1D6"
                        strokeWidth="1"
                    />
                ))}
                {/* 軸線 */}
                {Array.from({ length: 5 }, (_, i) => {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const endX = center + Math.cos(angle) * maxRadius;
                    const endY = center + Math.sin(angle) * maxRadius;
                    return <line key={i} x1={center} y1={center} x2={endX} y2={endY} stroke="#E6E1D6" strokeWidth="1" />;
                })}

                {/* データエリア (Monochrome) */}
                <g style={{ transformOrigin: `${center}px ${center}px`, transform: isVisible ? 'scale(1)' : 'scale(0)', transition: 'transform 0.8s ease-out' }}>
                    <path d={dataPath} fill="#4A544C" fillOpacity="0.6" stroke="#111827" strokeWidth="2" strokeLinejoin="round" />
                    {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#111827" />)}
                </g>

                {/* ラベル */}
                {labels.map((label, i) => {
                    const pos = getLabelPoint(i);
                    return (
                        <text
                            key={i}
                            x={pos.x}
                            y={pos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#4A4A4A"
                            fontSize="12"
                            fontWeight="600"
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}
