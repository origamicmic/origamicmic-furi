"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"

interface PasteInputProps {
  onPaste: (text: string, title?: string, artist?: string) => void
}

export function PasteInput({ onPaste }: PasteInputProps) {
  const [lyrics, setLyrics] = useState("")

  const handleSubmit = () => {
    if (lyrics.trim()) {
      onPaste(lyrics.trim())
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Textarea
          id="paste-lyrics"
          placeholder="在此粘贴日语歌词..."
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          className="min-h-[200px] resize-y"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!lyrics.trim()}
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/80"
      >
        <Play className="h-4 w-4" />
        开始转换
      </Button>
    </div>
  )
}
