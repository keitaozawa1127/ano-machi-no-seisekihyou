import { NextResponse } from "next/server";
import { diagnoseAsync, DiagnoseNgResponse } from "../../../lib/diagnoseLogic";

// Force Turbopack invalidate
export const dynamic = 'force-dynamic';

// Input Parser
async function parseInput(req: Request): Promise<{ stationName: string; prefCode: string; year: number | null }> {
    try {
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
            const body = (await req.json()) as { stationName?: unknown; prefCode?: unknown; year?: unknown };
            const stationName = typeof body.stationName === "string" ? body.stationName : "";
            const prefCode = typeof body.prefCode === "string" ? body.prefCode : "13";
            const year = typeof body.year === "number" ? body.year : null;
            return { stationName, prefCode, year };
        }
    } catch { /* ignore */ }

    // Fallback to query params
    const url = new URL(req.url);
    return {
        stationName: url.searchParams.get("stationName") ?? "",
        prefCode: url.searchParams.get("prefCode") ?? "13",
        year: Number(url.searchParams.get("year")) || null
    };
}

export async function GET(req: Request) {
    try {
        const { stationName, prefCode, year } = await parseInput(req);
        const y = year ?? 2024;

        const result = await diagnoseAsync(stationName, prefCode, y);
        const status = result.ok ? 200 : 400;
        return NextResponse.json(result, { status });
    } catch (e) {
        console.error("[/api/diagnose GET] Unexpected error:", e);
        return NextResponse.json(
            { ok: false, error: "サーバー側でエラーが発生しました" } satisfies DiagnoseNgResponse,
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const { stationName, prefCode, year } = await parseInput(req);
        const y = year ?? 2024;

        const result = await diagnoseAsync(stationName, prefCode, y);
        const status = result.ok ? 200 : 400;
        return NextResponse.json(result, { status });
    } catch (e) {
        console.error("[/api/diagnose POST] Unexpected error:", e);
        return NextResponse.json(
            { ok: false, error: "サーバー側でエラーが発生しました" } satisfies DiagnoseNgResponse,
            { status: 500 }
        );
    }
}

// Trigger rebuild
