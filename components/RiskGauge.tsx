import React from 'react';

interface RiskGaugeProps {
    score: number;
    rank: string;
    rankColor: string;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score, rank, rankColor }) => {
    const getRankBgColor = (rank: string): string => {
        switch (rank) {
            case "S": return "#C5A059";
            case "A": return "#889E81";
            case "B": return "#9B9B7A";
            case "C": return "#A7907F";
            default: return "#9A8A7C";
        }
    };

    return (
        <div className="w-full bg-transparent mt-[-10px] mb-2">
            {/* 総合スコアタイトル */}
            <h3 className="text-sm !font-serif font-medium text-slate-500 tracking-widest mb-2" style={{ fontFamily: 'var(--font-title), serif' }}>
                総合スコア
            </h3>

            <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-2 md:gap-3">
                    <span className="text-7xl md:text-9xl !font-serif font-normal text-slate-800" style={{ fontFamily: 'var(--font-title), serif', fontFeatureSettings: '"pnum" 0, "lnum" 1', fontVariantNumeric: 'lining-nums', verticalAlign: 'baseline' }}>
                        {Math.round(score)}
                    </span>
                    <span className="text-xl md:text-2xl !font-serif font-extralight text-slate-300 tracking-wide" style={{ fontFamily: 'var(--font-title), serif' }}>
                        / 100
                    </span>
                </div>

                <div
                    className="px-4 py-2 md:px-8 md:py-4 rounded-lg flex items-baseline justify-center shadow-lg backdrop-blur-md mb-4"
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        border: `0.5px solid ${getRankBgColor(rank)}`,
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)'
                    }}
                >
                    <span
                        className="text-xs md:text-sm tracking-[0.2em] !font-serif mr-2 md:mr-3 font-medium"
                        style={{
                            color: getRankBgColor(rank),
                            fontFamily: 'var(--font-title), serif'
                        }}
                    >
                        RANK
                    </span>
                    <span
                        className="text-4xl md:text-5xl font-bold !font-serif"
                        style={{
                            color: getRankBgColor(rank),
                            fontFamily: 'var(--font-title), serif',
                            lineHeight: '1'
                        }}
                    >
                        {rank}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default RiskGauge;
