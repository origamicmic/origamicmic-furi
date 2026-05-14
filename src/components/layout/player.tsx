"use client"

import { useRef, useState, useEffect } from "react"
import { Play, Pause, AlertCircle } from "lucide-react"

interface PlayerProps {
  src: string
  title: string
  artist: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function Player({ src, title, artist }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragPos = useRef(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => { if (!dragging) setCurrent(audio.currentTime) }
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => setPlaying(false)
    const onErr = () => setError(true)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onDur)
    audio.addEventListener("ended", onEnd)
    audio.addEventListener("error", onErr)
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("loadedmetadata", onDur)
      audio.removeEventListener("ended", onEnd)
      audio.removeEventListener("error", onErr)
    }
  }, [src, dragging])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || error) return
    if (playing) audio.pause()
    else audio.play().catch(() => setError(true))
    setPlaying(!playing)
  }

  const calcPosition = (clientX: number): number => {
    const bar = barRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * (duration || 1)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    dragPos.current = calcPosition(e.clientX)
    setCurrent(dragPos.current)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      dragPos.current = calcPosition(e.clientX)
      setCurrent(dragPos.current)
    }
    const onUp = () => {
      setDragging(false)
      const audio = audioRef.current
      if (audio && dragPos.current > 0) {
        audio.currentTime = dragPos.current
      }
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [dragging])

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="flex flex-1 items-center gap-3 rounded-full bg-white/60 px-4 py-1.5 shadow-sm ring-1 ring-white/40 backdrop-blur-xl dark:bg-zinc-900/60 dark:ring-white/10">
      <audio ref={audioRef} src={src} preload="auto" />
      <button
        onClick={toggle}
        disabled={error}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105 disabled:opacity-50"
      >
        {error ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight text-foreground/80">
          {title}
          <span className="ml-1 font-normal text-muted-foreground/50">- {artist}</span>
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <div
            ref={barRef}
            className="relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-border/60"
            onPointerDown={onPointerDown}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/40">
            {error ? "暂无" : formatTime(current)}
          </span>
        </div>
      </div>
    </div>
  )
}
