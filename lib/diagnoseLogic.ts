import { getFullDiagnosisData } from "./mlitServiceCore";
import { ExtendedMetrics, DynamicAddition } from "./mlitApi";
import fs from 'fs/promises';
import path from 'path';

const IS_VERCEL = process.env.VERCEL === "1";
const CACHE_DIR = IS_VERCEL ? '/tmp/diagnose_responses' : path.join(process.cwd(), 'data', 'cache', 'diagnose_responses');

// 起動時にディレクトリ作成
(async () => {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (e) {
        // ignore
    }
})();

export type Verdict = "safe" | "caution" | "risky";

export type PrimarySource = {
    publisher: string;      // 発行元（例: "国土交通省", "新宿区"）
    document_name: string;  // 資料名（例: "不動産取引価格情報", "都市計画決定"）
    version?: string;       // バージョンや年度
};

// Redevelopment Project Type Definition
export type RedevelopmentProject = {
    project_name: string;
    station_name: string;
    category: string;
    schedule: string;
    description: string;
    source_url?: string;
    impact_level?: number;
    search_keyword?: string;
    primary_source?: PrimarySource;
};

export type DiagnoseOkResponse = {
    ok: true;
    verdict: Verdict;
    headline: string;
    reasons: { label: string; value: string }[];
    rules: { label: string; value: string }[];
    note: string;
    debug: {
        stationName: string;
        year: number;
        tx5y: number;
        yoy: number;
        up2y: number;
        prevYear: number | null;
        score: number;
    };
    trendData?: { year: number; price: number; txCount?: number }[];
    extendedMetrics?: ExtendedMetrics;
    totalScore: number;
    metrics: {
        asset: number;
        safety: number;
        future: number;
        convenience: number;
        liquidity: number;
    };
    lines: { name: string; color?: string; passengers?: number }[];
    redevelopmentProjects: RedevelopmentProject[];
    marketPrice: number;
    yoy: number;
    tx5y: number;
    trend: "UP" | "DOWN" | "FLAT";
    dataYear: number;
    metadata: {
        sources: {
            realEstate: PrimarySource & { year?: number };
            population: PrimarySource & { baseYear?: number; targetYear?: number };
            algorithm: PrimarySource & { year?: number };
            hazard?: PrimarySource & { year?: number };
            redevelopment?: PrimarySource;
            [key: string]: any; // 将来の拡張用
        }
    };
};

export type DiagnoseNgResponse = {
    ok: false;
    error: string;
    debug?: Record<string, unknown>;
    redevelopment?: RedevelopmentProject[];
    partialSuccess?: boolean;
};

// Helper Functions
function cleanText(input: string): string {
    if (!input) return input;
    let s = input.replace(/\u00A0/g, " ");
    s = s.replace(/[ \t]{2,}/g, " ");
    return s.trim();
}

function formatInt(n: number): string {
    return `${Math.trunc(n)} `;
}

function formatPct(n: number): string {
    const v = Math.round(n * 10) / 10;
    return `${v.toFixed(1)}% `;
}

function clampNonNeg(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : n;
}

// Risk Logic
function calcRiskScore(tx5y: number, yoy: number, up2y: number): { score: number } {
    const tx = clampNonNeg(tx5y);

    let txScore = 0;
    if (tx < 10) {
        txScore = 6;
    } else if (tx < 20) {
        txScore = 3;
    }

    let yoyScore = 0;
    if (yoy > 15) {
        yoyScore = 3;
    }

    let up2yScore = 0;
    if (up2y > 20) {
        up2yScore = 4;
    }

    const score = txScore + yoyScore + up2yScore;
    return { score };
}

