import type { SongResult } from "@/types"
import type { LyricsSource } from "./types"

const NETEASE_API = "https://music.163.com/api"

export class NeteaseSource implements LyricsSource {
  name = "netease"

  async search(query: string): Promise<SongResult[]> {
    const res = await fetch(
      `${NETEASE_API}/search/get?s=${encodeURIComponent(query)}&type=1&limit=20`,
      { headers: { Referer: "https://music.163.com" } }
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
    const res = await fetch(
      `${NETEASE_API}/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`,
      { headers: { Referer: "https://music.163.com" } }
    )

    if (!res.ok) {
      throw new Error(`Netease lyrics fetch failed: ${res.status}`)
    }

    const data = await res.json()
    const lyric = data.lrc?.lyric

    if (typeof lyric === "string" && lyric.length > 0) {
      return this.parseLrc(lyric)
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
