import { Metadata } from 'next';
import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: '駅一覧 | あの街の成績表',
    description: 'あの街の成績表で診断可能な全国の駅一覧です。独自アルゴリズムを用いた不動産価値・将来性スコアを駅ごとに確認できます。',
};

type StationData = {
    name: string;
    prefecture: string;
    prefCode: string;
    lines: string[];
};

type GroupedStations = {
    [prefecture: string]: StationData[];
};

// データの読み込みとグループ化
async function getGroupedStations(): Promise<GroupedStations> {
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'stations.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const stationsRaw = JSON.parse(fileContent);

        const grouped: GroupedStations = {};

        for (const key in stationsRaw) {
            const station = stationsRaw[key];
            if (!station || !station.name || !station.prefecture) continue;

            const pref = station.prefecture;
            if (!grouped[pref]) {
                grouped[pref] = [];
            }
            grouped[pref].push({
                name: station.name,
                prefecture: station.prefecture,
                prefCode: String(station.prefCode).padStart(2, '0'),
                lines: station.lines || [],
            });
        }

        // 各都道府県内で、駅名を五十音順などを厳密にやるのはstations.jsonのキー順に依存。
        // ここでは単純に文字列ソート（漢字コード順になるが一定の整理にはなる）
        for (const pref in grouped) {
            grouped[pref].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        }

        return grouped;
    } catch (e) {
        console.error("Error loading stations.json for directory:", e);
        return {};
    }
}