function calcExtendedRiskScore(ext: ExtendedMetrics): { score: number; rules: { label: string; value: string }[] } {
    let score = 0;
    const rules: { label: string; value: string }[] = [];

    // Future Population
    if (ext.futurePopulationRate < 80) {
        score += 4;
        rules.push({ label: "将来人口（2050推計）", value: `推計人口指数が ${ext.futurePopulationRate} と低く、過疎化による流動性低下のリスクがあります。` });
    } else if (ext.futurePopulationRate < 90) {
        score += 2;
        rules.push({ label: "将来人口（2050推計）", value: `推計人口指数が ${ext.futurePopulationRate} と減少傾向です。長期保有時の出口戦略に注意が必要です。` });
    } else if (ext.futurePopulationRate >= 100) {
        rules.push({ label: "将来人口（2050推計）", value: `人口は維持・増加傾向（${ext.futurePopulationRate}）で、需要の底堅さが期待できます。` });
    }

    // Hazard Risk (Flood)
    const floodLevel = ext.hazardRisk.flood.level;
    if (floodLevel >= 3) {
        score += 4;
        rules.push({ label: "災害リスク（水害）", value: "高ランクの水害リスクエリアに含まれています。ハザードマップの詳細確認が必須です。" });
    } else if (floodLevel >= 2) {
        score += 2;
        rules.push({ label: "災害リスク（水害）", value: "中程度の水害リスクがあります。階数選択や避難計画の確認を推奨します。" });
    }

    // Hazard Risk (Landslide)
    const landslideLevel = ext.hazardRisk.landslide.level;
    if (landslideLevel >= 1) {
        score += 3;
        rules.push({ label: "災害リスク（土砂）", value: "土砂災害警戒区域等のリスクがあります。擁壁の状況や周辺地形の確認が重要です。" });
    }

    return { score, rules };
}

function verdictFromScore100(score: number): Verdict {
    if (score >= 70) return "safe";
    if (score >= 45) return "caution";
    return "risky";
}

function buildHeadline(verdict: Verdict, tx5y: number, extScore: number, up2y: number): string {
    if (tx5y < 10) return "取引件数が少なく、指標のブレが大きい可能性があります（慎重に）";

    if (up2y <= -20) {
        return "市場価格が急落しています。一時的な要因か、構造的な変化か注視が必要です";
    }

    if (up2y > 0) {
        return "価格は上昇傾向にありますが、過熱による反動リスクに注意してください";
    }

    return "市場価格は概ね安定して推移しています";
}

function pushRule(rules: { label: string; value: string }[], label: string, value: string) {
    rules.push({ label: cleanText(label), value: cleanText(value) });
}

function pushReason(reasons: { label: string; value: string }[], label: string, value: string) {
    reasons.push({ label: cleanText(label), value: cleanText(value) });
}

// Redevelopment Impact Calculation
function calcRedevelopmentImpact(projects: RedevelopmentProject[]): number {
    // カテゴリー別の重み付け
    const categoryWeights: Record<string, number> = {
        'Infrastructure': 1.5,  // インフラは長期影響大
        'Redevelopment': 1.2,   // 大規模再開発
        'Commercial': 1.0,      // 商業施設
        'Mansion': 0.8,         // マンション開発
        'Public': 0.9           // 公共施設
    };

    // 時期による重み付け（近未来ほど確実性が高い）
    const currentYear = new Date().getFullYear();

    let totalImpact = 0;
    for (const project of projects) {
        const categoryWeight = categoryWeights[project.category] || 1.0;
        const impactLevel = project.impact_level || 3;

        // スケジュールから年を抽出
        const yearMatch = project.schedule?.match(/(\d{4})/);
        let timeWeight = 1.0;
        if (yearMatch) {
            const projectYear = parseInt(yearMatch[1], 10);
            const yearsUntil = projectYear - currentYear;
            if (yearsUntil <= 3) timeWeight = 1.2;      // 3年以内
            else if (yearsUntil <= 10) timeWeight = 1.0; // 10年以内
            else timeWeight = 0.7;                       // 遠い未来
        }

        totalImpact += impactLevel * categoryWeight * timeWeight;
    }

    // 正規化して0-40点に収める
    return Math.min(totalImpact * 2, 40);
}

