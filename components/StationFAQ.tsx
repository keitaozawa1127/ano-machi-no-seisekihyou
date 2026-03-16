"use client";

import React from "react";

type FAQDataProps = {
    data: any; // Same structured format as clientData passed to DiagnosisResult
};

export default function StationFAQ({ data }: FAQDataProps) {
    const stationName = data.name || data.debug?.stationName || "当";

    // Data parsing for dynamic answers based only on factual data
    // Q1: Market Price
    let priceText = `データがありません。現在のところ、${stationName}駅周辺の十分な取引データがありません。`;
    if (data.marketPrice && data.marketPrice > 0) {
        priceText = `国土交通省の不動産取引価格情報によると、${stationName}駅周辺の現在の市場価格相場（70㎡換算）は約${Math.floor(data.marketPrice / 10000).toLocaleString()}万円です。`;
    }

    // Q2: Future Value
    let futureText = `データがありません。`;
    if (data.trend || data.extendedMetrics?.futurePopulationRate || (data.metrics && data.metrics.future !== undefined)) {
        const trendStr = data.trend === "UP" ? "上昇" : data.trend === "DOWN" ? "下落" : "横ばい";
        const trendText = data.trend ? `直近の取引トレンドは${trendStr}傾向にあります。` : "";
        const popRate = data.extendedMetrics?.futurePopulationRate;
        const popText = typeof popRate === "number" ? `推計人口指数は${popRate.toFixed(1)}です。` : "";
        const scoreText = (data.metrics && data.metrics.future !== undefined) ? `独自アルゴリズムによる将来性スコアは100点満点中${data.metrics.future}点と算出されています。` : "";
        futureText = `${trendText}${popText}${scoreText}`.trim();
    }

    // Q3: Redevelopment Projects
    let redevText = `データがありません。国土交通省等の公開情報に基づく、現在進行中または予定されている主要な再開発プロジェクトは確認されていません。`;
    if (data.redevelopmentProjects && data.redevelopmentProjects.length > 0) {
        const p = data.redevelopmentProjects[0];
        redevText = `国土交通省や各自治体の公開情報によると、${stationName}駅周辺では現在${data.redevelopmentProjects.length}件の主要な再開発プロジェクトが予定（または進行）されています。代表的な例として「${p.project_name}」（予定完了時期：${p.schedule || "未定"}）が存在します。`;
    }

    // Q4: Hazard Risks
    let hazardText = `データがありません。国土交通省ハザードマップポータルサイトの情報を取得できませんでした。`;
    if (data.extendedMetrics?.hazardRisk) {
        const floodDesc = data.extendedMetrics.hazardRisk.flood?.description || "区域外";
        const landslideDesc = data.extendedMetrics.hazardRisk.landslide?.description || "区域外";
        hazardText = `国土交通省ハザードマップポータルサイトのデータによると、${stationName}駅周辺の河川氾濫リスクは「${floodDesc}」、土砂災害リスクは「${landslideDesc}」と判定分類されています。`;
    }

    // Static array of FAQ items
    const faqs = [
        {
            question: `${stationName}駅の現在の地価（市場価格）はいくらですか？`,
            answer: priceText
        },
        {
            question: `${stationName}駅の地価や資産価値は、今後どうなる見込みですか？`,
            answer: futureText
        },
        {
            question: `${stationName}駅周辺で予定されている主要な再開発は何ですか？`,
            answer: redevText
        },
        {
            question: `${stationName}駅周辺の災害リスク（水害・土砂災害）はどの程度ですか？`,
            answer: hazardText
        }
    ];

    // AIO/SEO Optimized FAQPage JSON-LD
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    };

    return (
        <section className="w-full">
            {/* JSON-LD for FAQPage */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="bg-white rounded-[2rem] shadow-sm border border-[#E8E6DF] p-6 md:p-12 mt-12 mb-16">
                <h2 className="text-xl md:text-2xl font-serif font-bold text-[#4A544C] mb-8 text-center tracking-widest">
                    よくあるご質問
                </h2>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <details
                            key={index}
                            className="group bg-[#F8F9FA] rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden border border-transparent hover:border-slate-200 transition-colors"
                        >
                            <summary className="flex items-center justify-between cursor-pointer p-5 md:p-6 text-sm md:text-base font-bold text-[#4A544C] select-none list-none outline-none">
                                <span className="pr-4 leading-relaxed">Q. {faq.question}</span>
                                <span className="transform transition-transform duration-300 group-open:rotate-180 text-gray-400 shrink-0">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </span>
                            </summary>
                            <div className="p-5 md:p-6 pt-0 text-sm leading-relaxed text-[#5F6E6F]">
                                <div className="border-t border-gray-200 pt-4 mt-2">
                                    A. {faq.answer}
                                </div>
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
