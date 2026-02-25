import React from 'react';

export default function TermsPage() {
    return (
        <main className="pt-24 pb-32 px-6 max-w-3xl mx-auto">
            <h1 className="text-3xl font-[family-name:var(--font-title)] font-bold text-center mb-12 border-b border-[rgba(0,0,0,0.1)] pb-6">
                利用規約・免責事項
            </h1>

            <div className="space-y-10 text-sm leading-8 text-gray-700">
                <section>
                    <h2 className="text-xl font-bold mb-4 text-black border-l-4 border-[#3D5B43] pl-3">
                        目的と情報の性質について
                    </h2>
                    <p>
                        「あの街の成績表」（以下、当サイト）は、公的なオープンデータ（国土交通省、国立社会保障・人口問題研究所等）を活用し、独自のアルゴリズムに基づき算出された「街の診断スコア」や各種分析データを提供するサービスです。本サービスが提供する情報はあくまで統計的な傾向や過去の事実に基づく参考値であり、個別の不動産の成約価格や将来の資産価値、安全性を確約または保証するものではありません。
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4 text-black border-l-4 border-[#3D5B43] pl-3">
                        自己責任の原則
                    </h2>
                    <p>
                        当サイトの情報を用いて行う一切の行動（不動産の購入、売却、賃貸、投資等）は、ユーザーご自身の判断と責任において行ってください。実際の不動産取引においては、物件の個別要因（築年数、管理状況、階数、権利関係など）により価格が大きく変動します。当サイトの情報を利用したことによってユーザーに生じたいかなる損害（直接的、間接的を問わず）についても、運営者は一切の責任を負いません。
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4 text-black border-l-4 border-[#3D5B43] pl-3">
                        ハザードリスクについて
                    </h2>
                    <p>
                        当サイト内で表示される災害リスク（水害、土砂災害等）は、国土交通省のハザードマップデータ等に基づき算出されていますが、その精度や網羅性を完全に保証するものではありません。また、これらに含まれない災害リスク（地震、津波、液状化など）が存在する可能性もあります。具体的な土地の危険性については、必ず各自治体が発行する最新のハザードマップ等の公式情報をご自身でご確認ください。
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4 text-black border-l-4 border-[#3D5B43] pl-3">
                        サービスの内容変更・中断
                    </h2>
                    <p>
                        当サイトは、ユーザーへ事前に通知することなく、算定アルゴリズムの調整、提供データの変更、あるいはサービス自体の提供を中断または終了することができるものとします。これによって生じた損害についても、運営者は一切の責任を負いません。
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4 text-black border-l-4 border-[#3D5B43] pl-3">
                        情報の正確性と更新
                    </h2>
                    <p>
                        データの取得や解析処理には細心の注意を払っておりますが、情報の正確性、完全性、最新性を保証するものではありません。特に、将来人口推計や再開発計画などのデータは、行政機関等の発表から実際の更新までタイムラグが発生する場合があります。
                    </p>
                </section>

                <div className="pt-8 text-right text-xs text-gray-500">
                    <p>制定日：{new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日</p>
                </div>
            </div>
        </main>
    );
}
