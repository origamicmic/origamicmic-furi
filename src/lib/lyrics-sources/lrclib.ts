import type { SongResult } from "@/types"
import type { LyricsSource } from "./types"

const LRCLIB_API = "https://lrclib.net/api"

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) origamicmic-furi/1.0",
  "Accept": "application/json",
}

export class LrcLibSource implements LyricsSource {
  name = "lrclib"

  async search(query: string): Promise<SongResult[]> {
    const res = await fetch(
      `${LRCLIB_API}/search?q=${encodeURIComponent(query)}`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) {
      throw new Error(`LRCLIB search failed: ${res.status}`)
    }
    const data = await res.json() as Array<{
      id: number; trackName: string; artistName: string
    }>
    return data.map((track) => ({
      id: `${track.artistName}|${track.trackName}`,
      title: track.trackName,
      artist: track.artistName,
      source: this.name,
    }))
  }

  async fetchLyrics(songId: string): Promise<string> {
    const parts = songId.split("|")
    const artist = parts[0] || ""
    const title = parts.slice(1).join("|") || ""
    if (!artist || !title) throw new Error("Missing artist/title for LRCLIB")

    const res = await fetch(
      `${LRCLIB_API}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`LRCLIB fetch failed: ${res.status}`)

    const data = await res.json() as {
      syncedLyrics?: string; plainLyrics?: string
    }

    const raw = data.syncedLyrics || data.plainLyrics
    if (!raw) throw new Error("LRCLIB empty lyrics")

    if (data.syncedLyrics) {
      return raw
        .replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    }
    return raw.trim()
  }
}
