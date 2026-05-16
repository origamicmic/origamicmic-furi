"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Play, Pause, AlertCircle, Loader2 } from "lucide-react"

interface PlayerProps {
  src: string
  title: string
  artist: string
  fallbackSrc?: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function Player({ src, title, artist, fallbackSrc }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const dragging = useRef(false)
  const seeking = useRef(false)
  const dragPos = useRef(0)
  const fallbackTried = useRef(false)
  const stallRetries = useRef(0)
  const playingRef = useRef(false)
  const audioSrcRef = useRef(src)

  useEffect(() => { playingRef.current = playing }, [playing])

  useEffect(() => {
    fallbackTried.current = false
    stallRetries.current = 0
    setLoading(true)
    setError(false)
    audioSrcRef.current = src
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      if (!dragging.current && !seeking.current) setCurrent(audio.currentTime)
    }
    const onLoaded = () => {
      setLoading(false)
      setError(false)
    }
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => setPlaying(false)
    const onErr = () => {
      setLoading(false)
      if (fallbackSrc && !fallbackTried.current) {
        fallbackTried.current = true
        audioSrcRef.current = fallbackSrc
        audio.src = fallbackSrc
        audio.load()
        setLoading(true)
      } else {
        setError(true)
      }
    }
    const onStalled = () => {
      if (!playingRef.current || stallRetries.current >= 2) return
      stallRetries.current++
      audio.load()
      audio.play().catch(() => {})
    }
    const onSeeking = () => { seeking.current = true }
    const onSeeked = () => {
      seeking.current = false
      setCurrent(audio.currentTime)
    }

    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("loadeddata", onLoaded)
    audio.addEventListener("durationchange", onDur)
    audio.addEventListener("ended", onEnd)
    audio.addEventListener("error", onErr)
    audio.addEventListener("stalled", onStalled)
    audio.addEventListener("seeking", onSeeking)
    audio.addEventListener("seeked", onSeeked)
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("loadeddata", onLoaded)
      audio.removeEventListener("durationchange", onDur)
      audio.removeEventListener("ended", onEnd)
      audio.removeEventListener("error", onErr)
      audio.removeEventListener("stalled", onStalled)
      audio.removeEventListener("seeking", onSeeking)
      audio.removeEventListener("seeked", onSeeked)
    }
  }, [src, fallbackSrc])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (loading) return
    if (error) {
      setError(false)
      setLoading(true)
      fallbackTried.current = false
      stallRetries.current = 0
      audio.src = audioSrcRef.current
      audio.load()
      audio.play().then(() => setPlaying(true)).catch(() => setError(true))
      return
    }
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {
        setError(true)
        setLoading(false)
      })
    }
  }, [loading, error, playing])

  const calcPosition = useCallback((clientX: number): number => {
    const bar = barRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * (duration || 1)
  }, [duration])

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    dragPos.current = calcPosition(e.clientX)
    setCurrent(dragPos.current)

    const onMove = (e: PointerEvent) => {
      dragPos.current = calcPosition(e.clientX)
      setCurrent(dragPos.current)
    }
    const onUp = () => {
      dragging.current = false
      const audio = audioRef.current
      if (audio && dragPos.current > 0) {
        audio.currentTime = dragPos.current
      }
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="flex flex-1 items-center gap-3 rounded-full bg-white/60 px-4 py-1.5 shadow-sm ring-1 ring-white/40 backdrop-blur-xl dark:bg-zinc-900/60 dark:ring-white/10 max-w-sm">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : error ? (
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
            {loading ? "--:--" : error ? "错误" : duration > 0 ? formatTime(current) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  )
}
