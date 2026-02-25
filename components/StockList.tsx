// components/StockList.tsx
import { useState } from "react";

type DiagnosisData = {
    verdict: string;
    headline: string;
    debug: { stationName: string; score: number };
};

type Props = {
    stocks: DiagnosisData[];
    onRemove: (index: number) => void;
    onCompare: (indices: number[]) => void;
};

export default function StockList({ stocks, onRemove, onCompare }: Props) {
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    const toggleSelection = (index: number) => {
        setSelectedIndices(prev => {
            if (prev.includes(index)) return prev.filter(i => i !== index);
            if (prev.length < 2) return [...prev, index];
            return [prev[1], index]; // shift, keep max 2
        });
    };

    if (stocks.length === 0) return null;

    return (
        <section className="mb-12 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                    <span className="text-yellow-500">★</span>
                    Stocked Results ({stocks.length})
                </h3>
                {selectedIndices.length === 2 && (
                    <button
                        onClick={() => onCompare(selectedIndices)}
                        className="bg-[hsl(var(--accent-primary))] hover:opacity-90 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-[0_0_15px_hsl(var(--accent-primary)/0.4)]"
                    >
                        COMPARE 2 STATIONS ▶
                    </button>
                )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                {stocks.map((item, idx) => {
                    const isSelected = selectedIndices.includes(idx);
                    const verdictColor =
                        item.verdict === "safe" ? "hsl(var(--status-safe))" :
                            item.verdict === "caution" ? "hsl(var(--status-caution))" :
                                "hsl(var(--status-risky))";

                    return (
                        <div
                            key={idx}
                            className={`
                                relative flex-shrink-0 w-[240px] snap-start rounded-xl border p-4 cursor-pointer transition-all
                                ${isSelected ? 'border-[hsl(var(--accent-primary))] bg-[hsl(var(--bg-secondary))] shadow-[0_0_10px_hsl(var(--accent-primary)/0.2)]' : 'border-[hsl(var(--border-color))] bg-[hsl(var(--bg-card))] hover:border-[hsl(var(--text-secondary))]'}
                            `}
                            onClick={() => toggleSelection(idx)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-lg">{item.debug.stationName}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                                    className="text-muted hover:text-red-400 p-1"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="text-xs font-bold px-2 py-0.5 rounded inline-block mb-2" style={{ backgroundColor: `${verdictColor}20`, color: verdictColor }}>
                                {item.verdict.toUpperCase()}
                            </div>

                            <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                                {item.headline}
                            </p>

                            {isSelected && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-[hsl(var(--accent-primary))] text-white rounded-full flex items-center justify-center text-xs border-2 border-[hsl(var(--bg-primary))]">
                                    ✓
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
