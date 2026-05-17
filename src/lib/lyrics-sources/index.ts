import type { SongResult } from "@/types"
import { GeniusSource } from "./genius"
import { NeteaseSource } from "./netease"
import { LrcLibSource } from "./lrclib"
import type { LyricsSource } from "./types"

const JAPANESE_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/
const KANA_REGEX = /[\u3040-\u309f\u30a0-\u30ff]/

function logErr(source: string, e: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${source}]`, e instanceof Error ? e.message : String(e))
  }
}

function buildSources(geniusToken: string): LyricsSource[] {
  const s: LyricsSource[] = []
  if (geniusToken) s.push(new GeniusSource(geniusToken))
  s.push(new NeteaseSource())
  s.push(new LrcLibSource())
  return s
}

export async function searchAllSources(query: string, geniusToken: string): Promise<SongResult[]> {
  const sources = buildSources(geniusToken)
  const isJapanese = JAPANESE_REGEX.test(query)

  const results = await Promise.allSettled(
    sources.map((s) => s.search(query))
  )

  const sourceResults: SongResult[][] = results.map((r) =>
    r.status === "fulfilled" ? r.value : []
  )

  // For Japanese queries, prioritize Netease results first, then Genius with Japanese filtering
  let ordered: SongResult[][] = sourceResults
  if (isJapanese && sourceResults.length >= 2) {
    // Find source indices by name (robust against buildSources order changes)
    let neteaseIdx = -1
    let geniusIdx = -1
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].name === "netease") neteaseIdx = i
      if (sources[i].name === "genius") geniusIdx = i
    }
    // Reorder: Netease first, Genius second, LRCLIB last
    ordered = sourceResults.map(() => [] as SongResult[])
    if (neteaseIdx >= 0) ordered[0] = sourceResults[neteaseIdx]
    if (geniusIdx >= 0) ordered[1] = sourceResults[geniusIdx]
    ordered[ordered.length - 1] = sourceResults.find((_, i) =>
      sources[i]?.name === "lrclib"
    ) ?? []
    // Filter Genius results to only include ones with Japanese title/artist
    if (geniusIdx >= 0) {
      ordered[1] = ordered[1].filter(
        (s) => JAPANESE_REGEX.test(s.title) || JAPANESE_REGEX.test(s.artist)
      )
    }
  }

  const maxLen = Math.max(...ordered.map((s) => s.length), 0)

  const interleaved: SongResult[] = []
  for (let i = 0; i < maxLen; i++) {
    for (const songs of ordered) {
      if (i < songs.length) interleaved.push(songs[i])
    }
  }

  const seen = new Set<string>()
  return interleaved.filter((song) => {
    const key = `${song.title}|${song.artist}`
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
      try {
        const lyrics = await source.fetchLyrics(song.id)
        if (KANA_REGEX.test(lyrics)) return lyrics
      } catch (e) { logErr(source.name, e) }
    }
  }

  // Fallback: try netease search by title+artist (better Japanese coverage)
  for (const source of sources) {
    if (source.name === "netease") {
      try {
        const searchResults = await source.search(`${song.title} ${song.artist}`)
        if (searchResults.length > 0) {
          try {
            const lyrics = await source.fetchLyrics(searchResults[0].id)
            if (KANA_REGEX.test(lyrics)) return lyrics
          } catch (e) { logErr("netease-fallback-1", e) }
          // Try second result if first fails
          if (searchResults.length > 1) {
            try {
              const lyrics = await source.fetchLyrics(searchResults[1].id)
              if (KANA_REGEX.test(lyrics)) return lyrics
            } catch (e) { logErr("netease-fallback-2", e) }
          }
        }
      } catch (e) { logErr("netease-search", e) }
    }
  }

  // Fallback: try lrclib with artist|title
  for (const source of sources) {
    if (source.name === "lrclib") {
      try {
        const lyrics = await source.fetchLyrics(`${song.artist}|${song.title}`)
        if (KANA_REGEX.test(lyrics)) return lyrics
      } catch (e) { logErr("lrclib", e) }
    }
  }

  // Final fallback: try genius search
  for (const source of sources) {
    if (source.name === "genius") {
      try {
        const searchResults = await source.search(`${song.title} ${song.artist}`)
        if (searchResults.length > 0) {
          return source.fetchLyrics(searchResults[0].id)
        }
      } catch (e) { logErr("genius", e) }
    }
  }

  throw new Error(`Source "${song.source}" not available`)
}
