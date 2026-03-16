import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import fs from 'fs/promises';
import path from 'path';
import DiagnosisResult from '../../../components/DiagnosisResult';
import StationFAQ from '../../../components/StationFAQ';
import Link from 'next/link';

type Props = {
    params: { id: string };
};

export const dynamicParams = false;

/**
 * Helper function to read pre-computed diagnosis data from local filesystem.
 * This ensures no dynamic API calls are made during build or runtime.
 */
async function getStationData(id: string) {
    try {
        const decodedId = decodeURIComponent(id);
        const filePath = path.join(process.cwd(), 'data', 'stations', `${decodedId}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error(`[SSG] Data not found for station: ${id}`);
        return null;
    }
}

/**
 * Generates static paths for all stations that have a pre-computed JSON file.
 */
export async function generateStaticParams() {
    try {
        const dataDir = path.join(process.cwd(), 'data', 'stations');
        
        // Ensure directory exists
        const stats = await fs.stat(dataDir).catch(() => null);
        if (!stats || !stats.isDirectory()) {
            console.warn(`[SSG] Data directory not found: ${dataDir}`);
            return [];
        }

        const files = await fs.readdir(dataDir);
        const params = files
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                id: file.replace('.json', ''),
            }));
            
        console.log(`[SSG] Generating static params for ${params.length} stations`);
        return params;
    } catch (e) {
        console.error("Error in generateStaticParams:", e);
        return [];
    }
}

/**
 * Metadata generation using static JSON data.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const resolvedParams = await params;
    const result = await getStationData(resolvedParams.id);
    const decodedName = decodeURIComponent(resolvedParams.id);

    if (!result || !result.ok) {
        return {
            title: `${decodedName}駅の診断結果が見つかりません | あの街の成績表`,
            description: `あの街の成績表で${decodedName}駅周辺の不動産・街の資産性をチェックしましょう。`,
        };
    }

    const { totalScore, verdict, headline, metrics } = result;
    const verdictLabel = verdict === 'safe' ? '推奨' : verdict === 'caution' ? '注意' : '要確認';

    let breakdown = "";
    if (metrics) {
        breakdown = `資産性${metrics.asset} 安全性${metrics.safety} 将来性${metrics.future} 利便性${metrics.convenience} 流動性${metrics.liquidity}`;
    }

    // const ogImageUrl = `https://anomachi.jp/api/og?station=${encodeURIComponent(decodedName)}&score=${totalScore}&verdict=${encodeURIComponent(verdictLabel)}`;
    const ogImageUrl = 'https://anomachi.jp/images/default-og.png';

    return {
        title: `【あの街の成績表】${decodedName}駅の住みやすさ・資産性診断（総合スコア: ${totalScore}点 / ${verdictLabel}）`,
        description: `${decodedName}駅の不動産価値と街の将来性を独自アルゴリズムで徹底分析。「${headline}」${breakdown}。広告やバイアスを排除した純粋な街の評価データを確認できます。`,
        openGraph: {
            title: `${decodedName}駅の資産性診断 | あの街の成績表`,
            description: `${decodedName}駅の不動産価値と街の将来性を徹底分析。「${headline}」`,
            url: `https://anomachi.jp/station/${encodeURIComponent(decodedName)}`,
            type: 'article',
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: `${decodedName}駅の診断結果: スコア ${totalScore} - ${verdictLabel}`,
                }
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: `${decodedName}駅の資産性診断 | あの街の成績表`,
            description: `${decodedName}駅の不動産価値と街の将来性を徹底分析。「${headline}」`,
            images: [ogImageUrl],
        }
    };
}

/**
 * Main Static Page Component
 */
export default async function StationPage({ params }: Props) {
    const resolvedParams = await params;
    const decodedName = decodeURIComponent(resolvedParams.id);
    
    // Load pre-calculated data from filesystem
    const result = await getStationData(resolvedParams.id);

    if (!result || !result.ok) {
        return (
            <main className="min-h-screen w-full flex flex-col items-center pt-20 px-6 bg-[var(--bg-primary)] overflow-x-hidden">
                <header className="w-full max-w-4xl text-center mb-16 min-w-0 px-2">
                    <h1 className="hero-title text-4xl md:text-5xl font-medium tracking-widest my-[60px] text-[var(--brand-main)] font-serif">
                        <Link href="/" className="hover:opacity-80 transition-opacity duration-300">
                            あの街の成績表
                        </Link>
                    </h1>
                </header>
                <div className="card mb-8 text-center w-full max-w-2xl min-w-0" style={{ borderColor: 'hsl(var(--status-risky))', color: 'hsl(var(--status-risky))', backgroundColor: 'hsl(var(--status-risky)/0.1)' }}>
                    <p className="font-bold">⚠️ {result?.error || `${decodedName}駅のデータが準備中か、見つかりませんでした。`}</p>
                    <div className="mt-8">
                        <Link href="/" className="text-[var(--brand-main)] underline hover:opacity-80 transition-opacity">
                            トップページに戻る
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const { totalScore, verdict, headline } = result;
    const verdictLabel = verdict === 'safe' ? '推奨' : verdict === 'caution' ? '注意' : '要確認';
    const pageUrl = `https://anomachi.jp/station/${encodeURIComponent(decodedName)}`;

    // AIO最適化構造化データ（JSON-LD）の作成
    const jsonLd: any = {
        "@context": "https://schema.org",
        "@type": "ItemPage",
        "name": `${decodedName}駅の資産性診断 | あの街の成績表`,
        "description": `${decodedName}駅の不動産価値と街の将来性を徹底分析。「${headline}」`,
        "url": pageUrl,
        "mainEntity": {
            "@type": "Place",
            "name": `${decodedName}駅`,
            "description": "あの街の成績表による独自資産性評価",
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": totalScore,
                "bestRating": 100,
                "worstRating": 0,
                "ratingCount": 1
            },
            "additionalProperty": [
                {
                    "@type": "PropertyValue",
                    "name": "総合スコア",
                    "value": totalScore,
                    "unitText": "点"
                }
            ]
        }
    };

    // Client Component data payload optimization (reducing bundle size)
    const clientData = {
        ok: result.ok,
        verdict: result.verdict,
        headline: result.headline,
        reasons: result.reasons,
        rules: result.rules,
        note: result.note,
        debug: {
            score: result.debug?.score,
            stationName: result.debug?.stationName
        },
        trendData: result.trendData,
        marketPrice: result.marketPrice,
        yoy: result.yoy,
        tx5y: result.tx5y,
        trend: result.trend,
        dataYear: result.dataYear,
        lines: result.lines?.map((l: any) => ({ name: l.name, color: l.color, passengers: l.passengers })),
        name: result.debug?.stationName || decodedName,
        extendedMetrics: result.extendedMetrics ? {
            futurePopulationRate: result.extendedMetrics.futurePopulationRate,
            populationProjection: result.extendedMetrics.populationProjection?.map((p: any) => ({
                year: p.year,
                total: p.total,
                ageStructure: p.ageStructure
            })),
            sourceCity: result.extendedMetrics.sourceCity,
            hazardRisk: {
                flood: {
                    level: result.extendedMetrics.hazardRisk.flood.level,
                    description: result.extendedMetrics.hazardRisk.flood.description
                },
                landslide: {
                    level: result.extendedMetrics.hazardRisk.landslide.level,
                    description: result.extendedMetrics.hazardRisk.landslide.description
                }
            },
            dynamicAdditions: result.extendedMetrics.dynamicAdditions?.map((a: any) => ({
                category: a.category,
                label: a.label,
                value: a.value,
                scoreImpact: a.scoreImpact,
                ruleDescription: a.ruleDescription
            }))
        } : undefined,
        totalScore: result.totalScore,
        metrics: result.metrics,
        redevelopmentProjects: result.redevelopmentProjects?.slice(0, 15).map((p: any) => ({
            project_name: p.project_name,
            category: p.category,
            schedule: p.schedule,
            description: p.description,
            source_url: p.source_url
        })),
        metadata: {
            ...result.metadata,
            sources: {
                ...result.metadata?.sources,
                realEstate: {
                    ...result.metadata?.sources?.realEstate,
                    year: result.metadata?.sources?.realEstate?.year || new Date().getFullYear(),
                }
            }
        } as any
    };

    return (
        <main className="min-h-screen w-full flex flex-col items-center pt-10 px-6 bg-[var(--bg-primary)] overflow-x-hidden">
            {/* 構造化データ（Google検索リッチリザルト用） */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Header with back link */}
            <div className="w-[1000px] max-w-full mb-6">
                <Link href="/" className="inline-flex items-center text-sm font-bold text-[var(--brand-main)] hover:opacity-70 transition-opacity px-2">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    検索に戻る
                </Link>
            </div>

            {/* Northern European Minimalist Premium styling wrapper */}
            <div className="w-full flex justify-center min-w-0 animate-in slide-in-from-bottom-5 duration-500">
                <DiagnosisResult data={clientData} />
            </div>

            {/* AIO FAQ Section */}
            <div className="w-full max-w-[1000px] flex justify-center min-w-0 animate-in slide-in-from-bottom-5 duration-700 delay-150 px-2 md:px-0">
                <StationFAQ data={clientData} />
            </div>

            {/* Share Section */}
            <div className="w-full max-w-2xl mt-12 mb-24 flex justify-center animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`https://anomachi.jp/station/${encodeURIComponent(decodedName)}`)}&text=${encodeURIComponent(`あの街の成績表で「${decodedName}駅」の診断結果を確認しました。\n総合スコア: ${totalScore}点 (${verdictLabel})\n`)}&hashtags=あの街の成績表,街選び,不動産`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center justify-center space-y-2 hover:opacity-70 transition-opacity"
                >
                    <div className="w-14 h-14 bg-white/70 rounded-full flex items-center justify-center border border-[var(--border-main)]/50 shadow-sm transition-transform group-hover:-translate-y-1">
                        <svg className="w-6 h-6 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.95H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                    </div>
                    <span className="text-xs tracking-widest text-[var(--text-muted)] font-medium">結果をシェア</span>
                </a>
            </div>
        </main>
    );
}
