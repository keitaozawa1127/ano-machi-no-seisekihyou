import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        { ok: false, error: "本APIはサーバーサイド処理廃止のため静的化されました。/stations ページをご確認ください。" },
        { status: 400 }
    );
}
