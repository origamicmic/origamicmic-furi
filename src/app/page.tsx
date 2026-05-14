"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Header } from "@/components/layout/header"
import { ModeSelector } from "@/components/search/mode-selector"
import { SearchBar } from "@/components/search/search-bar"
import { PasteInput } from "@/components/search/paste-input"
import { LyricsPanel } from "@/components/lyrics/lyrics-panel"
import { EditorPanel } from "@/components/lyrics/editor-panel"
import { EditPanel } from "@/components/editor/edit-panel"
import { ExportButton } from "@/components/export/export-button"
import { useKuroshiro, useConvert } from "@/hooks/use-kuroshiro"
import { useSearch } from "@/hooks/use-search"
import { useCorrections } from "@/hooks/use-corrections"
import type { InputMode, ConvertMode } from "@/types"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const FROSTED = "bg-white/40 shadow-lg shadow-black/5 backdrop-blur-2xl ring-1 ring-white/50 dark:bg-zinc-900/40 dark:ring-white/10"

const BTN_BASE = "rounded-lg px-3 py-1.5 text-xs font-medium tracking-wider transition-all"
const BTN_ON = "bg-primary text-primary-foreground shadow-sm hover:bg-primary/80"
const BTN_OFF = "border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"

export default function Home() {
  const { isReady: kuroshiroReady, error: kuroshiroError } = useKuroshiro()
  const { lines, setLines, isConverting, convert, updateToken } = useConvert()
  const search = useSearch()
  const { corrections, loadCorrections, submitCorrection } = useCorrections()
  const [showBackTop, setShowBackTop] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [inputMode, setInputMode] = useState<InputMode>("search")
  const [convertMode, setConvertMode] = useState<ConvertMode>("hiragana")
  const [highlightEnabled, setHighlightEnabled] = useState(true)
  const [editingEnabled, setEditingEnabled] = useState(false)
  const [selectedEditWord, setSelectedEditWord] = useState<{ surface: string; reading: string } | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioTitle, setAudioTitle] = useState("")
  const [audioArtist, setAudioArtist] = useState("")
  const [showSearchHint, setShowSearchHint] = useState(false)
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
    if (showSearchHint) return
    if (!searchFocused && search.query.length === 0) return
    if (inputMode !== "search") return
    if (search.isSearching) return
    if (search.results.length > 0) return
    const id = setTimeout(() => setShowSearchHint(true), 8000)
    return () => clearTimeout(id)
  }, [inputMode, search.isSearching, search.results.length, searchFocused, search.query, showSearchHint])

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 300)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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
    if (!search.lyricsText || !kuroshiroReady) return
    const text = search.lyricsText
    if (lastLyricsRef.current === text && lastModeRef.current === convertMode) return
    lastLyricsRef.current = text
    lastModeRef.current = convertMode
    convert(text, convertMode, corrections)
  }, [search.lyricsText, kuroshiroReady, convertMode, corrections, convert])

  const handleSubmitCorrection = useCallback(
    async (c: { word: string; default_reading: string; user_reading: string; song_title?: string; artist?: string }) =>
      submitCorrection(c),
    [submitCorrection]
  )

  const handleReset = () => {
    setLines([])
    lastLyricsRef.current = ""
    search.setResults([])
    search.setLyricData(null)
    search.setLyricsText(null)
    setEditingEnabled(false)
    setSelectedEditWord(null)
    setAudioUrl(null)
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
          const queries = [`${song.title} ${song.artist}`, song.title.slice(0, 25), song.artist.slice(0, 25)]
          for (const q of queries) {
            if (neteaseId) break
            try {
              const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
              const d = await r.json()
              const match = (d.songs ?? []).find((s: { source: string; title: string; artist: string }) =>
                s.source === "netease" &&
                (s.title.toLowerCase().includes(song.title.toLowerCase().slice(0, 5)) ||
                 s.artist.toLowerCase().includes(song.artist.toLowerCase().slice(0, 5)))
              )
              if (match) neteaseId = match.id
            } catch {}
          }
        }
        if (neteaseId) {
          setAudioUrl(`/api/audio?source=netease&id=${neteaseId}`)
          setAudioTitle(song.title)
          setAudioArtist(song.artist)
        }
      } catch { /* no audio */ }
    },
    [search, noLyricsSongs]
  )

  const handleApplyEditReading = (reading: string) => {
    if (selectedEditWord) setSelectedEditWord(null)
  }

  const hasLyrics = lines.length > 0

  return (
    <div className="flex min-h-full flex-col bg-background">
      <Header onHomeClick={handleReset} audioUrl={audioUrl} audioTitle={audioTitle} audioArtist={audioArtist} />

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
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-8 px-4 py-20">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-[0.08em] text-[oklch(0.45_0.06_40)] dark:text-[oklch(0.7_0.06_40)]"
                style={{ textShadow: "2px 2px 0 oklch(0.85_0.02_60 / 0.4)" }}>
                  Origamicmic Furi
              </h1>
              <p className="mt-3 text-sm tracking-[0.06em] text-muted-foreground/60">日语歌词注音 · 罗马音转换</p>
            </div>

            {kuroshiroError && (
              <div className="w-full rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                解析引擎加载失败，请刷新页面重试
                <button onClick={() => window.location.reload()} className="ml-2 underline hover:no-underline">刷新</button>
              </div>
            )}

            <ModeSelector mode={inputMode} onModeChange={setInputMode} />

            {inputMode === "search" ? (
              <div className="relative w-full pb-12">
                <SearchBar query={search.query} results={search.results} isSearching={search.isSearching}
                  onQueryChange={(q) => { setShowSearchHint(false); search.debouncedSearch(q) }}
                  onSearchFocus={() => {
                    setSearchFocused(true)
                    if (search.query.trim().length > 0 && search.results.length === 0) {
                      search.search(search.query)
                    }
                  }}
                  onSelect={handleSelectSong} error={search.error}
                  noLyricsSongs={noLyricsSongs} forceOpen={forceOpenSearch} />
                {showSearchHint && (
                  <p className="absolute top-[310px] left-0 right-0 text-center text-sm text-muted-foreground/60">
                    卡住了？试试输入歌曲名，或
                    <button onClick={() => window.location.reload()} className="ml-1 underline hover:no-underline">刷新页面</button>
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full"><PasteInput onPaste={search.setPastedLyrics} /></div>
            )}

            {!kuroshiroReady && !kuroshiroError && (
              <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  正在加载日语解析引擎...
                </div>
                <a href="/"
                  className="text-primary underline transition-colors hover:no-underline">
                  长时间未响应？刷新试试
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className={cn(
            "flex w-full flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-6",
            editingEnabled && !isNarrow ? "" : "mx-auto max-w-6xl"
          )}>
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
                    <EditPanel selectedWord={selectedEditWord}
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
                <EditPanel selectedWord={selectedEditWord}
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
