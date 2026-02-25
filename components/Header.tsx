import Link from "next/link";

export default function Header() {
    return (
        <header className="w-full max-w-5xl mx-auto px-6 pt-10 pb-4">
            <nav className="flex justify-center md:justify-end gap-8 text-xs tracking-[0.2em] uppercase text-[var(--text-primary)] opacity-60">
                <Link
                    href="/"
                    className="hover:opacity-100 transition-opacity duration-300"
                >
                    Home
                </Link>
                <Link
                    href="/about"
                    className="hover:opacity-100 transition-opacity duration-300"
                >
                    About
                </Link>
                <Link
                    href="/terms"
                    className="hover:opacity-100 transition-opacity duration-300"
                >
                    Terms
                </Link>
            </nav>
        </header>
    );
}
