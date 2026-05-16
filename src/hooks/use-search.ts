"use client"

import { useState, useCallback, useRef } from "react"
import type { SongResult, LyricData } from "@/types"

export function useSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SongResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [lyricData, setLyricData] = useState<LyricData | null>(null)
  const [selectedSong, setSelectedSong] = useState<SongResult | null>(null)
  const [lyricsText, setLyricsText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQueryRef = useRef("")
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length === 0) {
      setResults([])
      latestQueryRef.current = ""
      setIsSearching(false)
      return
    }

    // Abort previous in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const queryKey = q.trim()
    latestQueryRef.current = queryKey
    setIsSearching(true)
    setError(null)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(queryKey)}`, {
        signal: controller.signal,
      })
      if (latestQueryRef.current !== queryKey) return
      if (!res.ok) {
        setError(`搜索请求失败 (${res.status})`)
        setResults([])
        return
      }
      const data = await res.json()
      if (latestQueryRef.current !== queryKey) return
      setResults(data.songs ?? [])
      if (data.error) setError(data.error)
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      if (latestQueryRef.current !== queryKey) return
      setError("搜索请求失败，请检查网络")
      setResults([])
    } finally {
      if (latestQueryRef.current === queryKey) setIsSearching(false)
    }
  }, [])

  const debouncedSearch = useCallback(
    (q: string) => {
      setQuery(q)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!q || q.trim().length === 0) {
        setResults([])
        latestQueryRef.current = ""
        setIsSearching(false)
        return
      }
      timerRef.current = setTimeout(() => search(q), 300)
    },
    [search]
  )

  const selectSong = useCallback(async (song: SongResult): Promise<boolean> => {
    setSelectedSong(song)
    setError(null)

    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return false
      }

      setLyricsText(data.lyrics)
      setLyricData({
        title: data.title,
        artist: data.artist,
        lines: [],
        source: song.source,
        sourceId: song.id,
      })
      return true
    } catch {
      setError("获取歌词失败")
      return false
    }
  }, [])

  const setPastedLyrics = useCallback(
    (text: string, title?: string, artist?: string) => {
      setLyricsText(text)
      setSelectedSong(null)
      setLyricData({
        title: title || "未知歌曲",
        artist: artist || "未知歌手",
        lines: [],
        source: "paste",
      })
    },
    []
  )

  return {
    query,
    results,
    isSearching,
    lyricData,
    selectedSong,
    lyricsText,
    error,
    setQuery,
    debouncedSearch,
    selectSong,
    search,
    setPastedLyrics,
    setLyricData,
    setLyricsText,
    setResults,
    setError,
  }
}
