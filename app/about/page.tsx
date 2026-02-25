import { Metadata } from "next";
import { Caveat } from "next/font/google";

const caveat = Caveat({
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "あの街の成績表とは | 街選びの新しいものさし",
    description:
        "国や自治体の公的ファクトデータのみで、あの街の現在と未来をスコア化。人生最大の買い物を、誰かの主観に委ねない。",
};

// インラインSVGアイコンコンポーネント
function IconDatabase() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
    );
}

function IconTrendingUp() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </svg>
    );
}

function IconBarChart() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    );
}

// Urban Skyline Illustration (Modern Line Art / Non-overlapping)
function IllustrationTown() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 320 200"
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full max-w-[300px] h-auto mx-auto opacity-85"
        >
            {/* Background element (sun/moon) */}
            <circle cx="260" cy="45" r="22" fill="var(--text-primary)" stroke="none" opacity="0.08" />

            {/* Ground line */}
            <line x1="10" y1="170" x2="310" y2="170" stroke="var(--text-primary)" strokeWidth="1.5" opacity="0.4" />

            {/* Continuous foreground buildings (No overlapping lines) */}
            {/* Building 1 */}
            <path d="M20 170 v-40 h30 v40" opacity="0.6" />

            {/* Building 2 (Tower with slanted roof) */}
            <path d="M50 170 v-90 l15 -15 h25 v105" opacity="0.75" />
            <line x1="70" y1="80" x2="85" y2="80" opacity="0.4" />
            <line x1="70" y1="95" x2="85" y2="95" opacity="0.4" />
            <line x1="70" y1="110" x2="85" y2="110" opacity="0.4" />
            <line x1="70" y1="125" x2="85" y2="125" opacity="0.4" />

            {/* Building 3 (Square office) */}
            <path d="M90 170 v-60 h40 v60" opacity="0.6" />
            <rect x="100" y="125" width="8" height="12" opacity="0.3" />
            <rect x="115" y="125" width="8" height="12" opacity="0.3" />
            <rect x="100" y="145" width="8" height="12" opacity="0.3" />
            <rect x="115" y="145" width="8" height="12" opacity="0.3" />

            {/* Building 4 (Small connecting block) */}
            <path d="M130 170 v-30 h25 v30" opacity="0.5" />

            {/* Building 5 (Main Skyscraper with antenna) */}
            <path d="M155 170 v-110 h45 v110" opacity="0.8" />
            <path d="M165 60 h25 l-5 -15 h-15 z" opacity="0.8" />
            <line x1="177.5" y1="45" x2="177.5" y2="20" opacity="0.6" />
            <line x1="170" y1="170" x2="170" y2="60" opacity="0.3" />
            <line x1="185" y1="170" x2="185" y2="60" opacity="0.3" />

            {/* Building 6 (Medium block) */}
            <path d="M200 170 v-75 h35 v75" opacity="0.6" />

            {/* Building 7 (Right edge building) */}
            <path d="M235 170 v-45 l15 -10 h25 v55" opacity="0.5" />

            {/* Elements (Trees/Parks) */}
            <path d="M30 170 v-15 c-5-5-5-15 5-15 c5-5 15-5 20 5 c10 0 10 10 5 15 v10" stroke="var(--brand-main)" opacity="0.7" />
            <path d="M260 170 v-10 c-3-4-3-10 3-12 c4-3 10-3 14 3 c6 0 6 8 3 11 v8" stroke="var(--brand-main)" opacity="0.6" />
        </svg>
    );
}

