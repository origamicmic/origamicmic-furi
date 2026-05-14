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

  try {
    const res = await fetch(
      `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
      {
        redirect: "manual",
        headers: {
          Referer: "https://music.163.com",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    )

    let finalUrl: string | null = null

    // Follow redirect chain to get actual CDN URL
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (location) {
        const redirectRes = await fetch(location, {
          redirect: "follow",
          headers: {
            Referer: "https://music.163.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        })
        finalUrl = redirectRes.url
      }
    } else if (res.ok) {
      finalUrl = res.url
    }

    audioCache.set(cacheKey, { url: finalUrl, timestamp: Date.now() })
    return Response.json({ url: finalUrl })
  } catch {
    return Response.json({ url: null })
  }
}
