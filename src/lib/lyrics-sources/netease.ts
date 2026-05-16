import type { SongResult } from "@/types"
import type { LyricsSource } from "./types"

const NETEASE_API = "https://music.163.com/api"

const BROWSER_HEADERS: Record<string, string> = {
  "Referer": "https://music.163.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7",
}

export class NeteaseSource implements LyricsSource {
  name = "netease"

  async search(query: string): Promise<SongResult[]> {
    const res = await fetch(
      `${NETEASE_API}/search/get?s=${encodeURIComponent(query)}&type=1&limit=20`,
      { headers: BROWSER_HEADERS }
    )

    if (!res.ok) {
      throw new Error(`Netease search failed: ${res.status}`)
    }

    const data = await res.json()
    const songs = data.result?.songs ?? []

    return songs.map((song: Record<string, unknown>) => ({
      id: String(song.id),
      title: String(song.name),
      artist: (song.artists as Array<Record<string, string>>)
        ?.map((a: Record<string, string>) => a.name)
        .join(", ") ?? "Unknown",
      source: this.name,
    }))
  }

  async fetchLyrics(songId: string): Promise<string> {
    // Try primary lyrics endpoint
    const res = await fetch(
      `${NETEASE_API}/song/lyric?id=${encodeURIComponent(songId)}&lv=1&kv=1&tv=-1`,
      { headers: BROWSER_HEADERS }
    )

    if (!res.ok) {
      throw new Error(`Netease lyrics fetch failed: ${res.status}`)
    }

    const data = await res.json()
    const lrcLyric: string = data.lrc?.lyric || ""
    const tLyric: string = data.tlyric?.lyric || ""

    // Prefer lyrics that contain Japanese kana (hiragana/katakana).
    // Netease may return Chinese translations as the primary lyric;
    // the original Japanese version is often in the tlyric field.
    const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff]/
    const lyric = lrcLyric && KANA_RE.test(lrcLyric)
      ? lrcLyric
      : tLyric && KANA_RE.test(tLyric)
        ? tLyric
        : lrcLyric || tLyric

    if (typeof lyric === "string" && lyric.length > 0) {
      return this.parseLrc(lyric)
    }

    // Fallback: try uncolored lyrics (nolyric) if lrc is empty
    if (data.nolyric === false) {
      throw new Error("Lyrics locked (requires login)")
    }

    throw new Error("No lyrics found on Netease")
  }

  private parseLrc(lrc: string): string {
    return lrc
      .replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
}
