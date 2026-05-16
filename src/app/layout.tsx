import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://furi.tomori.fyi/"),
  title: {
    default: "Origamicmic Furi | 日语歌词注音 · 罗马音转换",
    template: "%s | Origamicmic Furi",
  },
  description:
    "搜索或粘贴日语歌词，自动转换为平假名或罗马音。支持在线编辑汉字读音、高亮对照、导出 TXT/LRC。日语学习者必备工具。",
  keywords: [
    "日语歌词", "注音", "假名", "罗马音", "furigana", "romaji",
    "日语学习", "歌词转换", "汉字转假名", "歌词编辑",
  ],
  authors: [{ name: "Origamicmic" }],
  creator: "Origamicmic",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "Origamicmic Furi",
    title: "Origamicmic Furi | 日语歌词注音 · 罗马音转换",
    description:
      "搜索或粘贴日语歌词，自动转换为平假名或罗马音。支持在线编辑、高亮对照、导出 TXT/LRC。",
  },
  twitter: {
    card: "summary",
    title: "Origamicmic Furi | 日语歌词注音 · 罗马音转换",
    description:
      "搜索或粘贴日语歌词，自动转换为平假名或罗马音。日语学习者的歌词注音利器。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
