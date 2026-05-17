import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Bingbot", "Baiduspider", "Sogou", "360Spider"],
        allow: "/",
      },
      {
        userAgent: "*",
        disallow: "/api/",
      },
    ],
    sitemap: "https://furi.tomori.fyi/sitemap.xml",
  }
}
