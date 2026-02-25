"use client";

type PyramidData = {
    ageGroup: string;
    population: number; // percentage
};

type PopulationPyramidProps = {
    data2020: PyramidData[];
    data2050: PyramidData[];
    baseYear?: number;
    targetYear?: number;
};

export default function PopulationPyramid({ data2020, data2050, baseYear = 2020, targetYear = 2050 }: PopulationPyramidProps) {
    // Match FutureTimeline dimensions
    const width = 600;
    const height = 280;
    const padding = { top: 30, right: 50, bottom: 40, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 最大値を取得してドメインを動的計算（監査ログ検証②推奨ロジック）
    const rawMax = Math.max(
        ...data2020.map(d => d.population),
        ...data2050.map(d => d.population)
    );

    // Nice Number Rounding Algorithm
    const calculateNiceDomain = (maxVal: number) => {
        const steps = [1, 2, 5, 10, 20, 25, 50, 100];
        const targetStep = maxVal / 4; // 理想は4-5分割
        // targetStep以上の最小のstepを見つける
        const step = steps.find(s => s >= targetStep) || 20;
        // MaxValを超える最小の「stepの倍数」を計算
        const domainMax = Math.ceil(maxVal / step) * step;

        // 少なくとも20%は確保 (データが小さすぎる場合の視認性確保)
        return { max: Math.max(20, domainMax), step: Math.max(5, step) };
    };

    const { max: domainMax, step: tickStep } = calculateNiceDomain(rawMax);

    // バーの高さを計算
    const barHeight = chartHeight / data2020.length;

    // Ticks生成
    const ticks = [];
    for (let v = 0; v <= domainMax; v += tickStep) {
        ticks.push(v);
    }

    return (
        <div className="w-full">
            {/* 見出し */}


            {/* グラフ */}
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block" preserveAspectRatio="xMidYMid meet">
                {/* グリッド線 (Dynamic Ticks based on Nice Step) */}
                {ticks.map((tickValue) => {
                    const ratio = tickValue / domainMax;
                    const x = padding.left + ratio * chartWidth;
                    return (
                        <g key={tickValue}>
                            <line
                                x1={x}
                                y1={padding.top}
                                x2={x}
                                y2={height - padding.bottom}
                                stroke="#E6E1D6"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                            />
                            <text
                                x={x}
                                y={height - padding.bottom + 16}
                                textAnchor="middle"
                                fill="#999"
                                fontSize="9"
                            >
                                {tickValue}%
                            </text>
                        </g>
                    );
                })}

                {/* Y軸 */}
                <line
                    x1={padding.left}
                    y1={padding.top}
                    x2={padding.left}
                    y2={height - padding.bottom}
                    stroke="#4A4A4A"
                    strokeWidth="1"
                />

                {/* バー描画 */}
                {data2020.map((d, i) => {
                    const y = padding.top + i * barHeight;
                    // Scale based on domainMax
                    const barWidth2020 = (d.population / domainMax) * chartWidth;
                    const barWidth2050 = (data2050[i].population / domainMax) * chartWidth;

                    return (
                        <g key={i}>
                            {/* 2020年実績（塗りつぶし） */}
                            <rect
                                x={padding.left}
                                y={y + barHeight * 0.15}
                                width={barWidth2020}
                                height={barHeight * 0.3}
                                fill="#889E81"
                                opacity="0.8"
                            />

                            {/* 2050年予測（アウトライン） */}
                            <rect
                                x={padding.left}
                                y={y + barHeight * 0.55}
                                width={barWidth2050}
                                height={barHeight * 0.3}
                                fill="transparent"
                                stroke="#889E81"
                                strokeWidth="2"
                            />

                            {/* 年齢層ラベル */}
                            <text
                                x={padding.left - 5}
                                y={y + barHeight / 2}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fill="#4A4A4A"
                                fontSize="9"
                                fontWeight="bold"
                            >
                                {d.ageGroup}
                            </text>

                            {/* 2020年の値ラベル */}
                            <text
                                x={padding.left + barWidth2020 + 3}
                                y={y + barHeight * 0.3}
                                textAnchor="start"
                                dominantBaseline="middle"
                                fill="#4A4A4A"
                                fontSize="8"
                            >
                                {d.population.toFixed(1)}%
                            </text>

                            {/* 2050年の値ラベル */}
                            <text
                                x={padding.left + barWidth2050 + 3}
                                y={y + barHeight * 0.7}
                                textAnchor="start"
                                dominantBaseline="middle"
                                fill="#708271"
                                fontSize="7"
                            >
                                {data2050[i].population.toFixed(1)}%
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* 凡例 */}
            <div className="flex justify-center gap-6 mt-4 text-[10px]">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-2 bg-[#889E81] opacity-80"></div>
                    <span className="text-gray-600">{baseYear}年実績</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-2 border-2 border-[#889E81]"></div>
                    <span className="text-gray-600">{targetYear}年予測</span>
                </div>
            </div>

            {/* データソース */}

        </div>
    );
}
