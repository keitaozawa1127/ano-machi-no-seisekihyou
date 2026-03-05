import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Noto Serif JP を Google Fonts からサブセットで取得して TTF として返す
async function getFontData(text: string) {
    try {
        // OGPに表示する可能性のある全文字をサブセット化
        const subsetText = encodeURIComponent(text + '駅総合スコア判定推奨要注意確認見送/1001234567890');
        const url = `https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700&text=${subsetText}`;

        // 意図的に古いUser-Agentを指定し、WOFF2ではなくTTF形式のURLを含んだCSSを返却させる
        const cssResponse = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
            },
        });
        const css = await cssResponse.text();

        // CSSからTTFのURLを抽出
        const resource = css.match(/src: url\((.+)\) format\('(truetype|opentype)'\)/);

        if (resource && resource[1]) {
            const fontUrl = resource[1];
            // SVGやシングルクォートで囲まれている場合を考慮
            const cleanUrl = fontUrl.replace(/['"]/g, '');
            const res = await fetch(cleanUrl);
            return await res.arrayBuffer();
        }
    } catch (error) {
        console.error('Font fetch error:', error);
    }
    return null;
}

// Reactの機能を用いてデザイン済みのOGPを動的に生成するエンドポイント
export async function GET(request: Request) {
    try {
        const { searchParams, origin } = new URL(request.url);

        // クエリからパラメータを取得
        const station = searchParams.get('station') || 'あの街';
        const scoreStr = searchParams.get('score');
        const score = scoreStr ? parseInt(scoreStr, 10) : null;
        const verdict = searchParams.get('verdict') || '診断中';

        // Edge Runtimeではローカルファイルの読み込みに制限があるため、リクエスト元のオリジンURLから画像をフェッチ
        const bgUrl = `${origin}/og-bg.png`;

        // バッジの色を判定結果に応じて変更
        // 推奨 (Safe) はメインカラーのセージ、要確認 (Caution)・見送り (Risky) 等はテラコッタ
        let badgeBg = '#708271'; // (Brand Main: Muted Sage)
        if (verdict.includes('要確認') || verdict.includes('見送り')) {
            badgeBg = '#C98B6D'; // (Brand Accent: Terra Cotta)
        } else if (verdict.includes('注意')) {
            // アプリの世界観（北欧モダン・自然由来のくすみカラー）に合わせたアンバー（琥珀色）/マスタードイエロー
            badgeBg = '#DDA15E'; // Warm Amber/Mustard Yellow
        }

        // フォーマッティング: 駅名から「駅」を除外して文字長に応じたフォントサイズを決定
        const displayName = station.replace(/駅$/, '');
        let titleFontSize = 96;
        if (displayName.length > 8) {
            titleFontSize = 56;
        } else if (displayName.length > 5) {
            titleFontSize = 72;
        }

        // フォントデータの取得
        const fontData = await getFontData(station);

        // フォント指定を含むoptions
        const options: ConstructorParameters<typeof ImageResponse>[1] = {
            width: 1200,
            height: 630,
        };

        if (fontData) {
            options.fonts = [
                {
                    name: 'Noto Serif JP',
                    data: fontData,
                    style: 'normal',
                    weight: 700,
                },
            ];
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        backgroundColor: '#FDFBF7',
                        backgroundImage: `url(${bgUrl})`,
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        fontFamily: fontData ? '"Noto Serif JP", serif' : 'serif',
                    }}
                >
                    {/* ベース画像に溶け込ませるため、箱（backgroundColor・border等）を完全に削除して文字のみを配置 */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start', // 左揃えの徹底
                            justifyContent: 'center',
                            marginRight: '80px', // 右側の空白部分へ固定
                            width: '640px',
                        }}
                    >
                        {/* 駅名（メインの主役） */}
                        <h1
                            style={{
                                fontSize: titleFontSize, // 動的フォントサイズ
                                color: '#4A544C',
                                marginBottom: 40,
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textAlign: 'left', // 左揃え
                                margin: 0, // 余計なマージンをリセット
                                lineHeight: 1.1, // 長い駅名が改行された場合を考慮
                            }}
                        >
                            {displayName}
                        </h1>

                        {/* 判定バッジとスコアを横に並べる */}
                        {score !== null && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'baseline', // ベースラインの統一
                                    justifyContent: 'flex-start', // 左揃え
                                    marginTop: 10,
                                }}
                            >
                                {/* 判定バッジ */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        justifyContent: 'center',
                                        backgroundColor: badgeBg,
                                        color: '#FFFFFF',
                                        padding: '10px 28px', // padding調整
                                        borderRadius: '50px',
                                        fontSize: 32,
                                        fontWeight: 700,
                                        letterSpacing: '0.1em',
                                        marginRight: 32,
                                        boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)', // バッジは立体感を持たせる
                                        transform: 'translateY(-4px)', // ベースライン微調整
                                    }}
                                >
                                    {verdict}
                                </div>

                                {/* スコア */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'baseline',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 36,
                                            color: '#4A544C',
                                            marginRight: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        総合スコア
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 84,
                                            color: '#4A544C',
                                            fontWeight: 700,
                                            lineHeight: 1, // ベースライン調整のため1にする
                                        }}
                                    >
                                        {score}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 40,
                                            color: '#A3AFA6', // Muted text
                                            marginLeft: 8,
                                            fontWeight: 700,
                                        }}
                                    >
                                        / 100
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ),
            options
        );
    } catch (e: any) {
        console.error("Failed to generate OG image", e);
        return new Response('Failed to generate image', { status: 500 });
    }
}