// Redevelopment Data Loader
async function loadRedevelopmentProjects(stationName: string): Promise<{ projects: RedevelopmentProject[], metadata?: any }> {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://anomachi.jp';

        // 1. Try loading station-specific file first (Official Record Strategy)
        const stationFileUrl = `${baseUrl}/data/stations/${encodeURIComponent(stationName)}.json`;
        try {
            const res = await fetch(stationFileUrl, { cache: 'no-store' });
            if (res.ok) {
                const parsed = await res.json();
                const projects: RedevelopmentProject[] = Array.isArray(parsed) ? parsed : (parsed.projects || []);
                const metadata = !Array.isArray(parsed) && parsed._metadata ? parsed._metadata : undefined;

                // 動的にシステム年を取得
                const currentYear = new Date().getFullYear();

                // 過去のプロジェクトを除外
                const futureProjects = filterFutureProjects(projects, currentYear);
                return { projects: futureProjects, metadata };
            }
        } catch (e) {
        }

        const masterFileUrl = `${baseUrl}/data/redevelopment_master.json`;

        const masterRes = await fetch(masterFileUrl, { cache: 'no-store' });
        if (!masterRes.ok) throw new Error(`Failed to fetch master data: ${masterRes.status}`);
        const parsed = await masterRes.json();
        const allProjects: RedevelopmentProject[] = Array.isArray(parsed) ? parsed : (parsed.projects || []);
        const masterMetadata = !Array.isArray(parsed) && parsed._metadata ? parsed._metadata : undefined;

        // Normalize station name
        const normalizeName = (s: string) =>
            s.replace(/駅$/, '')
                .replace(/[（(].*?[）)]/g, '')
                .replace(/[\s\u3000]/g, '')
                .toLowerCase();

        const targetNormalized = normalizeName(stationName);

        // Filter by station name (with null-safety for malformed entries)
        const stationProjects = allProjects.filter(p => {
            // Skip entries with missing station_name (data quality issue)
            if (!p.station_name) {
                return false;
            }
            const projectStationNorm = normalizeName(p.station_name);
            if (!projectStationNorm || !targetNormalized) return false;
            return projectStationNorm.includes(targetNormalized) || targetNormalized.includes(projectStationNorm);
        });

        // 動的にシステム年を取得
        const currentYear = new Date().getFullYear();

        // 過去のプロジェクトを除外
        const futureProjects = filterFutureProjects(stationProjects, currentYear);

        return { projects: futureProjects, metadata: masterMetadata };
    } catch (error) {
        return { projects: [] };
    }
}

// 過去のプロジェクトを動的に除外するヘルパー関数
function filterFutureProjects(projects: RedevelopmentProject[], currentYear: number): RedevelopmentProject[] {
    const validProjects = projects.filter(p => {
        const schedule = p.schedule || "";

        // 継続・未定・検討・計画・構想等のステータスは「未来」として無条件で包含
        if (schedule.includes("継続") || schedule.includes("未定") || schedule.includes("検討") ||
            schedule.includes("計画") || schedule.includes("構想")) {
            return true;
        }

        // scheduleから4桁の年を抽出
        const match = schedule.match(/(\d{4})/);
        if (match) {
            const year = parseInt(match[1], 10);

            // 抽出した年が現在のシステム年を「超えている」または「同じ」場合のみ残す
            // これにより過去（year < currentYear）の完了済みプロジェクトは自動的に除外される
            return year >= currentYear;
        }

        // 年数が抽出できない場合で、かつ「完了」や「終了」が含まれる場合は除外
        if (schedule.includes("完了") || schedule.includes("終了")) {
            return false;
        }

        // 年数も完了ステータスもない場合は、安全側に倒して残す（フォールバック）
        return true;
    });

    // スケジュール年順にソート
    validProjects.sort((a, b) => {
        const yearA = parseInt(a.schedule?.match(/(\d{4})/)?.pop() || '9999');
        const yearB = parseInt(b.schedule?.match(/(\d{4})/)?.pop() || '9999');
        return yearA - yearB;
    });

    return validProjects;
}


