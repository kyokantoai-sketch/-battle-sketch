import type { Metadata } from "next";
import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "描写バトルゲーム",
  description: "2人でモンスターを描写し、画像から勝敗と物語を生成する対戦アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
