"use client";

import { useTransition } from "react";
import { approveRedevelopment, rejectRedevelopment } from "@/app/actions/redevelopment";

type RedevelopmentProject = {
    id: string;
    stationName: string;
    projectName: string;
    schedule: string;
    sourceUrl: string;
    aiImpact: string;
    createdAt: string;
};

export default function RedevelopmentTable({ projects }: { projects: RedevelopmentProject[] }) {
    const [isPending, startTransition] = useTransition();

    const handleApprove = (id: string) => {
        if (!confirm("このデータを本番環境（Master）へ公開しますか？")) return;
        startTransition(async () => {
            const result = await approveRedevelopment(id);
            if (!result.success) alert(result.message);
        });
    };

    const handleReject = (id: string) => {
        if (!confirm("このデータを却下（削除）しますか？この操作は取り消せません。")) return;
        startTransition(async () => {
            const result = await rejectRedevelopment(id);
            if (!result.success) alert(result.message);
        });
    };

    if (projects.length === 0) {
        return (
            <div className="bg-[#F9F9F7] rounded-xl p-12 text-center border border-[#E0E0E0]">
                <p className="text-[#4A544C] font-sans opacity-60">承認待ちのデータはありません。</p>
                <p className="text-[#708271] text-xs mt-2 font-sans opacity-50">All pending requests have been processed.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-[#E0E0E0] shadow-sm bg-white">
            <table className="w-full text-left text-sm font-sans">
                <thead className="bg-[#F9F9F7] text-[#4A544C] border-b border-[#E0E0E0]">
                    <tr>
                        <th className="px-6 py-4 font-normal opacity-70 tracking-widest text-xs">CREATED AT</th>
                        <th className="px-6 py-4 font-normal opacity-70 tracking-widest text-xs">STATION</th>
                        <th className="px-6 py-4 font-normal opacity-70 tracking-widest text-xs">PROJECT</th>
                        <th className="px-6 py-4 font-normal opacity-70 tracking-widest text-xs">SCHEDULE</th>
                        <th className="px-6 py-4 font-normal opacity-70 tracking-widest text-xs">IMPACT (AI)</th>
                        <th className="px-6 py-4 font-normal opacity-70 tracking-widest text-xs text-right">ACTIONS</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F0]">
                    {projects.map((project) => (
                        <tr key={project.id} className="hover:bg-[#708271]/5 transition-colors group text-[#4A544C]">
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-feature-settings-tnum text-[#A0A0A0]">
                                {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                            </td>
                            <td className="px-6 py-4 font-bold whitespace-nowrap">
                                {project.stationName}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium mb-1">{project.projectName}</div>
                                <a
                                    href={project.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-[#708271] hover:underline flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                                >
                                    Source Link ↗
                                </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs">
                                {project.schedule}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${project.aiImpact.includes("S") || project.aiImpact.includes("A")
                                    ? "bg-green-50 text-[#708271] border-green-100"
                                    : "bg-gray-50 text-gray-500 border-gray-100"
                                    }`}>
                                    {project.aiImpact}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                                <button
                                    onClick={() => handleApprove(project.id)}
                                    disabled={isPending}
                                    className="text-xs font-bold text-[#708271] px-4 py-1.5 rounded-full border border-[#708271] hover:bg-[#708271] hover:text-white transition-all disabled:opacity-30"
                                >
                                    承認
                                </button>
                                <button
                                    onClick={() => handleReject(project.id)}
                                    disabled={isPending}
                                    className="text-xs font-bold text-[#C0392B] px-4 py-1.5 rounded-full border border-[#C0392B]/30 hover:bg-[#C0392B] hover:text-white transition-all disabled:opacity-30"
                                >
                                    却下
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
