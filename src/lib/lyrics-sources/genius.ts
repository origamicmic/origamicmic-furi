import type { SongResult } from "@/types"
import type { LyricsSource } from "./types"
import { httpGet } from "./http"

const GENIUS_API = "https://api.genius.com"

export class GeniusSource implements LyricsSource {
  name = "genius"
  private token: string

  constructor(token: string) {
    this.token = token.trim()
  }

  async search(query: string): Promise<SongResult[]> {
    const url = `${GENIUS_API}/search?q=${encodeURIComponent(query)}`
    const res = await httpGet(url, {
      Authorization: `Bearer ${this.token}`,
    }, 15000)

    if (res.statusCode !== 200) {
      throw new Error(`Genius search failed: ${res.statusCode}`)
    }

    const data = await res.json<{
      response?: { hits?: Array<{ result?: Record<string, unknown> }> }
    }>()
    const hits = data.response?.hits ?? []

    return hits.map((hit) => {
      const result = hit.result ?? {}
      const primaryArtist = result.primary_artist as Record<string, string> | undefined
      return {
        id: String(result.id),
        title: String(result.title),
        artist: primaryArtist?.name ?? "Unknown",
        source: this.name,
        thumbnail: String(result.song_art_image_thumbnail_url ?? ""),
      }
    })
  }

  async fetchLyrics(songId: string): Promise<string> {
    const dataUrl = `${GENIUS_API}/songs/${encodeURIComponent(songId)}`
    const res = await httpGet(dataUrl, {
      Authorization: `Bearer ${this.token}`,
    }, 20000)

    if (res.statusCode !== 200) {
      throw new Error(`Genius song fetch failed: ${res.statusCode}`)
    }

    const data = await res.json<{
      response?: { song?: { path?: string; url?: string } }
    }>()

    const song = data.response?.song
    const pagePath = song?.path || song?.url
    if (!pagePath || typeof pagePath !== "string" || !/^\//.test(pagePath)) throw new Error("No lyrics path found")

    const htmlRes = await httpGet(`https://genius.com${pagePath}`, {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    const html = await htmlRes.text()

    const lyricsText = extractLyricsFromHtml(html)
    if (!lyricsText.trim()) throw new Error("Could not extract lyrics from page")

    return lyricsText.replace(/\n{3,}/g, "\n\n")
  }
}

function extractLyricsFromHtml(html: string): string {
  // Strategy 1: data-lyrics-container divs (Genius leaf nodes — most reliable)
  const containerMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi)
  if (containerMatch) {
    return containerMatch
      .map(cleanHtmlBlock)
      .join("\n")
  }

  // Strategy 2: Lyrics__Container class (Genius v2023+)
  const lyricClassMatch = html.match(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)
  if (lyricClassMatch) {
    return lyricClassMatch
      .map(cleanHtmlBlock)
      .join("\n")
  }

  // Strategy 3: section/div with lyrics class
  const sectionMatch = html.match(/<(?:section|div)[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/(?:section|div)>/gi)
  if (sectionMatch) {
    return sectionMatch
      .map(cleanHtmlBlock)
      .join("\n")
  }

  // Strategy 4: __NEXT_DATA__ JSON with recursive search
  const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/i)
  if (jsonMatch) {
    try {
      const nextData = JSON.parse(jsonMatch[1])
      const lyricsResult = findLyricsInNextData(nextData)
      if (lyricsResult) return lyricsResult
    } catch { /* JSON parse failed */ }
  }

  return ""
}

function cleanHtmlBlock(block: string): string {
  return block
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim()
}

function findLyricsInNextData(obj: unknown, depth = 0): string | null {
  if (depth > 12 || !obj || typeof obj !== "object") return null

  // Direct match: array with string children (Genius lyrics tree)
  if (Array.isArray(obj)) {
    const hasStrings = obj.some(item => typeof item === "string")
    if (hasStrings) {
      const lines: string[] = []
      for (const item of obj) {
        if (typeof item === "string") {
          lines.push(item)
        } else if (item && typeof item === "object") {
          const nested = findLyricsInNextData(item, depth + 1)
          if (nested) return nested
        }
      }
      if (lines.length > 0) return lines.join("\n")
    }
    return null
  }

  // Check "children" key first (standard Genius structure)
  const record = obj as Record<string, unknown>
  if (record.children !== undefined) {
    const childResult = findLyricsInNextData(record.children, depth + 1)
    if (childResult) return childResult
  }

  // Recursively search all properties for lyrics-like data
  for (const key of Object.keys(record)) {
    if (key === "children") continue
    const val = record[key]
    if (val && typeof val === "object") {
      const result = findLyricsInNextData(val, depth + 1)
      if (result) return result
    }
  }

  return null
}
