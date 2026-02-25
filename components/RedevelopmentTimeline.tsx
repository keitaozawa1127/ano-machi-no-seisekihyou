"use client";

import React from "react";

// Matches RedevelopmentProject type from API
type RedevelopmentProject = {
    project_name: string;
    station_name: string;
    schedule: string;
    description: string;
    source_url?: string;
    search_keyword?: string; // Added for Official Record Strategy
    impact_level?: number; // Added for Impact Level (1-5)
    is_future?: boolean;
};

type RedevelopmentTimelineProps = {
    data?: RedevelopmentProject[];
    metadata?: { name: string; version: string };
};

export default function RedevelopmentTimeline({ data, metadata }: RedevelopmentTimelineProps) {
    // Default to empty array if undefined
    const projects = data || [];
    const hasData = projects.length > 0;

    // Sort projects by schedule (nearest year first)
    const sortedProjects = [...projects].sort((a, b) => {
        const yearA = parseInt(a.schedule.match(/(\d{4})/)?.[1] || '9999');
        const yearB = parseInt(b.schedule.match(/(\d{4})/)?.[1] || '9999');
        return yearA - yearB;
    });

    return (
        <div className="w-full mt-12 mb-8">
            <h4 className="text-sm font-bold text-[#4A544C] tracking-widest mb-6 inline-block">
                再開発計画
            </h4>

            {hasData ? (
                <div className="relative pl-4 space-y-6">
                    {/* 垂直線 - 親の左端(Padding Edge)から11pxの位置 (中心11.5px) */}
                    {/* pl-4(16px)のパディング領域内に描画される */}
                    <div className="absolute top-0 bottom-0 left-[11px] w-px bg-[#E0E0E0]"></div>

                    {sortedProjects.map((item, index) => {
                        const yearMatch = item.schedule.match(/(\d{4})/);
                        const year = yearMatch ? yearMatch[1] : item.schedule;
                        const level = item.impact_level || 3;

                        const searchUrl = item.search_keyword
                            ? `https://www.google.com/search?q=${encodeURIComponent(item.search_keyword)}`
                            : item.source_url;

                        return (
                            <div key={index} className="relative group">
                                {/* メインコンテンツ - items-startで上揃え */}
                                <div className="flex items-start gap-4 group hover:bg-slate-50/50 py-2 px-2 -ml-2 rounded-lg transition-colors">
                                    {/* ドット - 垂直線の中心(11.5px)に合わせて配置 */}
                                    {/* 親要素はpl-4(16px)から始まるため、11.5pxの位置に置くには 11.5 - 16 = -4.5px のオフセットが必要 */}
                                    <div className="absolute left-[-4.5px] top-[14px] w-[9px] h-[9px] rounded-full border border-[#708271] bg-[#708271] -translate-x-1/2 transition-all duration-500 group-hover:scale-125 group-hover:bg-[var(--brand-main)] group-hover:border-[var(--brand-main)] z-10"></div>

                                    {/* 年号 - ドットの右側、テキストのベースラインに合わせて調整 */}
                                    <div className="w-[3.5rem] text-xs font-bold font-feature-settings-tnum text-right flex-shrink-0 text-[#4A544C] mt-[2px] ml-6">
                                        {year}
                                    </div>

                                    {/* プロジェクト情報 */}
                                    <div className="flex-1 min-w-0">
                                        {/* プロジェクト名とレベル - 同じ行に */}
                                        <div className="flex items-start gap-3 mb-1">
                                            <p className="text-sm font-medium text-[#4A544C] leading-snug">
                                                {item.project_name}
                                            </p>
                                            {/* Level Indicator */}
                                            <div className="flex items-center gap-2 flex-shrink-0 mt-[1px]">
                                                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${level >= 5 ? "bg-[#C06C5F]/10 text-[#C06C5F]" :
                                                    level >= 4 ? "bg-[#D4A373]/10 text-[#D4A373]" :
                                                        "bg-[#708271]/10 text-[#708271]"
                                                    }`}>
                                                    Lv.{level}
                                                </div>
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-1.5 h-1.5 rounded-full ${i <= level
                                                                ? (level >= 5 ? "bg-[#C06C5F]" : level >= 4 ? "bg-[#D4A373]" : "bg-[#708271]")
                                                                : "bg-[#E0E0E0]"}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 説明文 */}
                                        <p className="text-xs text-[#4A544C] opacity-80 leading-relaxed mt-1">
                                            {item.description}
                                        </p>

                                        {/* スケジュールと検索リンク */}
                                        <div className="text-[10px] text-[#4A544C] opacity-60 flex gap-2 items-center mt-1">
                                            <span className="font-feature-settings-tnum">{item.schedule}</span>
                                            {searchUrl && (
                                                <a
                                                    href={searchUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 hover:text-[var(--brand-main)] hover:underline transition-colors ml-2"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="11" cy="11" r="8" />
                                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                    </svg>
                                                    詳細を検索
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-10 text-xs text-[#4A544C] tracking-widest opacity-60">
                    現在、主要な再開発計画はありません
                </div>
            )}

            {/* 出典情報（動的メタデータ） */}
            <div className="mt-8 text-right">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50/80 rounded-md border border-slate-100/50">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] text-slate-500 tracking-wide">
                        出典: {metadata?.name || "各自治体・開発事業者 公開情報"} {metadata?.version ? ` ${metadata.version}` : ""}
                    </span>
                </div>
            </div>
        </div>
    );
}
