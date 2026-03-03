import type { Metadata } from "next";
import { Noto_Sans_JP, Zen_Old_Mincho } from "next/font/google"; // Updated fonts
import Script from "next/script";
import "./globals.css";

// Body Text
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Headings (Zen Old Mincho)
const zenOldMincho = Zen_Old_Mincho({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "あの街の成績表",
  description: "住宅の一次取得層に向け、過去の公的データ（公示地価、人口推計、ハザード等）を活用し、特定の駅・エリアにおける不動産購入の適正を客観的に診断するアプリです。失敗しないデータ駆動の街選びをサポートします。",
  openGraph: {
    images: ["/og-default.png"],
  },
  icons: {
    icon: "/favicon.png",
  },
};

import Footer from "../components/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} ${zenOldMincho.variable} font-sans min-h-screen flex flex-col bg-[#FDFBF7] text-[#4A544C] overflow-x-hidden`}>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        <div className="flex-grow">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
