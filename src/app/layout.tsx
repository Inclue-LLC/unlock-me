import type { Metadata, Viewport } from "next";
import { Poppins, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { appUrl } from "@/lib/util";

// POP BASE と同じ書体：英字 Poppins／日本語 Zen Kaku Gothic New（ビルド時に取得して自サイトから配信）
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-poppins", display: "swap" });
const zen = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-zen", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "UNLOCK ME｜みんなで、欲しいものを解放する。", template: "%s｜UNLOCK ME" },
  description: "購入申込数量に応じて商品化や追加特典が段階的にUNLOCKされる、参加型ECプラットフォーム。",
  openGraph: { siteName: "UNLOCK ME", type: "website", locale: "ja_JP" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/brand/unlockme-mark.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFAF8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${poppins.variable} ${zen.variable}`}>
      {/* ブラウザ拡張（ColorZilla など）が body に属性を足すことによる開発時の警告を抑える。body 直下の属性だけが対象 */}
      <body className="min-h-screen" suppressHydrationWarning>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
