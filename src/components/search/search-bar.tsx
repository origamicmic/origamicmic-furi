"use client"

import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AsciiLoader } from "@/components/ascii-loader"
import type { SongResult } from "@/types"
import { useRef, useEffect, useState } from "react"

interface SearchBarProps {
  query: string
  results: SongResult[]
  isSearching: boolean
  onQueryChange: (query: string) => void
  onSelect: (song: SongResult) => void
  error: string | null
  noLyricsSongs?: Set<string>
  onSearchFocus?: () => void
  forceOpen?: number
}

const SCROLLBAR_CLASSES =
  "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:hover:bg-border/80"

export function SearchBar({
  query,
  results,
  isSearching,
  onQueryChange,
  onSelect,
  error,
  noLyricsSongs,
  onSearchFocus,
  forceOpen,
}: SearchBarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (forceOpen && forceOpen > 0) {
      setTimeout(() => {
        setOpen(true)
        inputRef.current?.focus()
      }, 150)
    }
  }, [forceOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const show = open && (results.length > 0 || isSearching || (query.length > 0 && error))

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          ref={inputRef}
          placeholder="输入歌曲名、歌手名或部分歌词..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => { setOpen(true); onSearchFocus?.() }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 200)
          }}
          className="h-11 border-muted-foreground/20 bg-card pl-10 text-base placeholder:text-muted-foreground/40 focus-visible:border-primary focus-visible:ring-primary/20"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground/60" />
        )}
      </div>

      {show && (
        <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/80 bg-card shadow-xl" style={{ maxHeight: "calc(100vh - 14rem)" }}>
          {isSearching && (
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center justify-center py-1.5 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                搜索中...
              </div>
              <div className="flex flex-1 items-center justify-center overflow-hidden">
                <AsciiLoader />
              </div>
            </div>
          )}
          {!isSearching && results.length === 0 && query.length > 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {error || "未找到相关歌曲"}
            </div>
          )}
          {!isSearching && results.length > 0 && (
            <div className={`max-h-[260px] overflow-y-auto ${SCROLLBAR_CLASSES}`} role="listbox">
              {results.map((song, i) => {
                const key = `${song.source}-${song.id}`
                const hasNoLyrics = noLyricsSongs?.has(key)
                return (
                  <div key={key} className="group relative" role="option">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onSelect(song)
                        setOpen(false)
                        if (blurTimer.current) clearTimeout(blurTimer.current)
                      }}
                      className="flex w-full flex-col border-b border-border/30 px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-accent/40"
                    >
                      <span className="text-sm font-medium text-foreground">{song.title}</span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {song.artist}
                        <span className="ml-2 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground/60">
                          {song.source}
                        </span>
                      </span>
                    </button>
                    {hasNoLyrics && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-orange-100 px-2 py-0.5 text-[10px] text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                        无歌词
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
