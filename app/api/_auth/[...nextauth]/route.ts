export const runtime = "edge";

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getRequestContext } from "@cloudflare/next-on-pages";

function getEnv(key: string): string | undefined {
    try {
        const ctx = getRequestContext();
        return (ctx.env as Record<string, string | undefined>)[key];
    } catch {
        // ローカル開発環境などでは process.env にフォールバック
        return process.env[key];
    }
}

export function buildAuthOptions(): NextAuthOptions {
    return {
        providers: [
            CredentialsProvider({
                name: "Credentials",
                credentials: {
                    email: { label: "Email", type: "email" },
                    password: { label: "Password", type: "password" },
                },
                async authorize(credentials) {
                    const adminEmail = getEnv("ADMIN_EMAIL");
                    const adminPassword = getEnv("ADMIN_PASSWORD");

                    console.log("[NextAuth] authorize called");
                    console.log("[NextAuth] ADMIN_EMAIL defined:", !!adminEmail);
                    console.log("[NextAuth] ADMIN_PASSWORD defined:", !!adminPassword);
                    console.log("[NextAuth] input email:", credentials?.email);

                    if (!credentials?.email || !credentials?.password) {
                        console.log("[NextAuth] Missing credentials");
                        return null;
                    }

                    if (
                        credentials.email === adminEmail &&
                        credentials.password === adminPassword
                    ) {
                        console.log("[NextAuth] Auth success");
                        return { id: "1", name: "Admin", email: credentials.email };
                    }

                    console.log("[NextAuth] Auth failed: credentials mismatch");
                    return null;
                },
            }),
        ],
        pages: {
            signIn: "/login",
        },
        session: {
            strategy: "jwt",
        },
        secret: getEnv("NEXTAUTH_SECRET"),
    };
}

export const authOptions = buildAuthOptions();

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
