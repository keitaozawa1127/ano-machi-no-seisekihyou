import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json(
        { ok: false, error: "本APIはサーバーサイド処理廃止のため静的化されました。完全静的生成ページをご確認ください。" },
        { status: 400 }
    );
}

export async function POST() {
    return NextResponse.json(
        { ok: false, error: "本APIはサーバーサイド処理廃止のため静的化されました。" },
        { status: 400 }
    );
}

