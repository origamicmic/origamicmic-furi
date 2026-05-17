"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Header } from "@/components/layout/header"
import { Player } from "@/components/layout/player"
import { ModeSelector } from "@/components/search/mode-selector"
import { SearchBar } from "@/components/search/search-bar"
import { PasteInput } from "@/components/search/paste-input"
import { LyricsPanel } from "@/components/lyrics/lyrics-panel"
import { EditorPanel } from "@/components/lyrics/editor-panel"
import { EditPanel } from "@/components/editor/edit-panel"
import { ExportButton } from "@/components/export/export-button"
import { useKuroshiro, useConvert, forceKuroshiroReset } from "@/hooks/use-kuroshiro"
import { useSearch } from "@/hooks/use-search"
import { useCorrections } from "@/hooks/use-corrections"
import type { InputMode, ConvertMode } from "@/types"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const FROSTED = "bg-white/40 shadow-lg shadow-black/5 backdrop-blur-2xl ring-1 ring-white/50 dark:bg-zinc-900/40 dark:ring-white/10"

const BTN_BASE = "rounded-lg px-3 py-1.5 text-xs font-medium tracking-wider transition-all"
const BTN_ON = "bg-primary text-primary-foreground shadow-sm hover:bg-primary/80"
const BTN_OFF = "border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"

const KANA_KANJI_RE = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3400-\u4dbf]+/g

function extractJapaneseTitle(title: string): string {
  const blocks = title.match(KANA_KANJI_RE) ?? []
  return blocks.join(" ")
}

