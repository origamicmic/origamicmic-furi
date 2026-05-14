import type { SongResult } from "@/types"
import { GeniusSource } from "./genius"
import { NeteaseSource } from "./netease"
import { LyricsOvhSource } from "./lyricsovh"
import type { LyricsSource } from "./types"

function buildSources(geniusToken: string): LyricsSource[] {
  const s: LyricsSource[] = []
  if (geniusToken) s.push(new GeniusSource(geniusToken))
  s.push(new NeteaseSource())
  s.push(new LyricsOvhSource())
  return s
}

export async function searchAllSources(query: string, geniusToken: string): Promise<SongResult[]> {
  const sources = buildSources(geniusToken)

  const results = await Promise.allSettled(
    sources.map((s) => s.search(query))
  )

  const sourceResults: SongResult[][] = results.map((r) =>
    r.status === "fulfilled" ? r.value : []
  )

  const maxLen = Math.max(...sourceResults.map((s) => s.length), 0)

  const interleaved: SongResult[] = []
  for (let i = 0; i < maxLen; i++) {
    for (const songs of sourceResults) {
      if (i < songs.length) interleaved.push(songs[i])
    }
  }

  const seen = new Set<string>()
  return interleaved.filter((song) => {
    const key = `${song.title}-${song.artist}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function fetchLyricsFromSource(song: SongResult, geniusToken: string): Promise<string> {
  const sources = buildSources(geniusToken)

  // Try primary source
  for (const source of sources) {
    if (source.name === song.source) {
      try { return await source.fetchLyrics(song.id) } catch { break }
    }
  }

  // Fallback: try lyricsovh with artist|title
  for (const source of sources) {
    if (source.name === "lyricsovh") {
      try {
        return await source.fetchLyrics(`${song.artist}|${song.title}`)
      } catch {}
    }
  }

  throw new Error(`Source "${song.source}" not available`)
}
