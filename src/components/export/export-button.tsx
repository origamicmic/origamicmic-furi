"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Download, FileText, Music, FileCode } from "lucide-react"
import type { LyricData } from "@/types"
import { exportAsTxt, exportAsLrc, exportAsConvertedOnlyTxt, hasTimestamps, downloadFile } from "@/lib/export"
import { cn } from "@/lib/utils"

interface ExportButtonProps {
  data: LyricData | null
}

export function ExportButton({ data }: ExportButtonProps) {
  const [open, setOpen] = useState(false)

  const handleExportTxt = () => {
    if (!data) return
    const content = exportAsTxt(data)
    const filename = `${data.title} - ${data.artist} 注音.txt`
    downloadFile(content, filename, "text/plain;charset=utf-8")
    setOpen(false)
  }

  const handleExportConvertedOnly = () => {
    if (!data) return
    const content = exportAsConvertedOnlyTxt(data)
    const filename = `${data.title} - ${data.artist} 注音(仅转换).txt`
    downloadFile(content, filename, "text/plain;charset=utf-8")
    setOpen(false)
  }

  const handleExportLrc = () => {
    if (!data) return
    const content = exportAsLrc(data)
    const filename = `${data.title} - ${data.artist} 注音.lrc`
    downloadFile(content, filename, "text/plain;charset=utf-8")
    setOpen(false)
  }

  const hasTs = data ? hasTimestamps(data) : false

  if (!data || data.lines.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default" size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/80 h-7 text-xs font-medium tracking-wider rounded-lg px-3 py-1.5" />
        }
      >
        <Download className="h-3.5 w-3.5" />
        导出
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>导出格式</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="h-14 justify-start gap-3"
            onClick={handleExportTxt}
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">纯文本 (TXT)</span>
              <span className="text-xs text-muted-foreground">
                原文与注音对照格式
              </span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-14 justify-start gap-3"
            onClick={handleExportConvertedOnly}
          >
            <FileCode className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">仅注音 (TXT)</span>
              <span className="text-xs text-muted-foreground">
                不包含原文本
              </span>
            </div>
          </Button>
          <div className="group relative">
            <Button
              variant="outline"
              className={cn(
                "h-14 w-full justify-start gap-3",
                !hasTs && "cursor-not-allowed opacity-40"
              )}
              onClick={hasTs ? handleExportLrc : undefined}
              disabled={!hasTs}
            >
              <Music className="h-5 w-5 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">歌词文件 (LRC)</span>
                <span className="text-xs text-muted-foreground">
                  带时间戳的歌词格式
                </span>
              </div>
            </Button>
            {!hasTs && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground/90 px-3 py-1.5 text-xs text-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                原文本不带时间戳，无法生成 LRC
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
