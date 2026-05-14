"use client"

import { Search, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InputMode } from "@/types"

interface ModeSelectorProps {
  mode: InputMode
  onModeChange: (mode: InputMode) => void
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onModeChange("search")}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all",
          mode === "search"
            ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )}
      >
        <Search className="h-5 w-5" />
        搜索歌曲
      </button>
      <button
        onClick={() => onModeChange("paste")}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all",
          mode === "paste"
            ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )}
      >
        <FileText className="h-5 w-5" />
        粘贴歌词
      </button>
    </div>
  )
}
