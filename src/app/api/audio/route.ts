import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source")
  const id = searchParams.get("id")

  if (source !== "netease" || !id) return new Response(null, { status: 404 })

  for (const suffix of [".mp3", ""]) {
    try {
      const url = `https://music.163.com/song/media/outer/url?id=${id}${suffix}`
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "Referer": "https://music.163.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })

      const ct = (res.headers.get("content-type") || "").toLowerCase()
      const isAudio = ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream")
      const isCdn = !res.url.includes("music.163.com/song/media/outer")

      if (res.ok && res.body && isAudio && isCdn) {
        return new Response(res.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=1800" },
        })
      }
    } catch {}
  }

  return new Response(null, { status: 404 })
}
