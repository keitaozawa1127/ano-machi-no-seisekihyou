"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function hasSessionCookie(): boolean {
    return document.cookie.split(";").some((c) => {
        const name = c.trim().split("=")[0];
        return (
            name === "next-auth.session-token" ||
            name === "__Secure-next-auth.session-token"
        );
    });
}

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (!hasSessionCookie()) {
            router.push("/login");
        } else {
            setChecked(true);
        }
    }, [router]);

    if (!checked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7]">
                <p className="text-sm text-[#A0A0A0] tracking-widest" style={{ fontFamily: '"Zen Old Mincho", serif' }}>
                    Loading...
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
