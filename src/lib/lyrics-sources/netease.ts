import type { SongResult } from "@/types"
import type { LyricsSource } from "./types"
import crypto from "crypto"

const NETEASE_API = "https://music.163.com/api"

const EAPI_KEY = process.env.EAPI_KEY || "e82ckenh8dichen8"

function eapiEncrypt(path: string, body: Record<string, unknown>): string {
  const text = JSON.stringify(body)
  const message = `nobody${path}use${text}md5forencrypt`
  const digest = crypto.createHash("md5").update(message, "utf8").digest("hex")
  const data = `${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  const cipher = crypto.createCipheriv("aes-128-ecb", EAPI_KEY, "")
  cipher.setAutoPadding(true)
  let encrypted = cipher.update(data, "utf8", "hex")
  encrypted += cipher.final("hex")
  return encrypted.toUpperCase()
}

const BROWSER_HEADERS: Record<string, string> = {
  "Referer": "https://music.163.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "ja;q=0.9,zh-CN,zh;q=0.8,en;q=0.7",
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
    // Priority 1: unencrypted GET endpoint
    const data = await this.fetchLyricsRaw(songId)
    const lyric = this.pickBestLyric(data)
    if (lyric) return lyric

    // Priority 2: EAPI encrypted POST endpoint (bypasses uncollected/sgc for some songs)
    try {
      const params = eapiEncrypt("/api/song/lyric", {
        id: songId,
        lv: 1,
        kv: 1,
        tv: -1,
      })
      const res = await fetch("https://interface3.music.163.com/eapi/song/lyric", {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": "os=pc",
        },
        body: `params=${encodeURIComponent(params)}`,
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const eapiData = await res.json()
        const eapiLyric = this.pickBestLyric(eapiData)
        if (eapiLyric) return eapiLyric
      }
    } catch {}

    // Fallback: check nolyric flag for better error message
    if (data.nolyric === false) {
      throw new Error("Lyrics locked (requires login)")
    }

    throw new Error("No lyrics found on Netease")
  }

  private async fetchLyricsRaw(songId: string): Promise<Record<string, unknown>> {
    const res = await fetch(
      `${NETEASE_API}/song/lyric?id=${encodeURIComponent(songId)}&lv=1&kv=1`,
      { headers: BROWSER_HEADERS }
    )

    if (!res.ok) {
      throw new Error(`Netease lyrics fetch failed: ${res.status}`)
    }

    return res.json()
  }

  private pickBestLyric(data: Record<string, unknown>): string | null {
    const lrcLyric: string = (data.lrc as Record<string, string>)?.lyric || ""
    const kLyric: string = (data.klyric as Record<string, string>)?.lyric || ""
    const tLyric: string = (data.tlyric as Record<string, string>)?.lyric || ""

    const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff]/g
    const kanaDensity = (text: string): number => {
      if (!text) return 0
      const clean = text
        .replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "")
        .replace(/<\d+,\d+>/g, "")
      const total = clean.replace(/\s/g, "").length || 1
      return ((clean.match(KANA_RE) || []).length) / total
    }

    const candidates = [
      { text: lrcLyric, density: kanaDensity(lrcLyric) },
      { text: kLyric, density: kanaDensity(kLyric) },
      { text: tLyric, density: kanaDensity(tLyric) },
    ].filter(c => c.text)

    candidates.sort((a, b) => b.density - a.density)
    const lyric = candidates[0]?.text

    if (typeof lyric === "string" && lyric.length > 0) {
      return this.parseLrc(lyric)
    }

    return null
  }

  private parseLrc(lrc: string): string {
    return lrc
      .replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "")
      .replace(/<\d+,\d+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
}
