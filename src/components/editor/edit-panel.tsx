"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Check, RotateCcw, Send, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRecommendations } from "@/hooks/use-recommendations"

interface EditPanelProps {
  selectedWord: { surface: string; reading: string } | null
  onApplyReading: (reading: string) => void
  onClose: () => void
  floating?: boolean
}

export function EditPanel({ selectedWord, onApplyReading, onClose, floating }: EditPanelProps) {
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { recommendations, loading, submitting, fetchRecommendations, submitRecommendation, castVote } = useRecommendations()

  useEffect(() => {
    if (selectedWord) {
      fetchRecommendations(selectedWord.surface)
      inputRef.current?.focus()
    }
  }, [selectedWord, fetchRecommendations])

  const handleConfirmLocal = () => {
    if (!inputValue.trim()) return
    onApplyReading(inputValue.trim())
    setInputValue("")
  }

  const handleSubmitToApi = async () => {
    if (!selectedWord || !inputValue.trim()) return
    setError(null)
    try {
      const ok = await submitRecommendation(selectedWord.surface, inputValue.trim(), selectedWord.reading)
      if (ok) {
        onApplyReading(inputValue.trim())
        setInputValue("")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "提交失败")
    }
  }

  const handleVote = async (id: string, vote: "up" | "down") => {
    try {
      await castVote(id, vote)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "投票失败")
    }
  }

  const score = useMemo(() => {
    return (r: { votes_up: number; votes_down: number }) => r.votes_up - r.votes_down
  }, [])
  const sorted = useMemo(() =>
    [...recommendations].sort((a, b) => {
      if (a.is_official && !b.is_official) return -1
      if (!a.is_official && b.is_official) return 1
      return score(b) - score(a)
    }),
    [recommendations, score]
  )

  const selectedHeader = selectedWord && (
    <p className="text-xs text-muted-foreground/50">
      {selectedWord.surface}
      <span className="ml-1 text-muted-foreground/30">/ {selectedWord.reading}</span>
    </p>
  )

  const inputRow = (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleConfirmLocal() }}
        placeholder={selectedWord?.reading || "输入新读音..."}
        className="min-w-0 flex-1 rounded-lg border border-border/60 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      <button
        onClick={handleConfirmLocal}
        disabled={!inputValue.trim()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-40"
        title="确认修改（仅本地，无限制）"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={handleSubmitToApi}
        disabled={!inputValue.trim() || submitting}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-40"
        title="提交推荐（分享给他人，每日有限制）"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => { setInputValue(selectedWord?.reading ?? ""); onApplyReading(selectedWord?.reading ?? "") }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-accent/50"
        title="撤回原读音"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  const recList = (
    <>
      <p className="mb-2 text-[11px] tracking-wider text-muted-foreground/40">推荐读音</p>

      {loading && (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />加载中...
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground/40">暂无推荐，快来提交第一个吧</p>
      )}

      <div className="space-y-1.5">
        {sorted.map((r) => (
          <div key={r.id} className={cn(
            "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            r.is_official ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-accent/30"
          )}>
            <button onClick={() => onApplyReading(r.reading)} className="min-w-0 flex-1 text-left">
              <span className="font-medium">{r.reading}</span>
              {r.is_official && <span className="ml-1.5 text-[10px] text-primary">官方</span>}
            </button>
            <span className={cn("text-xs tabular-nums",
              score(r) > 0 ? "text-green-600 dark:text-green-400" :
              score(r) < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground/40"
            )}>{score(r)}</span>
            <button onClick={() => handleVote(r.id, "up")}
              className="rounded p-0.5 text-muted-foreground/30 transition-colors hover:text-green-600" title="赞">
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button onClick={() => handleVote(r.id, "down")}
              className="rounded p-0.5 text-muted-foreground/30 transition-colors hover:text-red-600" title="踩">
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </>
  )

  const emptyHint = (
    <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground/40">
      点击右侧注音面板中的汉字开始编辑
    </div>
  )

  if (floating) {
    return (
      <div className="flex max-h-[50vh] flex-1 flex-row overflow-hidden">
        {selectedWord ? (
          <div className="flex w-1/2 flex-col border-r border-border/20 p-4">
            {selectedHeader}
            <div className="mt-2">{inputRow}</div>
            {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="flex w-1/2 flex-col items-center justify-center p-4">
            {selectedHeader}
            <div className="mt-2 flex flex-1 items-center justify-center">{emptyHint}</div>
          </div>
        )}
        <div className="flex w-1/2 flex-col overflow-y-auto p-4">
          {recList}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/20 px-4 py-3 dark:border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">编辑读音</h2>
          <button onClick={onClose} className="text-xs text-muted-foreground/50 hover:text-foreground">✕</button>
        </div>
        {selectedHeader}
      </div>

      {selectedWord ? (
        <>
          <div className="border-b border-white/20 px-4 py-3 dark:border-white/10">
            {inputRow}
            {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {recList}
          </div>
        </>
      ) : (
        emptyHint
      )}
    </div>
  )
}
