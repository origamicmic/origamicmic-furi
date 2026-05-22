import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MouseFollowProvider } from "@/components/layout/mouse-follow-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.svg", type: "image/svg+xml" }],
  },
  title: {
    default: "Origamicmic Furi | 日语歌词注音 · 罗马音转换",
    template: "%s | Origamicmic Furi",
  },
  description:
    "搜索或粘贴日语歌词，自动标注平假名与罗马音。Kuromoji + Kuroshiro 引擎，支持高亮对照、在线编辑汉字读音、一键导出 TXT/LRC。日语学习者必备的歌词注音工具。",
  keywords: [
    "日语歌词", "注音", "假名", "罗马音", "furigana", "romaji",
    "日语学习", "歌词转换", "汉字转假名", "歌词编辑", "振り仮名",
    "日语注音工具", "歌词假名标注", "日语汉字读音查询",
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
      "搜索或粘贴日语歌词，自动标注平假名与罗马音。支持在线编辑、高亮对照、导出 TXT/LRC。",
    images: [{ url: "/icon.svg", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "Origamicmic Furi | 日语歌词注音 · 罗马音转换",
    description:
      "搜索或粘贴日语歌词，自动标注平假名与罗马音。日语学习者的歌词注音利器。",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Origamicmic Furi",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
              description:
                "日语歌词自动注音工具——搜索或粘贴日语歌词，通过 Kuromoji + Kuroshiro 引擎自动转换为平假名或罗马音。支持在线编辑汉字读音、高亮对照、导出 TXT/LRC 等格式。",
              applicationCategory: "EducationalApplication",
              operatingSystem: "All",
              offers: { "@type": "Offer", price: "0" },
              inLanguage: ["ja", "zh"],
              browserRequirements: "Requires JavaScript",
              featureList: [
                "日语汉字自动转平假名",
                "汉字转罗马音",
                "在线编辑读音",
                "原文注音高亮对照",
                "多格式导出（TXT/LRC）",
              ],
            }),
          }}
        />
        <ThemeProvider>
          <MouseFollowProvider />
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