export default async function StationsDirectoryPage() {
    const groupedStations = await getGroupedStations();

    // 表示順序を都道府県コード順などにソートするためキーを取り出す
    // 便宜上、北海道から順に表示するため、各県から1つのprefCodeを取り出してソート
    const sortedPrefectures = Object.keys(groupedStations).sort((prefA, prefB) => {
        const codeA = groupedStations[prefA][0]?.prefCode || "99";
        const codeB = groupedStations[prefB][0]?.prefCode || "99";
        return codeA.localeCompare(codeB);
    });

    return (
        <main className="min-h-screen w-full flex flex-col items-center pt-24 px-6 md:px-12 bg-[var(--bg-primary)] overflow-x-hidden">
            {/* Header Section */}
            <header className="w-full max-w-5xl text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <p className="text-sm md:text-base tracking-[0.2em] mb-4 text-[var(--text-muted)] font-serif">
                    あの街の成績表
                </p>
                <h1 className="text-3xl md:text-5xl font-medium tracking-widest text-[var(--brand-main)] font-serif mb-8">
                    診断可能な駅一覧
                </h1>
                <p className="text-sm md:text-base text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
                    全国の駅周辺のエリアデータを元に、住環境としての資産性・リスクを診断しています。<br className="hidden md:inline" />
                    各駅のページでは、人口推移やハザードリスク、地価動向の独自スコアをご確認いただけます。
                </p>
            </header>

            {/* Index Navigation (Japan Map Style) */}
            <nav className="w-full max-w-4xl mb-24 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                <div className="bg-white/40 p-6 md:p-10 rounded-3xl border border-[var(--border-main)]/30 backdrop-blur-md shadow-sm">
                    <h2 className="text-center text-sm md:text-base tracking-[0.2em] text-[var(--brand-main)] font-serif mb-10">
                        エリアから探す
                    </h2>

                    {/* Japan Map Grid (Simplified) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Hokkaido / Tohoku */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-main)]/50 pb-2 mb-3">北海道・東北</h3>
                            <div className="flex flex-wrap gap-2">
                                {['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'].map(p =>
                                    sortedPrefectures.includes(p) && (
                                        <Link key={`map-${p}`} href={`#${p}`} className="text-xs px-3 py-1.5 bg-white/60 hover:bg-[var(--brand-main)]/10 text-[var(--text-main)] hover:text-[var(--brand-main)] rounded-md transition-colors border border-[var(--border-main)]/50">{p}</Link>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Kanto */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-main)]/50 pb-2 mb-3">関東</h3>
                            <div className="flex flex-wrap gap-2">
                                {['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'].map(p =>
                                    sortedPrefectures.includes(p) && (
                                        <Link key={`map-${p}`} href={`#${p}`} className="text-xs px-3 py-1.5 bg-white/60 hover:bg-[var(--brand-main)]/10 text-[var(--text-main)] hover:text-[var(--brand-main)] rounded-md transition-colors border border-[var(--border-main)]/50">{p}</Link>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Chubu / Hokuriku */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-main)]/50 pb-2 mb-3">中部・北陸</h3>
                            <div className="flex flex-wrap gap-2">
                                {['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'].map(p =>
                                    sortedPrefectures.includes(p) && (
                                        <Link key={`map-${p}`} href={`#${p}`} className="text-xs px-3 py-1.5 bg-white/60 hover:bg-[var(--brand-main)]/10 text-[var(--text-main)] hover:text-[var(--brand-main)] rounded-md transition-colors border border-[var(--border-main)]/50">{p}</Link>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Kansai */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-main)]/50 pb-2 mb-3">近畿</h3>
                            <div className="flex flex-wrap gap-2">
                                {['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'].map(p =>
                                    sortedPrefectures.includes(p) && (
                                        <Link key={`map-${p}`} href={`#${p}`} className="text-xs px-3 py-1.5 bg-white/60 hover:bg-[var(--brand-main)]/10 text-[var(--text-main)] hover:text-[var(--brand-main)] rounded-md transition-colors border border-[var(--border-main)]/50">{p}</Link>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Chugoku / Shikoku */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-main)]/50 pb-2 mb-3">中国・四国</h3>
                            <div className="flex flex-wrap gap-2">
                                {['鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県'].map(p =>
                                    sortedPrefectures.includes(p) && (
                                        <Link key={`map-${p}`} href={`#${p}`} className="text-xs px-3 py-1.5 bg-white/60 hover:bg-[var(--brand-main)]/10 text-[var(--text-main)] hover:text-[var(--brand-main)] rounded-md transition-colors border border-[var(--border-main)]/50">{p}</Link>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Kyushu / Okinawa */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-main)]/50 pb-2 mb-3">九州・沖縄</h3>
                            <div className="flex flex-wrap gap-2">
                                {['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'].map(p =>
                                    sortedPrefectures.includes(p) && (
                                        <Link key={`map-${p}`} href={`#${p}`} className="text-xs px-3 py-1.5 bg-white/60 hover:bg-[var(--brand-main)]/10 text-[var(--text-main)] hover:text-[var(--brand-main)] rounded-md transition-colors border border-[var(--border-main)]/50">{p}</Link>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Station List Directory */}
            <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                {sortedPrefectures.map((pref) => (
                    <section key={pref} id={pref} className="mb-20 scroll-mt-24">
                        {/* Area Headings (Zen Old Mincho) */}
                        <div className="flex items-baseline mb-8 pb-2">
                            <h2 className="text-2xl md:text-3xl font-serif text-[var(--text-main)] tracking-widest pl-2 border-l-[3px] border-[var(--brand-main)] leading-none">
                                {pref}
                            </h2>
                            <span className="ml-4 text-sm text-[var(--text-muted)]">
                                ({groupedStations[pref].length} 駅)
                            </span>
                        </div>

                        {/* Stations Grid: No borders, pure whitespace optical alignment */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4 pl-3">
                            {groupedStations[pref].map((station, idx) => (
                                <Link
                                    key={`${station.name}-${idx}`}
                                    href={`/station/${encodeURIComponent(station.name)}`}
                                    className="group flex flex-col items-start transition-opacity hover:opacity-70"
                                >
                                    <span className="text-base font-medium text-[var(--text-main)] mb-1">
                                        {station.name}
                                    </span>
                                    {/* Primary line only for clean UI */}
                                    {station.lines && station.lines.length > 0 && (
                                        <span className="text-[10px] md:text-xs text-[var(--text-muted)] truncate w-full pr-2">
                                            {station.lines[0]} {station.lines.length > 1 ? `他` : ''}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 mb-24 w-full flex justify-center">
                <Link href="/" className="inline-flex items-center text-sm font-bold text-[var(--brand-main)] hover:opacity-70 transition-opacity">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    トップページへ戻る
                </Link>
            </div>
        </main>
    );
}
