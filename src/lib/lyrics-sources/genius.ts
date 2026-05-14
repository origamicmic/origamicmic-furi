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
    const dataUrl = `${GENIUS_API}/songs/${songId}`
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
    if (!pagePath) throw new Error("No lyrics path found")

    const htmlRes = await httpGet(`https://genius.com${pagePath}`, {
      Authorization: `Bearer ${this.token}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    const html = await htmlRes.text()

    // Primary: data-lyrics-container
    let match = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi)
    // Fallback: Lyrics__Container class (Genius v2023+)
    if (!match) match = html.match(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)
    // Fallback: section with lyrics class
    if (!match) match = html.match(/<section[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/section>/gi)
    // Fallback: extract text from pre/lyrics content blocks
    if (!match) match = html.match(/<div[^>]*(?:data-lyrics|lyrics)[^>]*>([\s\S]*?)<\/div>/gi)
    if (!match) throw new Error("Could not extract lyrics from page")

    return match
      .map((block: string) =>
        block
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .trim()
      )
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
  }
}
