"use client";

import { useState, useRef } from "react";
import ComparisonView from "./ComparisonView";
import SearchForm from "./SearchForm";
import DiagnosisResult from "./DiagnosisResult";
import StockList from "./StockList";

// Module level cache so it persists even if HomeClient unmounts momentarily
const diagnosisCache = new Map<string, Promise<any>>();


type DiagnoseResponse = {
    verdict: string;
    headline: string;
    reasons: { label: string; value: string }[];
    rules: { label: string; value: string }[];
    note: string;
    error?: string;
    debug: { stationName: string; score: number; dataYear?: number };
    trendData?: { year: number; price: number; txCount?: number }[];
    marketPrice: number;
    yoy?: number;
    tx5y?: number;
    trend?: "UP" | "DOWN" | "FLAT";
    dataYear?: string | number;
    metadata?: {
        sources: {
            realEstate: { name: string; year: number };
            population: { name: string; version: string; baseYear: number; targetYear: number };
            algorithm: { name: string; year: number };
            hazard?: { name: string; year: number };
            redevelopment?: { name: string; version: string };
        }
    };
    extendedMetrics?: {
        futurePopulationRate: number;
        hazardRisk: {
            flood: { level: number; description: string };
            landslide: { level: number; description: string };
        };
    };
    redevelopmentProjects?: any[];
};

type Props = {};

export default function HomeClient({ }: Props) {
    const [loading, setLoading] = useState(false);
    const [currentResult, setCurrentResult] = useState<DiagnoseResponse | null>(null);
    const [stockedResults, setStockedResults] = useState<DiagnoseResponse[]>([]);
    const [comparisonTarget, setComparisonTarget] = useState<[DiagnoseResponse, DiagnoseResponse] | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [externalLineSearch, setExternalLineSearch] = useState<{ line: string; ts: number } | null>(null);

    // 診断結果へのref
    const resultRef = useRef<HTMLDivElement>(null);

    // Prefetch logic
    const handlePrefetch = (stationName: string, prefCode: string) => {
        const cacheKey = `${stationName}_${prefCode}`;
        if (!diagnosisCache.has(cacheKey)) {
            const year: number | null = null;
            const promise = fetch("/api/diagnose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stationName, prefCode, year }),
            }).then(r => r.json());
            diagnosisCache.set(cacheKey, promise);
        }
    };

    async function handleSearch(station1: string, pref1: string, station2?: string, pref2?: string) {
        setLoading(true);
        setErr(null);
        setComparisonTarget(null); // Reset comparison view
        setCurrentResult(null);

        // We do not pass year, letting backend default to latest (2024)
        const year: number | null = null;

        try {
            // Fetch 1
            const cacheKey1 = `${station1}_${pref1}`;
            let p1: Promise<any>;

            if (diagnosisCache.has(cacheKey1)) {
                p1 = diagnosisCache.get(cacheKey1)!;
            } else {
                p1 = fetch("/api/diagnose", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stationName: station1, prefCode: pref1, year }),
                }).then(r => r.json());
                diagnosisCache.set(cacheKey1, p1);
            }

            const d1 = await p1;
            if (d1 && d1.error) {
                diagnosisCache.delete(cacheKey1); // Clear failed cache
                throw new Error(d1.error);
            }
            setCurrentResult(d1 as DiagnoseResponse);

            // Handle legacy 2-station search if user uses older form mode (though we might deprecate it for stock-compare)
            if (station2 && pref2) {
                const cacheKey2 = `${station2}_${pref2}`;
                let p2: Promise<any>;

                if (diagnosisCache.has(cacheKey2)) {
                    p2 = diagnosisCache.get(cacheKey2)!;
                } else {
                    p2 = fetch("/api/diagnose", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ stationName: station2, prefCode: pref2, year }),
                    }).then(r => r.json());
                    diagnosisCache.set(cacheKey2, p2);
                }
                const d2 = await p2;
                if (d2 && d2.error) {
                    diagnosisCache.delete(cacheKey2);
                    throw new Error(d2.error);
                }
                setComparisonTarget([d1, d2]);
            }

        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    // Stock Logic
    const toggleStock = (result: DiagnoseResponse) => {
        setStockedResults(prev => {
            const exists = prev.find(r => r.debug.stationName === result.debug.stationName);
            if (exists) return prev.filter(r => r.debug.stationName !== result.debug.stationName);
            return [...prev, result];
        });
    };

    const removeStock = (index: number) => {
        setStockedResults(prev => prev.filter((_, i) => i !== index));
    };

    const handleCompareStock = (indices: number[]) => {
        if (indices.length !== 2) return;
        setComparisonTarget([stockedResults[indices[0]], stockedResults[indices[1]]]);
        setCurrentResult(null); // Hide single result to focus on comparison
    };

    return (
        <main className="min-h-screen w-full flex flex-col items-center pt-20 px-6 bg-[var(--bg-primary)]">
            {/* Hero Header */}
            {/* Hero Header */}
            {/* Hero Header */}
            {/* Hero Header */}
            <header className="w-full max-w-4xl text-center mb-16">
                <div className="inline-block mb-6 px-6 py-2 rounded-full bg-[var(--brand-main)]/10 text-[var(--brand-main)] text-sm font-bold tracking-widest border border-[var(--brand-main)]/20">
                    失敗しない街選び診断
                </div>
                <h1 className="hero-title text-4xl md:text-6xl font-medium tracking-widest my-[60px] text-[var(--brand-main)]">
                    あの街の成績表
                </h1>
                <p className="text-base text-[var(--text-primary)] tracking-widest leading-loose font-normal max-w-3xl mx-auto opacity-80">
                    地価・治安・利便性を多角的にスコア化。<br className="hidden md:block" />
                    初めての住宅購入で失敗しないための街選び診断サイト
                </p>
            </header>

            {/* Search Section */}
            <section className="w-full max-w-2xl bg-white/50 p-6 md:p-10 rounded-xl shadow-sm mb-20">
                <SearchForm
                    loading={loading}
                    onSearch={handleSearch}
                    onPrefetch={handlePrefetch}
                    resultRef={resultRef}
                    externalLineSearch={externalLineSearch}
                />
            </section>

            {/* Error Display */}
            {err && (
                <div className="card mb-8 text-center" style={{ borderColor: 'hsl(var(--status-risky))', color: 'hsl(var(--status-risky))', backgroundColor: 'hsl(var(--status-risky)/0.1)' }}>
                    <p className="font-bold">⚠️ {err}</p>
                </div>
            )}

            {/* Stock List */}
            <StockList
                stocks={stockedResults}
                onRemove={removeStock}
                onCompare={handleCompareStock}
            />

            {/* Comparison View */}
            {comparisonTarget && (
                <div className="animate-in zoom-in-95 duration-500">
                    <button
                        onClick={() => { setComparisonTarget(null); }}
                        className="mb-4 text-sm text-muted hover:text-white underline"
                    >
                        ← Back to Search
                    </button>
                    <ComparisonView result1={comparisonTarget[0]} result2={comparisonTarget[1]} />
                </div>
            )}

            {/* Single Result Section */}
            {currentResult && !comparisonTarget && (
                <div ref={resultRef} className="animate-in slide-in-from-bottom-5 duration-500">
                    <DiagnosisResult
                        data={currentResult}
                        onStock={() => toggleStock(currentResult)}
                        isStocked={stockedResults.some(r => r.debug.stationName === currentResult.debug.stationName)}
                        onLineClick={(line) => setExternalLineSearch({ line, ts: Date.now() })}
                    />
                </div>
            )}

            {/* Footer */}
        </main>
    );
}
