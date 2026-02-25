"use client";
import DiagnosisResult from "./DiagnosisResult";

type DiagnoseResponse = {
    verdict: string;
    headline: string;
    reasons: { label: string; value: string }[];
    rules: { label: string; value: string }[];
    note: string;
    debug: { stationName: string; score: number; dataYear?: number };
    trendData?: { year: number; price: number; txCount?: number }[];
    marketPrice: number;
    yoy?: number;
    tx5y?: number;
    trend?: "UP" | "DOWN" | "FLAT";
    dataYear?: string | number;
    extendedMetrics?: {
        futurePopulationRate: number;
        hazardRisk: {
            flood: { level: number; description: string };
            landslide: { level: number; description: string };
        };
    };
};

type Props = {
    result1: DiagnoseResponse;
    result2: DiagnoseResponse;
};

export default function ComparisonView({ result1, result2 }: Props) {
    const s1Name = result1.debug.stationName;
    const s2Name = result2.debug.stationName;
    const s1Score = result1.debug.score;
    const s2Score = result2.debug.score;

    // Determine comparative status
    let summary = "";
    let winner: "s1" | "s2" | "tie" = "tie";

    if (s1Score === s2Score) {
        summary = "両駅のリスクスコアは同等です。";
        winner = "tie";
    } else if (s1Score < s2Score) {
        summary = `「${s1Name}」の方がリスクスコアが低く、比較的安定しています。`;
        winner = "s1";
    } else {
        summary = `「${s2Name}」の方がリスクスコアが低く、比較的安定しています。`;
        winner = "s2";
    }

    const renderCell = (label: string, val1: React.ReactNode, val2: React.ReactNode, highlight: "s1" | "s2" | "tie" | "none" = "none") => (
        <div className="grid grid-cols-3 gap-4 border-b border-[hsl(var(--border-color))] py-3 items-center last:border-0 hover:bg-[hsl(var(--bg-secondary))] transition-colors">
            <div className={`text-center font-bold ${highlight === "s1" ? "text-[hsl(var(--status-safe))]" : ""}`}>{val1}</div>
            <div className="text-center text-xs text-muted font-bold uppercase tracking-wider">{label}</div>
            <div className={`text-center font-bold ${highlight === "s2" ? "text-[hsl(var(--status-safe))]" : ""}`}>{val2}</div>
        </div>
    );

    return (
        <div className="flex flex-col gap-10">
            {/* Summary Section */}
            <div className="card border-[hsl(var(--accent-primary))] shadow-[0_0_20px_hsl(var(--accent-primary)/0.1)] text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[hsl(var(--accent-primary))] to-transparent"></div>
                <h3 className="text-[hsl(var(--accent-primary))] font-black tracking-widest uppercase mb-2">Comparison Analysis</h3>
                <p className="font-bold text-xl mb-6">{summary}</p>

                {/* Comparison Table */}
                <div className="w-full max-w-2xl mx-auto bg-[hsl(var(--bg-primary))] rounded-xl border border-[hsl(var(--border-color))] p-4">
                    {/* Header */}
                    <div className="grid grid-cols-3 gap-4 mb-4 pb-2 border-b border-[hsl(var(--border-color))]">
                        <div className="font-bold text-lg">{s1Name}</div>
                        <div className="text-xs text-muted uppercase self-center">VS</div>
                        <div className="font-bold text-lg">{s2Name}</div>
                    </div>

                    {/* Rows */}
                    {renderCell("総合判定",
                        <span className={`px-2 py-1 rounded text-xs font-black ${result1.verdict === 'safe' ? 'bg-[hsl(var(--status-safe))/0.2] text-[hsl(var(--status-safe))]' : 'text-muted'}`}>{result1.verdict.toUpperCase()}</span>,
                        <span className={`px-2 py-1 rounded text-xs font-black ${result2.verdict === 'safe' ? 'bg-[hsl(var(--status-safe))/0.2] text-[hsl(var(--status-safe))]' : 'text-muted'}`}>{result2.verdict.toUpperCase()}</span>,
                        winner as "s1" | "s2" | "tie" | "none"
                    )}
                    {renderCell("将来人口 (2050推計)",
                        `${result1.extendedMetrics?.futurePopulationRate ?? '--'}`,
                        `${result2.extendedMetrics?.futurePopulationRate ?? '--'}`,
                        (result1.extendedMetrics?.futurePopulationRate ?? 0) > (result2.extendedMetrics?.futurePopulationRate ?? 0) ? "s1" : "s2"
                    )}
                    {renderCell("水害リスク",
                        <span className={{ 0: "text-[hsl(var(--status-safe))]", 1: "text-[hsl(var(--status-caution))]", 2: "text-[hsl(var(--status-risky))]", 3: "text-[hsl(var(--status-risky))]" }[result1.extendedMetrics?.hazardRisk.flood.level ?? 0]}>
                            Lv.{result1.extendedMetrics?.hazardRisk.flood.level}
                        </span>,
                        <span className={{ 0: "text-[hsl(var(--status-safe))]", 1: "text-[hsl(var(--status-caution))]", 2: "text-[hsl(var(--status-risky))]", 3: "text-[hsl(var(--status-risky))]" }[result2.extendedMetrics?.hazardRisk.flood.level ?? 0]}>
                            Lv.{result2.extendedMetrics?.hazardRisk.flood.level}
                        </span>,
                        (result1.extendedMetrics?.hazardRisk.flood.level ?? 99) < (result2.extendedMetrics?.hazardRisk.flood.level ?? 99) ? "s1" : "s2"
                    )}
                </div>
            </div>

            {/* Detailed Views */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="hidden md:flex absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-[hsl(var(--bg-primary))] border-4 border-[hsl(var(--bg-card))] rounded-full items-center justify-center font-black text-muted shadow-lg">
                    VS
                </div>
                <div>
                    <DiagnosisResult data={result1} />
                </div>
                <div>
                    <DiagnosisResult data={result2} />
                </div>
            </div>
        </div>
    );
}
