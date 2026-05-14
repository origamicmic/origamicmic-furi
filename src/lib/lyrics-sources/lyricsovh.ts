import type { SongResult } from "@/types"
import type { LyricsSource } from "./types"
import { httpGet } from "./http"

export class LyricsOvhSource implements LyricsSource {
  name = "lyricsovh"

  async search(_query: string): Promise<SongResult[]> {
    return []
  }

  async fetchLyrics(songId: string): Promise<string> {
    const parts = songId.split("|")
    const artist = parts[0] || ""
    const title = parts[1] || ""

    if (!artist || !title) throw new Error("Missing artist/title for Lyrics.ovh")

    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const res = await httpGet(url, undefined, 8000)

    if (res.statusCode !== 200) throw new Error(`Lyrics.ovh failed: ${res.statusCode}`)

    const data = await res.json<{ lyrics?: string }>()
    const lyrics = data.lyrics?.trim()
    if (!lyrics) throw new Error("Lyrics.ovh empty response")

    return lyrics
  }
}
