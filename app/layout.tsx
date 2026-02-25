import type { Metadata } from "next";
import { Noto_Sans_JP, Zen_Old_Mincho } from "next/font/google"; // Updated fonts
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
  title: "あの街の成績表 | 失敗しない街選び診断",
  description: "地価・治安・利便性を多角的にスコア化。初めての住宅購入で失敗しないための街選び診断サイト",
};

import Footer from "../components/Footer";
import Header from "../components/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} ${zenOldMincho.variable} font-sans min-h-screen flex flex-col bg-[#FDFBF7] text-[#4A544C]`}>
        <Header />
        <div className="flex-grow">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
