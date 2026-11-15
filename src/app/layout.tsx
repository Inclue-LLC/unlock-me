import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { appUrl } from "@/lib/util";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "UNLOCK ME｜みんなで、欲しいものを解放する。", template: "%s｜UNLOCK ME" },
  description: "購入申込数量に応じて商品化や追加特典が段階的にUNLOCKされる、参加型ECプラットフォーム。",
  openGraph: { siteName: "UNLOCK ME", type: "website", locale: "ja_JP" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFF4F1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
