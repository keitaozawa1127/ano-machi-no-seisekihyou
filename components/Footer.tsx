import Link from "next/link";

export default function Footer() {
    return (
        <footer className="mt-32 pb-24 text-center border-t border-[rgba(0,0,0,0.03)] pt-24">
            <div className="flex justify-center items-center mb-12 gap-16">
                <Link href="/" className="text-[10px] text-[#666] tracking-[0.3em] hover:text-black transition-colors">
                    HOME
                </Link>
                <Link href="/about" className="text-[10px] text-[#666] tracking-[0.3em] hover:text-black transition-colors">
                    ABOUT
                </Link>
                <Link href="/terms" className="text-[10px] text-[#666] tracking-[0.3em] hover:text-black transition-colors">
                    TERMS
                </Link>
            </div>
            <div className="max-w-2xl mx-auto px-6 text-xs text-gray-500 mt-8">
                <p className="font-bold text-gray-700 mb-1">※各データの詳細な出典・取得年次は、診断結果の各項目に記載しています。</p>
                <p>
                    本診断のデータ参照日：<span id="current-date">{new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日</span><br />
                    本診断は過去の公的データに基づく統計的な分析結果であり、将来の資産価値や個別の成約価格を保証するものではありません。<br />
                    実際の取引では、物件の個別要因（築年数、管理状況、階数など）により価格が大きく異なる場合があります。
                </p>
            </div>
        </footer>
    );
}