export async function diagnoseAsync(stationNameRaw: string, prefCodeRaw: string, yearRaw: number): Promise<DiagnoseOkResponse | DiagnoseNgResponse> {
    try {
        const stationName = (stationNameRaw ?? "").trim();
        const prefCode = (prefCodeRaw ?? "13").trim();
        let year = yearRaw;
        if (!year || !Number.isFinite(year)) {
            year = 2024;
        }

        if (!stationName) return { ok: false, error: "stationName が空です" };

        const cacheFileName = `${prefCode}_${stationName}_${year}_v10.json`;
        const cacheFilePath = path.join(CACHE_DIR, cacheFileName);

        // キャッシュ読み込み
        try {
            const cachedData = await fs.readFile(cacheFilePath, 'utf-8');
            const parsed = JSON.parse(cachedData);
            return parsed as DiagnoseOkResponse;
        } catch (e) {
        }

        let fullData;
        let popTotal2020 = 0;
        let popTotal2050 = 0;
        let popTargetYear = 2050; // default
        let popBaseYear = 2020;   // default
        let popMetadata = { name: "国立社会保障・人口問題研究所「日本の地域別将来推計人口」", version: "推計" };

        let verdict: Verdict = "risky"; // Initialize with a default value
        let diagnosisError: any = null;

        let metrics: any;
        let linesRaw: any;
        let extMetrics: any;

        try {
            // Fetch full diagnosis data
            fullData = await getFullDiagnosisData(stationName, prefCode);
            // Extract data when successful
            metrics = fullData.mlit;
            linesRaw = fullData.lines;
            extMetrics = fullData.ext;
            // Population data is part of fullData.ext
            if (extMetrics && extMetrics.populationProjection) {
                popMetadata = extMetrics.populationProjection.metadata || popMetadata;
                popBaseYear = extMetrics.populationProjection.baseYear || popBaseYear;
                popTargetYear = extMetrics.populationProjection.targetYear || popTargetYear;
                popTotal2020 = extMetrics.populationProjection.total2020 || 0;
                popTotal2050 = extMetrics.populationProjection.total2050 || 0;
            }
        } catch (e: any) {
            diagnosisError = e;
        }

        // Load redevelopment data regardless of main diagnosis success
        const redevelopmentData = await loadRedevelopmentProjects(stationName);
        const redevelopmentProjects = redevelopmentData.projects; // Here, projects are already dynamically filtered
        const redevelopmentMetadata = redevelopmentData.metadata;
        console.error(`[/api/diagnose] Redevelopment projects for ${stationName}:`, redevelopmentProjects.length);

        // If diagnosis failed or missing data, return partial success with only redevelopment data
        if (diagnosisError || !metrics || !extMetrics || !linesRaw) {
            return {
                ok: false,
                error: (diagnosisError ? (diagnosisError.message || String(diagnosisError)) : "必須データが取得できませんでした"),
                redevelopment: redevelopmentProjects,
                partialSuccess: true
            } as any;
        }

        // Check if data exists
        if (metrics.tx5y === 0 && metrics.trendData.length === 0) {
            return {
                ok: false,
                error: "指定の駅周辺（半径2km以内）に取引データが見つかりませんでした。データが少ない地域の可能性があります。",
                debug: { stationName, prefCode },
                partialSuccess: true, // Allow saving partial data (convenience/safety)
                redevelopment: redevelopmentProjects
            } as any;
        }

        const { tx5y, yoy, up2y, trendData, dataYear, marketPrice, trend } = metrics;

        // Ensure unique lines
        const lines = Array.from(new Set(linesRaw.map((l: any) => l.name))).map((name: any) => ({ name }));

        const { score: stdScore } = calcRiskScore(tx5y, yoy, up2y);
        const { score: extScore, rules: extRules } = calcExtendedRiskScore(extMetrics);

        // 5-Factor Scoring Logic (Base Calculation)
        const defaultScore = 50;

        // 1. Asset Score
        let assetScore = defaultScore;
        if (marketPrice) {
            let rawAsset = (marketPrice / 100000000) * 100;
            if (trend === "UP") rawAsset += 5;
            assetScore = rawAsset;
        }

        // 2. Safety Score
        let safetyScore = defaultScore;
        if (extMetrics.hazardRisk) {
            const flood = extMetrics.hazardRisk.flood.level || 0;
            const landslide = extMetrics.hazardRisk.landslide.level || 0;
            const penalty = (flood + landslide) * 15;
            safetyScore = 100 - penalty;
        }

        // 3. Future Score
        let futureScore = defaultScore;
        let populationScore = 20;
        if (extMetrics.futurePopulationRate && extMetrics.futurePopulationRate > 0) {
            populationScore = Math.min(Math.max(extMetrics.futurePopulationRate * 0.8, 0), 100) * 0.4;
        }
        let redevelopmentScore = calcRedevelopmentImpact(redevelopmentProjects);
        let infraScore = 0;
        const hasInfraProject = redevelopmentProjects.some(p => p.category === 'Infrastructure');
        infraScore = (hasInfraProject ? 15 : 0) + Math.min(lines.length * 2.5, 5);
        futureScore = populationScore + redevelopmentScore + infraScore;

        // 4. Convenience Score
        let convenienceScore = defaultScore;
        const lineCount = lines.length;
        if (lineCount) {
            const normalized = Math.min(lineCount / 15, 1);
            convenienceScore = Math.pow(normalized, 0.35) * 100;
        }

        // 5. Liquidity Score
        let liquidityScore = defaultScore;
        if (tx5y) {
            const normalized = Math.min(tx5y / 7000, 1);
            liquidityScore = Math.pow(normalized, 0.6) * 100;
        }

        // =========================================================================
        // [改修箇所] 新規項目の動的トラッキングとスコア自動再計算ロジック
        // =========================================================================
        const reasons: { label: string; value: string }[] = [];
        const rules: { label: string; value: string }[] = [];
        const dynamicAdditions: DynamicAddition[] = extMetrics.dynamicAdditions || [];

        // 拡張データを自動検知して既存カテゴリへ追従させる
        dynamicAdditions.forEach(addition => {
            switch (addition.category) {
                case "asset":
                    assetScore += addition.scoreImpact;
                    break;
                case "safety":
                    safetyScore += addition.scoreImpact;
                    break;
                case "future":
                    futureScore += addition.scoreImpact;
                    break;
                case "convenience":
                    convenienceScore += addition.scoreImpact;
                    break;
                case "liquidity":
                    liquidityScore += addition.scoreImpact;
                    break;
            }
            // 表示用の理由（reasons）に自動的に反映
            if (addition.label && addition.value) {
                pushReason(reasons, addition.label, addition.value);
            }
            // 詳細説明（rules）に自動的に反映
            if (addition.ruleDescription) {
                pushRule(rules, addition.label, addition.ruleDescription);
            }
        });

        // =========================================================================
        // 全スコアの範囲クランプ処理（上限100、下限0の保証）
        // =========================================================================
        assetScore = Math.min(Math.max(assetScore, 0), 100);
        safetyScore = Math.min(Math.max(safetyScore, 0), 100);
        futureScore = Math.min(Math.max(futureScore, 0), 100);
        convenienceScore = Math.min(Math.max(convenienceScore, 0), 100);
        liquidityScore = Math.min(Math.max(liquidityScore, 0), 100);

        // Total Score (Weighted Average) - 動的に加減点された値で総合スコアを算出
        const total =
            (assetScore * 0.30) +
            (safetyScore * 0.25) +
            (futureScore * 0.15) +
            (convenienceScore * 0.15) +
            (liquidityScore * 0.15);

        const totalScore = Math.round(total);

        const breakdownMetrics = {
            asset: Math.round(assetScore),
            safety: Math.round(safetyScore),
            future: Math.round(futureScore),
            convenience: Math.round(convenienceScore),
            liquidity: Math.round(liquidityScore)
        };

        verdict = verdictFromScore100(totalScore);

        // 基本理由（reasons）の追加（既存ロジックと動的追加分の合成）
        pushReason(reasons, "直近5年の取引件数", `${formatInt(tx5y)} 件`);

        // Average Price
        const latestTrend = trendData && trendData.length > 0 ? trendData[trendData.length - 1] : null;
        const avgPrice = latestTrend ? latestTrend.price : 0;
        let priceStr = "データなし";
        if (avgPrice > 0) {
            if (avgPrice >= 100000000) {
                priceStr = `${(avgPrice / 100000000).toFixed(1)} 億円`;
            } else {
                priceStr = `${formatInt(avgPrice / 10000)} 万円`;
            }
        }
        pushReason(reasons, "平均成約価格", priceStr);
        pushReason(reasons, "対前年変動率", formatPct(yoy));

        // Add Extended Rules FIRST (Then legacy rules, plus dynamicAdditions already applied above)
        extRules.forEach(r => pushRule(rules, r.label, r.value));

        // Legacy Rules Logic
        if (tx5y < 10) {
            pushRule(rules, "取引件数（重要）", "直近5年の取引件数が10件未満のため、平均値や上昇率が少数の取引に強く影響されます。価格水準の判断以前に、指標自体の信頼性が低い可能性を前提にしてください。");
        } else if (tx5y < 20) {
            pushRule(rules, "取引件数", "直近5年の取引件数が20件未満のため、指標がブレやすく、単年の数値で判断しにくい状態です。周辺エリアや物件条件を変えた複数の見方で確認するのが安全です。");
        } else if (tx5y < 30) {
            pushRule(rules, "取引件数", "取引件数は極端に少ない水準ではありませんが、年ごとの差が出やすい可能性があります。単年の結果を断定材料にしないでください。");
        } else {
            pushRule(rules, "取引件数", "取引件数は相対的に一定の厚みがあり、極端な少数サンプル由来のブレは出にくい部類です。ただし物件条件（築年・面積帯）で結果が変わる点は残ります。");
        }

        if (yoy >= 12) {
            pushRule(rules, "中長期（年次プレ）", "中長期の上昇が強く、過熱局面では期待が先行して価格が伸びやすい一方、前提が崩れると調整も起きやすくなります。");
        } else if (yoy >= 9) {
            pushRule(rules, "中長期（年次プレ）", "中長期の上昇がやや強めです。上昇の背景（再開発・利便性改善など）が継続するかを確認するのが安全です。");
        } else if (yoy >= 6) {
            pushRule(rules, "中長期（年次プレ）", "中長期の上昇は見られますが、突出した過熱とまでは言いにくい水準です。");
        } else {
            pushRule(rules, "中長期（年次プレ）", "中長期の上昇は強くありません。将来の上昇を前提にした判断は避け、住み替え・保有期間の前提でリスクを見てください。");
        }

        if (up2y >= 20) {
            pushRule(rules, "短期（直近2年）", "直近2年の上昇が急で、短期的な反動（調整）リスクが高まります。購入検討では価格の納得感と資金余力を厚めに見てください。");
        } else if (up2y >= 15) {
            pushRule(rules, "短期（直近2年）", "直近2年の上昇が強めです。短期上昇の要因が一時的だった場合、伸びが止まる・戻る可能性もあります。");
        } else if (up2y >= 10) {
            pushRule(rules, "短期（直近2年）", "直近2年で上昇が見られます。短期の上振れが含まれている可能性を前提にしてください。");
        } else {
            pushRule(rules, "短期（直近2年）", "直近2年の上昇は急ではありません。ただし横ばい＝安全の保証ではなく、金利や需給で変動し得ます。");
        }

        const headline = buildHeadline(verdict, tx5y, extScore, up2y);

        let finalStatusNote = `データ基準日: ${dataYear}年時点。`;
        const m = metrics as any;
        if (m.latestYear && m.latestYear > dataYear) {
            finalStatusNote += `（※グラフの最新年 ${m.latestYear}年はデータ集計途中のため、診断スコアには実績確定済みの ${dataYear}年を採用しています）`;
        }
        finalStatusNote += ` この診断は公開データにもとづく簡易的な目安であり、将来の価格や資産性を保証するものではありません。個別物件の条件（築年・面積・方角・管理状態など）で結果は大きく変わります。`;

        const response: DiagnoseOkResponse = {
            ok: true,
            verdict,
            headline: cleanText(headline),
            reasons: reasons.map((r) => ({ label: cleanText(r.label), value: cleanText(r.value) })),
            rules: rules.map((r) => ({ label: cleanText(r.label), value: cleanText(r.value) })),
            note: cleanText(finalStatusNote),
            debug: { stationName, year, tx5y, yoy, up2y, prevYear: null, score: totalScore },
            trendData,
            extendedMetrics: extMetrics,
            totalScore,
            metrics: breakdownMetrics,
            lines: linesRaw || [],
            redevelopmentProjects,
            marketPrice,
            tx5y: tx5y || 0,
            trend: (trend || "FLAT") as "UP" | "DOWN" | "FLAT",
            yoy: yoy || 0,
            dataYear,
            metadata: {
                sources: {
                    realEstate: { publisher: "国土交通省", document_name: "不動産取引価格情報", year: dataYear },
                    population: {
                        publisher: "国立社会保障・人口問題研究所",
                        document_name: "日本の地域別将来推計人口",
                        version: popMetadata.version,
                        baseYear: popBaseYear,
                        targetYear: popTargetYear
                    },
                    algorithm: { publisher: "自社", document_name: "独自アルゴリズム算出", year: new Date().getFullYear() },
                    hazard: { publisher: "国土交通省 / 国土地理院", document_name: "ハザードマップポータルサイト", year: new Date().getFullYear() },
                    redevelopment: redevelopmentMetadata ? {
                        publisher: redevelopmentMetadata.publisher || "各自治体・開発事業者",
                        document_name: redevelopmentMetadata.name || "公開情報",
                        version: redevelopmentMetadata.version || "2026年2月時点"
                    } : { publisher: "各自治体・開発事業者", document_name: "公開情報", version: "2026年2月時点" }
                }
            }
        };

        // キャッシュ保存
        if (response.ok) {
            try {
                await fs.writeFile(cacheFilePath, JSON.stringify(response, null, 2));
            } catch (e) {
            }
        }

        return response;

    } catch (error: any) {
        console.error("[/api/diagnose] Error:", error);
        return {
            ok: false,
            error: error.message || "内部エラーが発生しました",
            debug: { stationName: stationNameRaw, dataYear: null }
        };
    }
}
