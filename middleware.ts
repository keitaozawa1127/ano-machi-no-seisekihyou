export const runtime = 'experimental-edge';

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getRequestContext } from "@cloudflare/next-on-pages";

function getSecret(): string {
    try {
        const ctx = getRequestContext();
        return (ctx.env as Record<string, string>)["NEXTAUTH_SECRET"] || process.env.NEXTAUTH_SECRET || "";
    } catch {
        return process.env.NEXTAUTH_SECRET || "";
    }
}

export async function middleware(request: NextRequest) {
    const secret = getSecret();
    const token = await getToken({ req: request, secret });

    if (!token) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*"],
};
