"use client"

import { useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WordEditor } from "@/components/editor/word-editor"
import { CorrectionDialog } from "@/components/editor/correction-dialog"
import type { LyricLine, ConvertMode, LyricToken } from "@/types"
import { cn } from "@/lib/utils"

interface EditorPanelProps {
  lines: LyricLine[]
  mode: ConvertMode
  onModeChange: (mode: ConvertMode) => void
  onTokenEdit: (lineIndex: number, tokenId: string, newReading: string) => void
  isConverting: boolean
  onSubmitCorrection?: (correction: {
    word: string
    default_reading: string
    user_reading: string
    song_title?: string
    artist?: string
  }) => Promise<boolean>
  songTitle?: string
  artist?: string
  editingEnabled?: boolean
  highlightEnabled?: boolean
  onWordSelect?: (word: { surface: string; reading: string; lineIndex: number; tokenId: string }) => void
}

export function EditorPanel({
  lines,
  mode,
  onModeChange,
  onTokenEdit,
  isConverting,
  onSubmitCorrection,
  songTitle,
  artist,
  editingEnabled = true,
  highlightEnabled = true,
  onWordSelect,
}: EditorPanelProps) {
  const [correctionTarget, setCorrectionTarget] = useState<{
    token: LyricToken
    lineIndex: number
  } | null>(null)

  const submitCorrection = useCallback(
    async (token: LyricToken, lineIndex: number) => {
      if (!onSubmitCorrection) return false
      return onSubmitCorrection({
        word: token.surface,
        default_reading: token.reading,
        user_reading: token.userReading || token.reading,
        song_title: songTitle,
        artist,
      })
    },
    [onSubmitCorrection, songTitle, artist]
  )

  if (isConverting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">
          正在转换...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/20 px-5 py-3.5 dark:border-white/10">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">注音歌词</h2>
          {(songTitle || artist) && (
            <p className="mt-0.5 text-xs text-muted-foreground/50">
              {songTitle}{artist ? ` - ${artist}` : ""}
            </p>
          )}
        </div>
        <div className="flex overflow-hidden rounded-xl border border-border/60">
          <button
            onClick={() => onModeChange("hiragana")}
            className={cn(
              "px-4 py-1.5 text-xs font-medium tracking-wider transition-colors",
              mode === "hiragana"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            平假名
          </button>
          <button
            onClick={() => onModeChange("romaji")}
            className={cn(
              "px-4 py-1.5 text-xs font-medium tracking-wider transition-colors",
              mode === "romaji"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            罗马音
          </button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-5 font-medium leading-relaxed text-[15px]">
          {lines.map((line) => (
            <div key={line.index} className="flex items-start gap-3 min-h-[1.5rem]">
              <span className="mt-0.5 min-w-[2rem] shrink-0 text-right text-xs text-muted-foreground/40">
                {line.index + 1}
              </span>
              <span>
                {line.tokens.map((token, i, arr) => (
                  <span key={`${token.tokenId}-${token.reading}-${token.userReading ?? ""}`}>
                    {editingEnabled ? (
                      <WordEditor
                        token={token}
                        onEdit={(newReading) =>
                          onTokenEdit(line.index, token.tokenId, newReading)
                        }
                        onSubmitCorrection={() => submitCorrection(token, line.index)}
                        highlightEnabled={highlightEnabled}
                        onWordSelect={onWordSelect ? () => onWordSelect({ surface: token.surface, reading: token.userReading || token.reading, lineIndex: line.index, tokenId: token.tokenId }) : undefined}
                      />
                    ) : (
                      <span
                        className={cn(
                          "rounded px-0.5",
                          highlightEnabled && token.isKanji && "bg-orange-200/60 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200"
                        )}
                      >
                        {token.userReading || token.reading}
                      </span>
                    )}
                    {i < arr.length - 1 ? " " : null}
                  </span>
                ))}
              </span>
            </div>
          ))}
          {lines.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {isConverting ? "解析引擎处理中..." : "请先选择歌曲"}
            </div>
          )}
        </div>
      </ScrollArea>

      <CorrectionDialog
        key={correctionTarget?.token.tokenId ?? "none"}
        open={correctionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCorrectionTarget(null)
        }}
        word={correctionTarget?.token.surface ?? ""}
        defaultReading={correctionTarget?.token.reading ?? ""}
        userReading={correctionTarget?.token.userReading ?? correctionTarget?.token.reading ?? ""}
        songTitle={songTitle}
        artist={artist}
        onSubmit={async (data) => {
          if (onSubmitCorrection) {
            return onSubmitCorrection(data)
          }
          return false
        }}
      />
    </div>
  )
}
