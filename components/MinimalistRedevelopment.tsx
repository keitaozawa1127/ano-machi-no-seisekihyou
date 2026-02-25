"use client";

import { useTransition, useState, useMemo } from "react";
import { approveRedevelopment, rejectRedevelopment } from "@/app/actions/redevelopment";

type RedevelopmentProject = {
    id: string;
    station_name: string;
    project_name: string;
    search_keyword: string;
    category?: string;
    schedule: string;
    description: string;
    impact_level: number;
    is_future: boolean;
    createdAt: string;
    approvedAt?: string;
};

// Impact Level 4-5 のみを抽出するフィルタ
const isSClassProject = (impact: number) => {
    return impact >= 4;
};

export default function MinimalistRedevelopment({ projects }: { projects: RedevelopmentProject[] }) {
    const [isPending, startTransition] = useTransition();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    // S級のみに厳選し、ユーザーフィルタリング
    const filteredProjects = useMemo(() => {
        return projects
            .filter((p) => isSClassProject(p.impact_level))
            .filter((p) =>
                searchTerm === "" ||
                p.station_name.includes(searchTerm) ||
                p.project_name.includes(searchTerm)
            )
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [projects, searchTerm]);

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedIds(newSet);
    };

    const handleApprove = (id: string) => {
        if (!confirm("このデータを本番環境（Master）へ公開しますか？")) return;
        startTransition(async () => {
            const result = await approveRedevelopment(id);
            if (!result.success) alert(result.message);
        });
    };

    const handleReject = (id: string) => {
        if (!confirm("このデータを却下（削除）しますか？")) return;
        startTransition(async () => {
            const result = await rejectRedevelopment(id);
            if (!result.success) alert(result.message);
        });
    };

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-[#4A544C] opacity-60 font-serif">
                <p className="tracking-widest text-sm">NO PENDING REQUESTS</p>
                <div className="w-8 h-px bg-current mt-4 opacity-30" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto font-sans text-[#333]">
            {/* Header: Minimalist Search */}
            <div className="mb-12 text-center">
                <h2 className="text-2xl font-light tracking-widest mb-2 font-serif">FUTURE SCAPE</h2>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-8">Premium Redevelopment Audit</p>

                <div className="relative max-w-xs mx-auto group">
                    <input
                        type="text"
                        placeholder="SEARCH PROJECTS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent border-b border-gray-200 py-2 text-center text-xs tracking-widest focus:outline-none focus:border-gray-400 transition-colors uppercase placeholder-gray-300"
                    />
                    <div className="absolute bottom-0 left-1/2 w-0 h-px bg-black transition-all duration-500 group-hover:w-full group-hover:left-0 group-focus-within:w-full group-focus-within:left-0" />
                </div>
            </div>

            {/* Timeline / Card List */}
            <div className="space-y-16 relative before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-gray-100 before:hidden md:before:block">
                {filteredProjects.map((project, index) => (
                    <div key={project.id} className="relative pl-0 md:pl-12 group transition-all duration-700 ease-out">
                        {/* Timeline Dot */}
                        <div className="hidden md:block absolute left-[-3px] top-6 w-[7px] h-[7px] bg-white border border-gray-300 rounded-full group-hover:border-black group-hover:scale-125 transition-all duration-300 z-10" />

                        {/* Card Content */}
                        <div className="bg-white p-0 md:p-8 transition-opacity duration-500">
                            {/* Station & Category Tag */}
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[10px] font-bold tracking-widest uppercase bg-black text-white px-2 py-1">
                                    {project.station_name}
                                </span>
                                <span className="text-[10px] tracking-widest text-gray-400 uppercase border border-gray-100 px-2 py-1">
                                    {project.category || "Redevelopment"}
                                </span>
                                {isSClassProject(project.impact_level) && (
                                    <span className="text-[10px] tracking-widest text-[#B8860B] border border-[#B8860B]/30 px-2 py-1 uppercase">
                                        Premium Impact
                                    </span>
                                )}
                            </div>

                            {/* Project Name */}
                            <h3 className="text-xl md:text-2xl font-light leading-snug mb-2 font-serif">
                                {project.project_name}
                            </h3>

                            {/* Schedule */}
                            <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">
                                COMPLETION: <span className="text-black font-medium">{project.schedule}</span>
                            </p>

                            {/* Minimalist Action: Dive Deeper */}
                            <div className="relative overflow-hidden">
                                <button
                                    onClick={() => toggleExpand(project.id)}
                                    className="text-[10px] tracking-[0.2em] uppercase border-b border-gray-300 py-1 hover:border-black transition-colors"
                                >
                                    {expandedIds.has(project.id) ? "Close Details" : "View Details"}
                                </button>

                                {/* Creating smooth height animation with max-height approach or conditional rendering with animation classes */}
                                <div
                                    className={`
                                        overflow-hidden transition-all duration-500 ease-in-out
                                        ${expandedIds.has(project.id) ? "max-h-[500px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"}
                                    `}
                                >
                                    <div className="bg-gray-50 p-6 rounded-sm border border-gray-100/50">
                                        <p className="text-sm leading-relaxed text-gray-600 font-light mb-6">
                                            {project.description}
                                        </p>

                                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200">
                                            <a
                                                href={`https://www.google.com/search?q=${encodeURIComponent(project.search_keyword)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 group/link"
                                            >
                                                <span className="w-2 h-2 rounded-full bg-blue-500 group-hover/link:animate-pulse"></span>
                                                <span className="text-[10px] text-gray-500 group-hover/link:text-black transition-colors underline decoration-gray-300 hover:decoration-black underline-offset-4 tracking-widest uppercase">
                                                    最新情報を検索
                                                </span>
                                            </a>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleReject(project.id)}
                                                    disabled={isPending}
                                                    className="px-4 py-2 text-[10px] tracking-widest uppercase hover:bg-gray-200 transition-colors disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(project.id)}
                                                    disabled={isPending}
                                                    className="px-6 py-2 bg-black text-white text-[10px] tracking-widest uppercase hover:bg-gray-800 transition-colors disabled:opacity-50"
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredProjects.length === 0 && (
                <div className="text-center py-20 text-gray-300 font-serif text-sm tracking-widest">
                    NO MATCHING PREMIUM PROJECTS FOUND
                </div>
            )}
        </div>
    );
}
