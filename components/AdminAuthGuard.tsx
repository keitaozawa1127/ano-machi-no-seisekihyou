"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
    const { status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7]">
                <p className="text-sm text-[#A0A0A0] tracking-widest" style={{ fontFamily: '"Zen Old Mincho", serif' }}>
                    Loading...
                </p>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    return <>{children}</>;
}