export default function AboutPage() {
    const blobStyles = [
        { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
        { borderRadius: "40% 60% 60% 40% / 70% 50% 50% 30%" },
        { borderRadius: "50% 50% 40% 60% / 40% 60% 40% 60%" },
    ];

    return (
        <main className="min-h-screen w-full flex flex-col font-sans antialiased text-[var(--text-primary)] bg-[var(--bg-primary)] overflow-x-hidden">
            {/* ========================================================
        Section 1: Hero
        ======================================================== */}
            <div className="w-full">
                <div className="w-full max-w-5xl mx-auto text-left px-6">
                    <section className="pt-32 pb-24 md:pt-40 md:pb-32">
                        <div className="mb-12">
                            <h1
                                className="hero-title text-5xl md:text-6xl text-[var(--text-primary)] tracking-widest leading-[1.4] md:leading-[1.5] mb-8"
                                style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                            >
                                憧れのあの街、
                                <br className="hidden md:block" />
                                <span className="relative inline-block px-1 bg-gradient-to-t from-[var(--brand-main)]/40 to-transparent bg-[length:100%_35%] bg-no-repeat bg-bottom">
                                    スコア
                                </span>
                                何点だろう？
                            </h1>
                        </div>

                        <p
                            className="text-base md:text-lg text-[var(--text-primary)] tracking-widest leading-loose max-w-2xl opacity-80"
                            style={{ letterSpacing: "0.08em" }}
                        >
                            人生最大の買い物を、誰かの主観に委ねない。
                            <br />
                            噂や不確かな情報を排除し、国や自治体の確かなファクトデータのみで、あの街の現在と未来をスコア化します。
                        </p>
                    </section>
                </div>
            </div>

            {/* ========================================================
        Section 2: Problem（開発の背景）
        ======================================================== */}
            <div className="w-full mt-8 md:mt-16">
                <div className="w-full max-w-5xl mx-auto text-left px-6 pb-24 md:pb-32">
                    <section className="flex flex-col md:flex-row md:items-center gap-12 lg:gap-24">
                        <div className="flex-1">
                            <h2
                                className="text-2xl sm:text-3xl text-[var(--brand-main)] tracking-widest mb-12"
                                style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                            >
                                「本当にこの街でいいのか？」という、終わらない問い。
                            </h2>

                            <div
                                className="space-y-8 text-base md:text-lg text-[var(--text-primary)] leading-loose opacity-80"
                                style={{ letterSpacing: "0.06em" }}
                            >
                                <p>住宅購入は、人生で最も大きな買い物です。</p>
                                <p>
                                    しかし、物件の魅力は語られても、「その街自体が10年後どうなるのか」「災害リスクと資産価値のバランスは適正か」といった不都合な事実は、なかなか見えてきません。
                                </p>
                                <p>
                                    私たちは、あらゆる公的データを集約し、誰もがフラットな視点で街を評価できる「ものさし」を作る必要があると考えました。
                                </p>
                            </div>
                        </div>
                        <div className="w-full md:w-[320px] shrink-0 flex justify-center mt-12 md:mt-0">
                            <IllustrationTown />
                        </div>
                    </section>
                </div>
            </div>

            {/* ========================================================
        Section 3: Core Values（3つの約束） - Floating Card
        ======================================================== */}
            <div className="w-full py-12 px-4 sm:px-6">
                <div className="w-full max-w-5xl mx-auto bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-8 py-16 md:px-16 md:py-24 text-left">
                    <p className="text-sm tracking-[0.4em] text-[var(--brand-main)] mb-8 uppercase font-medium">
                        Core Values
                    </p>
                    <h2
                        className="text-3xl sm:text-4xl text-[var(--brand-main)] tracking-widest mb-16 md:mb-20"
                        style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                    >
                        3つの約束
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
                        <div>
                            <div className="text-[var(--brand-main)] mb-8">
                                <IconDatabase />
                            </div>
                            <h3
                                className="text-xl text-[var(--brand-main)] tracking-widest mb-6"
                                style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                            >
                                揺るぎない
                                <br />
                                「公的ファクト」
                            </h3>
                            <p
                                className="text-base text-[var(--text-primary)] leading-loose opacity-80"
                                style={{ letterSpacing: "0.06em" }}
                            >
                                国土交通省の公示地価や自治体のハザードマップなど、行政が公開する信頼性の高いデータのみを抽出。個人の主観や噂を排除した、客観的な現在地を示します。
                            </p>
                        </div>

                        <div>
                            <div className="text-[var(--brand-main)] mb-8">
                                <IconTrendingUp />
                            </div>
                            <h3
                                className="text-xl text-[var(--brand-main)] tracking-widest mb-6"
                                style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                            >
                                未来を予測する
                                <br />
                                「再開発データ」
                            </h3>
                            <p
                                className="text-base text-[var(--text-primary)] leading-loose opacity-80"
                                style={{ letterSpacing: "0.06em" }}
                            >
                                街の価値を左右する都市計画決定や、デベロッパーの公式発表を網羅。ワンタップで情報の裏取り（検索）ができる仕組みを備え、街の成長性を正確に捉えます。
                            </p>
                        </div>

                        <div>
                            <div className="text-[var(--brand-main)] mb-8">
                                <IconBarChart />
                            </div>
                            <h3
                                className="text-xl text-[var(--brand-main)] tracking-widest mb-6"
                                style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                            >
                                誰でもわかる
                                <br />
                                「成績表（スコア）」
                            </h3>
                            <p
                                className="text-base text-[var(--text-primary)] leading-loose opacity-80"
                                style={{ letterSpacing: "0.06em" }}
                            >
                                複雑に絡み合う膨大なデータを、独自のアルゴリズムで解析。資産性、安全性、利便性などをシンプルなスコアに変換し、直感的な比較を可能にしました。
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================
        Section 4: Transparency（信頼の根拠）
        ======================================================== */}
            <div className="w-full pt-20 pb-32">
                <div className="w-full max-w-5xl mx-auto text-left px-6">
                    <p className="text-sm tracking-[0.4em] text-[var(--brand-main)] mb-8 uppercase font-medium">
                        Transparency
                    </p>
                    <h2
                        className="text-3xl sm:text-4xl text-[var(--brand-main)] tracking-widest mb-24 md:mb-32 leading-relaxed"
                        style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                    >
                        徹底した「ファクト」へのこだわり。
                        <br className="hidden sm:block" />
                        評価の根拠は、すべて公開されています。
                    </h2>

                    <div className="space-y-24 md:space-y-32">
                        {/* 01 */}
                        <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 md:gap-12 items-start">
                            <div className="relative z-10 shrink-0 w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
                                <div
                                    className="absolute inset-0 bg-[var(--brand-main)] opacity-15 -z-10"
                                    style={blobStyles[0]}
                                />
                                <span
                                    className={`text-6xl md:text-7xl lg:text-[100px] text-[var(--brand-main)] opacity-50 leading-none ${caveat.className}`}
                                >
                                    01
                                </span>
                            </div>
                            <div className="mt-1 md:mt-4">
                                <h3
                                    className="text-xl sm:text-2xl text-[var(--brand-main)] tracking-widest mb-6"
                                    style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                                >
                                    揺るぎない過去・現在の公的データ
                                </h3>
                                <p
                                    className="text-base text-[var(--text-primary)] leading-loose opacity-80"
                                    style={{ letterSpacing: "0.06em" }}
                                >
                                    国土交通省の「公示地価・基準地価」に基づく精緻な価格推移や、各自治체가公表する「ハザードマップ（洪水・土砂・液状化等）」など、改ざんのできないオープンデータのみをベースに街の基礎体力を診断しています。
                                </p>
                            </div>
                        </div>

                        {/* 02 */}
                        <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 md:gap-12 items-start">
                            <div className="relative z-10 shrink-0 w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
                                <div
                                    className="absolute inset-0 bg-[var(--brand-main)] opacity-15 -z-10"
                                    style={blobStyles[1]}
                                />
                                <span
                                    className={`text-6xl md:text-7xl lg:text-[100px] text-[var(--brand-main)] opacity-50 leading-none ${caveat.className}`}
                                >
                                    02
                                </span>
                            </div>
                            <div className="mt-1 md:mt-4">
                                <h3
                                    className="text-xl sm:text-2xl text-[var(--brand-main)] tracking-widest mb-6"
                                    style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                                >
                                    噂を排除した「未来の再開発」の裏取り
                                </h3>
                                <p
                                    className="text-base text-[var(--text-primary)] leading-loose opacity-80"
                                    style={{ letterSpacing: "0.06em" }}
                                >
                                    街の将来性を大きく左右する再開発情報。当サービスでは、不確かな噂レベルの開発情報は一切スコアに反映しません。必ず「行政の都市計画決定」「環境アセスメント」「デベロッパーの公式発表」と照合し、正確なスペックや竣工時期が確定しているプロジェクトのみを評価対象としています。
                                </p>
                            </div>
                        </div>

                        {/* 03 */}
                        <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 md:gap-12 items-start">
                            <div className="relative z-10 shrink-0 w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
                                <div
                                    className="absolute inset-0 bg-[var(--brand-main)] opacity-15 -z-10"
                                    style={blobStyles[2]}
                                />
                                <span
                                    className={`text-6xl md:text-7xl lg:text-[100px] text-[var(--brand-main)] opacity-50 leading-none ${caveat.className}`}
                                >
                                    03
                                </span>
                            </div>
                            <div className="mt-1 md:mt-4">
                                <h3
                                    className="text-xl sm:text-2xl text-[var(--brand-main)] tracking-widest mb-6"
                                    style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                                >
                                    ご自身で確認できる「透明性」
                                </h3>
                                <p
                                    className="text-base text-[var(--text-primary)] leading-loose opacity-80"
                                    style={{ letterSpacing: "0.06em" }}
                                >
                                    情報の鮮度と透明性を保つため、各街の再開発データには独自の「検索キーワード」を付与しています。ワンタップで行政や公式の一次情報へ直接アクセスでき、ご自身でファクトチェックを行うことが可能です。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================
        Section 5: CTA（締め）
        ======================================================== */}
            <div className="w-full pb-32 pt-12">
                <div className="w-full max-w-5xl mx-auto px-6 text-center">
                    <h2
                        className="text-2xl sm:text-3xl text-[var(--brand-main)] tracking-widest mb-12"
                        style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                    >
                        まず、あなたの街を診断してみてください。
                    </h2>
                    <a
                        href="/"
                        className="inline-block px-12 py-5 bg-[var(--brand-main)] text-white text-lg tracking-widest hover:scale-105 hover:shadow-lg transition-all duration-300 rounded-full font-bold"
                        style={{ letterSpacing: "0.15em" }}
                    >
                        無料で診断する
                    </a>
                </div>
            </div>
        </main>
    );
}
