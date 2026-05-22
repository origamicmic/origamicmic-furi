"use client"

import type { LyricLine } from "@/types"
import { cn } from "@/lib/utils"

interface LyricsPanelProps {
  lines: LyricLine[]
  title: string
  artist: string
  highlightEnabled?: boolean
  rawText?: string | null
  isConverting?: boolean
}

export function LyricsPanel({
  lines,
  title,
  artist,
  highlightEnabled = true,
  rawText,
  isConverting,
}: LyricsPanelProps) {
  const rawLines = rawText
    ? rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0)
    : []

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/20 px-5 py-3.5 dark:border-white/10" data-hover-lift>
        <h2 className="text-sm font-medium tracking-widest text-muted-foreground/70">原文歌词</h2>
        {(title || artist) && (
          <p className="mt-0.5 text-xs text-muted-foreground/50">
            {title}{artist ? ` - ${artist}` : ""}
          </p>
        )}
      </div>
      <div className="space-y-0.5 p-5 font-medium leading-relaxed text-[15px]">
        {lines.length > 0 ? (
          lines.map((line) => (
            <div key={line.index} className="flex items-start gap-3 min-h-[1.5rem]">
              <span className="mt-0.5 min-w-[2rem] shrink-0 text-right text-xs text-muted-foreground/40">
                {line.index + 1}
              </span>
              <span className="flex flex-wrap">
                {line.tokens.map((token) => (
                  <span
                    key={token.tokenId}
                    data-token-id={token.tokenId}
                    className={cn(
                      "mr-1 last:mr-0 rounded px-0.5 transition-colors",
                      highlightEnabled && token.isKanji && "bg-orange-200/60 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200"
                    )}
                  >
                    {token.surface}
                  </span>
                ))}
              </span>
            </div>
          ))
        ) : rawLines.length > 0 ? (
          rawLines.map((line, i) => (
            <div key={i} className="flex items-start gap-3 min-h-[1.5rem]">
              <span className="mt-0.5 min-w-[2rem] shrink-0 text-right text-xs text-muted-foreground/40">
                {i + 1}
              </span>
              <span>{line}</span>
            </div>
          ))
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {isConverting ? "转换中..." : "暂无歌词"}
          </div>
        )}
      </div>
    </div>
  )
}
