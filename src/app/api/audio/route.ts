import { NextRequest } from "next/server"

const audioCache = new Map<string, { url: string | null; timestamp: number }>()
const AUDIO_CACHE_TTL = 30 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source")
  const id = searchParams.get("id")

  if (source !== "netease" || !id) {
    return Response.json({ url: null })
  }

  const cacheKey = `${source}:${id}`
  const cached = audioCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < AUDIO_CACHE_TTL) {
    return Response.json({ url: cached.url })
  }

  const urls = [
    `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
    `https://music.163.com/song/media/outer/url?id=${id}`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          Referer: "https://music.163.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })
      if (res.ok && res.url && !res.url.includes("music.163.com/song/media/outer")) {
        audioCache.set(cacheKey, { url: res.url, timestamp: Date.now() })
        return Response.json({ url: res.url })
      }
    } catch { /* next url */ }
  }

  audioCache.set(cacheKey, { url: null, timestamp: Date.now() })
  return Response.json({ url: null })
}
