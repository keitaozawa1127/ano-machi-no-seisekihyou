"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/admin/redevelopment";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const res = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl,
            });

            if (res?.error) {
                setError("認証に失敗しました。メールアドレスとパスワードを確認してください。");
            } else {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch (err) {
            setError("予期せぬエラーが発生しました。");
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-[#F9F9F7] text-[#4A544C] p-6">
            <div className="w-full max-w-md bg-white p-12 rounded-[2rem] shadow-xl border border-[var(--bg-primary)]/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#708271] to-[#ABC5A2] opacity-30"></div>

                <header className="mb-10 text-center">
                    <h1 className="text-3xl font-medium tracking-tight mb-2" style={{ fontFamily: '"Zen Old Mincho", serif' }}>
                        Admin Login
                    </h1>
                    <p className="text-[10px] text-[#A0A0A0] tracking-widest uppercase">
                        管理画面へのアクセス認証
                    </p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-[#708271] tracking-widest mb-2 font-sans">
                            EMAIL ADDRESS
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#F8F9FA] border border-[#E0E0E0] rounded-lg px-4 py-3 text-sm text-[#4A544C] placeholder-gray-300 focus:outline-none focus:border-[#708271] transition-colors font-sans"
                            placeholder="admin@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[#708271] tracking-widest mb-2 font-sans">
                            PASSWORD
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#F8F9FA] border border-[#E0E0E0] rounded-lg px-4 py-3 text-sm text-[#4A544C] placeholder-gray-300 focus:outline-none focus:border-[#708271] transition-colors font-sans"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="text-xs text-[#C0392B] bg-[#C0392B]/5 p-3 rounded-lg text-center font-bold">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-[#4A544C] text-white font-bold text-xs tracking-widest py-4 rounded-full hover:bg-[#3D453E] transition-all shadow-lg shadow-[#4A544C]/10 mt-4"
                    >
                        LOGIN
                    </button>

                    <p className="text-[10px] text-center text-[#A0A0A0] mt-6">
                        Protected by Secure Gateway
                    </p>
                </form>
            </div>
        </main>
    );
}