function cleanForMatch(s: string): string {
  return s
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function hasSubstringMatch(a: string, b: string): boolean {
  const ca = cleanForMatch(a)
  const cb = cleanForMatch(b)
  if (!ca || !cb) return false
  return ca.length >= 3 && cb.length >= 3 && (ca.includes(cb) || cb.includes(ca))
}

export default function Home() {
  const { error: kuroshiroError, ensureReady, retry } = useKuroshiro()
  const { lines, setLines, isConverting, convert, updateToken, resetGeneration } = useConvert(ensureReady)
  const search = useSearch()
  const { corrections, loadCorrections, submitCorrection } = useCorrections()
  const [showBackTop, setShowBackTop] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [inputMode, setInputMode] = useState<InputMode>("search")
  const [convertMode, setConvertMode] = useState<ConvertMode>("hiragana")
  const [highlightEnabled, setHighlightEnabled] = useState(true)
  const [editingEnabled, setEditingEnabled] = useState(false)
  const [selectedEditWord, setSelectedEditWord] = useState<{ surface: string; reading: string; lineIndex: number; tokenId: string } | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioFallbackUrl, setAudioFallbackUrl] = useState<string | null>(null)
  const [audioTitle, setAudioTitle] = useState("")
  const [audioArtist, setAudioArtist] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [noLyricsSongs, setNoLyricsSongs] = useState<Set<string>>(new Set())
  const [forceOpenSearch, setForceOpenSearch] = useState(0)
  const lastLyricsRef = useRef<string>("")
  const lastModeRef = useRef<ConvertMode>(convertMode)

  useEffect(() => {
    const check = () => {
      setIsNarrow(window.innerWidth < 1024)
      setIsMobile(window.innerWidth < 640)
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 300)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    let hiddenTime = 0

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenTime = Date.now()
      } else if (document.visibilityState === "visible" && hiddenTime > 0) {
        if (Date.now() - hiddenTime > 30000) {
          forceKuroshiroReset()
          retry()
          loadCorrections()
        }
        hiddenTime = 0
      }
    }

    window.addEventListener("pageshow", onPageShow)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("pageshow", onPageShow)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [retry, loadCorrections])

  const data = useMemo(
    () => ({
      title: search.lyricData?.title ?? "未知歌曲",
      artist: search.lyricData?.artist ?? "未知歌手",
      lines,
      source: search.lyricData?.source ?? "paste",
    }),
    [search.lyricData, lines]
  )

  useEffect(() => { loadCorrections() }, [loadCorrections])

  useEffect(() => {
    if (!search.lyricsText) return
    const text = search.lyricsText
    if (lastLyricsRef.current === text && lastModeRef.current === convertMode) return
    lastLyricsRef.current = text
    lastModeRef.current = convertMode
    convert(text, convertMode, corrections)
  }, [search.lyricsText, convertMode, corrections, convert])

  const handleSubmitCorrection = useCallback(
    async (c: { word: string; default_reading: string; user_reading: string; song_title?: string; artist?: string }) =>
      submitCorrection(c),
    [submitCorrection]
  )

  const handleReset = () => {
    resetGeneration()
    setLines([])
    lastLyricsRef.current = ""
    search.setResults([])
    search.setLyricData(null)
    search.setLyricsText(null)
    search.setError(null)
    setEditingEnabled(false)
    setSelectedEditWord(null)
    setAudioUrl(null)
    setAudioFallbackUrl(null)
    setAudioTitle("")
    setAudioArtist("")
  }

  const handleSelectSong = useCallback(
    async (song: { id: string; title: string; artist: string; source: string }) => {
      const key = `${song.source}-${song.id}`
      if (noLyricsSongs.has(key)) {
        search.setError("该歌曲没有歌词（可能是纯音乐）")
        setForceOpenSearch((n) => n + 1)
        return
      }
      const ok = await search.selectSong(song)
      if (!ok) {
        setNoLyricsSongs((prev) => new Set(prev).add(key))
        search.setError("该歌曲没有歌词（可能是纯音乐）")
        setForceOpenSearch((n) => n + 1)
        return
      }
      try {
        let neteaseId = song.source === "netease" ? song.id : null
        if (!neteaseId) {
          // Build a clean search query from Japanese characters in title + artist.
          // Genius titles can be long like "JPN (EN) - ARTIST (Romanized)",
          // so we extract only the kana/kanji blocks for Netease matching.
          const jpTitle = extractJapaneseTitle(song.title) || song.title
          const jpArtist = extractJapaneseTitle(song.artist) || song.artist
          const searchQuery = [jpTitle, jpArtist].filter(Boolean).join(" ")
          try {
            const r = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
            const d = await r.json()
            const match = (d.songs ?? []).find((s: { source: string; title: string }) =>
              s.source === "netease" &&
              (hasSubstringMatch(s.title, song.title) || hasSubstringMatch(s.title, jpTitle))
            )
            if (match) neteaseId = match.id
          } catch {}
        }
        if (neteaseId) {
          setAudioUrl(`/api/audio?id=${neteaseId}`)
          setAudioFallbackUrl(`https://music.163.com/song/media/outer/url?id=${neteaseId}`)
          setAudioTitle(song.title)
          setAudioArtist(song.artist)
        }
      } catch { /* no audio */ }
    },
    [search, noLyricsSongs]
  )

  const handleApplyEditReading = (reading: string) => {
    if (!selectedEditWord) return
    updateToken(selectedEditWord.lineIndex, selectedEditWord.tokenId, reading)
  }

  const hasLyrics = (lines.length > 0 || search.lyricsText !== null) && !kuroshiroError

  return (
      <div className="flex min-h-full flex-col bg-background">
      <Header onHomeClick={handleReset} audioUrl={audioUrl} audioFallbackUrl={audioFallbackUrl} audioTitle={audioTitle} audioArtist={audioArtist} hidePlayer={isNarrow && hasLyrics} />

      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="回到顶部"
          className="fixed right-4 top-20 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-black/20 transition-transform hover:scale-110"
        >
          <ArrowUp className="h-6 w-6" />
        </button>
      )}

      <main className="flex flex-1 flex-col">
        {!hasLyrics ? (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-8 px-4 pt-20">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-[0.08em] text-[oklch(0.45_0.06_40)] dark:text-[oklch(0.7_0.06_40)]"
                style={{ textShadow: "2px 2px 0 oklch(0.85_0.02_60 / 0.4)" }}>
                  Origamicmic Furi
              </h1>
              <p className="mt-3 text-sm tracking-[0.06em] text-muted-foreground/60">日语歌词注音 · 罗马音转换</p>
            </div>

            {kuroshiroError && (
              <div className="w-full rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                解析引擎加载失败，请重试
                <button onClick={() => { retry(); lastLyricsRef.current = "" }} className="ml-2 underline hover:no-underline">重试</button>
              </div>
            )}

            <ModeSelector mode={inputMode} onModeChange={setInputMode} />

            {inputMode === "search" ? (
              <div className="relative w-full pb-12">
                <SearchBar query={search.query} results={search.results} isSearching={search.isSearching}
                  onQueryChange={(q) => { search.debouncedSearch(q) }}
                  onSearchFocus={() => {
                    setSearchFocused(true)
                    if (search.query.trim().length > 0 && !search.isSearching) {
                      search.search(search.query)
                    }
                  }}
                  onSelect={handleSelectSong} error={search.error}
                  noLyricsSongs={noLyricsSongs} forceOpen={forceOpenSearch} />
              </div>
            ) : (
              <div className="w-full"><PasteInput onPaste={search.setPastedLyrics} /></div>
            )}
          </div>
        ) : (
          <div className={cn(
            "flex w-full flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-6",
            editingEnabled && !isNarrow ? "" : "mx-auto max-w-6xl"
          )}>
            {isNarrow && audioUrl && (
              <div className="flex justify-center">
                <Player src={audioUrl} title={audioTitle} artist={audioArtist || ""} fallbackSrc={audioFallbackUrl || undefined} />
              </div>
            )}
            {kuroshiroError && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                解析引擎加载失败，请重试
                <button onClick={() => { retry(); lastLyricsRef.current = "" }} className="ml-2 underline hover:no-underline">重试</button>
              </div>
            )}
            <div className={`flex items-center justify-between rounded-2xl px-5 py-2 ${FROSTED}`}>
              <span className="text-xs text-muted-foreground/50">{lines.length}行 · {data.source}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setHighlightEnabled((p) => !p)}
                  className={cn(BTN_BASE, highlightEnabled ? BTN_ON : BTN_OFF)}>高亮</button>
                <button onClick={() => setEditingEnabled((p) => !p)}
                  className={cn(BTN_BASE, editingEnabled ? BTN_ON : BTN_OFF)}>编辑</button>
                <ExportButton data={data} />
              </div>
            </div>

            <div className={cn(
              "flex flex-1 gap-4 overflow-hidden",
              isMobile ? "flex-col" : "flex-row"
            )}>
              <div className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl ${FROSTED}`}>
                <LyricsPanel lines={lines} title={data.title} artist={data.artist} highlightEnabled={highlightEnabled} />
              </div>
              <div className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl ${FROSTED}`}>
                <EditorPanel lines={lines} mode={convertMode} onModeChange={setConvertMode}
                  onTokenEdit={(i, tid, r) => updateToken(i, tid, r)}
                  isConverting={isConverting} onSubmitCorrection={handleSubmitCorrection}
                  songTitle={data.title} artist={data.artist}
                  editingEnabled={editingEnabled} highlightEnabled={highlightEnabled}
                  onWordSelect={setSelectedEditWord} />
              </div>

              {!isNarrow && (
                <div className={cn(
                  "flex flex-col overflow-hidden rounded-2xl transition-all duration-300",
                  editingEnabled ? "flex-1 min-w-0 opacity-100" : "w-0 opacity-0",
                  FROSTED
                )}>
                  {editingEnabled && (
                    <EditPanel
                      key={selectedEditWord ? `${selectedEditWord.tokenId}-${selectedEditWord.lineIndex}` : "empty"}
                      selectedWord={selectedEditWord}
                      onApplyReading={handleApplyEditReading}
                      onClose={() => { setEditingEnabled(false); setSelectedEditWord(null) }} />
                  )}
                </div>
              )}
            </div>

            {isNarrow && editingEnabled && (
              <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[55vh] flex-col rounded-t-3xl bg-white/95 shadow-2xl shadow-black/20 backdrop-blur-2xl ring-1 ring-white/50 dark:bg-zinc-900/95 dark:ring-white/10">
                <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
                  <span className="text-xs font-medium text-muted-foreground">编辑读音</span>
                  <button onClick={() => { setEditingEnabled(false); setSelectedEditWord(null) }}
                    className="text-muted-foreground/50 hover:text-foreground">✕</button>
                </div>
                <EditPanel
                  key={selectedEditWord ? `${selectedEditWord.tokenId}-${selectedEditWord.lineIndex}` : "empty-mobile"}
                  selectedWord={selectedEditWord}
                  onApplyReading={handleApplyEditReading}
                  onClose={() => { setEditingEnabled(false); setSelectedEditWord(null) }}
                  floating />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
