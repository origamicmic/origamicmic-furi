import { NextRequest } from "next/server"
import { searchAllSources } from "@/lib/lyrics-sources"

const cache = new Map<string, { songs: unknown[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

const RATE_LIMIT = 30
const RATE_WINDOW = 60_000
const counters = new Map<string, { count: number; resetAt: number }>()

function getIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() ?? "unknown"
}

export async function GET(request: NextRequest) {
  const ip = getIp(request)
  const now = Date.now()
  const entry = counters.get(ip)
  if (entry && now < entry.resetAt && entry.count >= RATE_LIMIT) {
    return Response.json({ error: "请求过于频繁，请稍后重试", songs: [] }, { status: 429 })
  }
  if (!entry || now > entry.resetAt) {
    counters.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
  } else {
    entry.count++
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.trim().length === 0) {
    return Response.json({ songs: [] })
  }

  const trimmed = query.trim()
  if (trimmed.length > 200) {
    return Response.json({ error: "搜索关键词过长" }, { status: 400 })
  }

  const cacheKey = trimmed.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Response.json({ songs: cached.songs })
  }

  const token = process.env.GENIUS_ACCESS_TOKEN?.trim() || ""

  try {
    const songs = await searchAllSources(trimmed, token)

    const JAPANESE_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/
    songs.sort((a, b) => {
      const aIsJP = JAPANESE_REGEX.test(a.title) || JAPANESE_REGEX.test(a.artist)
      const bIsJP = JAPANESE_REGEX.test(b.title) || JAPANESE_REGEX.test(b.artist)
      if (aIsJP && !bIsJP) return -1
      if (!aIsJP && bIsJP) return 1
      return 0
    })

    cache.set(cacheKey, { songs, timestamp: Date.now() })
    return Response.json({ songs })
  } catch (error) {
    console.error("Search error:", error instanceof Error ? error.message : String(error))
    return Response.json(
      { error: "搜索失败，请稍后重试", songs: [] },
      { status: 500 }
    )
  }
}
