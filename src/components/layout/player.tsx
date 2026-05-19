"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Play, Pause, AlertCircle, Loader2 } from "lucide-react"

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
  const textRef = useRef<HTMLSpanElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [overflow, setOverflow] = useState(false)
  const dragging = useRef(false)
  const seeking = useRef(false)
  const dragPos = useRef(0)
  const stallRetries = useRef(0)
  const playingRef = useRef(false)
  const audioSrcRef = useRef(src)
  const retryTimer = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => { playingRef.current = playing }, [playing])

  useEffect(() => {
    const track = trackRef.current
    const text = textRef.current
    if (!track || !text) return
    const check = () => setOverflow(text.scrollWidth > track.clientWidth)
    const ro = new ResizeObserver(check)
    ro.observe(track)
    check()
    return () => ro.disconnect()
  }, [title, artist])

  const onTime = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!dragging.current && !seeking.current) setCurrent(audio.currentTime)
  }, [])

  const onLoaded = useCallback(() => {
    setLoading(false)
    setError(false)
  }, [])

  const onDur = useCallback(() => {
    const audio = audioRef.current
    if (audio) setDuration(audio.duration || 0)
  }, [])

  const onEnd = useCallback(() => setPlaying(false), [])

  const onCanPlay = useCallback(() => {
    stallRetries.current = 0
  }, [])

  const onErr = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    console.warn(`[player] error code=${audio.error?.code} networkState=${audio.networkState}`)
    setLoading(false)
    setError(true)
  }, [])

  const onStalled = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (stallRetries.current < 3) {
      stallRetries.current++
      if (playingRef.current) {
        audio.play().catch(() => {})
      }
      return
    }

    setLoading(false)
    setError(true)
  }, [])

  const onSeeking = useCallback(() => { seeking.current = true }, [])

  const onSeeked = useCallback(() => {
    seeking.current = false
    const audio = audioRef.current
    if (audio) setCurrent(audio.currentTime)
  }, [])

  useEffect(() => {
    stallRetries.current = 0
    audioSrcRef.current = src
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = undefined }
    const audio = audioRef.current
    if (!audio) return

    if (audio.readyState >= 1) {
      setLoading(false)
      setError(false)
      if (audio.duration && !isNaN(audio.duration)) setDuration(audio.duration)
    }
    if (audio.error || audio.networkState === 3) {
      setLoading(false)
      setError(true)
    }
  }, [src])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (loading) return
    if (error) {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      setError(false)
      setLoading(true)
      stallRetries.current = 0
      audioSrcRef.current = src
      audio.src = src
      audio.load()
      retryTimer.current = setTimeout(() => {
        if (audioRef.current?.error) {
          setError(true)
          setLoading(false)
        }
      }, 15000)
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
  }, [loading, error, playing, src])

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
      if (audio && duration > 0 && dragPos.current > 0) {
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
    <div className="flex flex-1 items-center gap-3 rounded-full bg-white/60 px-4 py-1.5 shadow-sm ring-1 ring-white/40 backdrop-blur-xl dark:bg-zinc-900/60 dark:ring-white/10 min-w-[280px] max-w-md">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={onTime}
        onLoadedMetadata={onLoaded}
        onLoadedData={onLoaded}
        onDurationChange={onDur}
        onEnded={onEnd}
        onError={onErr}
        onStalled={onStalled}
        onCanPlay={onCanPlay}
        onSeeking={onSeeking}
        onSeeked={onSeeked}
      />
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
      <div className="min-w-0 flex-1 overflow-hidden">
        <div ref={trackRef} className="overflow-hidden whitespace-nowrap">
          {overflow ? (
            <span className="inline-block animate-[marquee_12s_linear_infinite] hover:[animation-play-state:paused] text-[11px] font-medium leading-tight text-foreground/80">
              <span ref={textRef}>{title}<span className="mx-2 font-normal text-muted-foreground/50">- {artist}</span></span>
              <span className="inline-block w-6">&nbsp;</span>
              <span>{title}<span className="mx-2 font-normal text-muted-foreground/50">- {artist}</span></span>
            </span>
          ) : (
            <p className="truncate text-[11px] font-medium leading-tight text-foreground/80">
              <span ref={textRef}>{title}</span>
              <span className="ml-1 font-normal text-muted-foreground/50">- {artist}</span>
            </p>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <div
            ref={barRef}
            className="relative h-2 flex-1 cursor-pointer rounded-full bg-border/60"
            onPointerDown={onPointerDown}
          >
            <div
              className="absolute inset-y-0 left-0 z-0 rounded-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 z-10 -translate-y-1/2 h-[10px] w-[10px] rounded-full bg-primary shadow"
              style={{ left: `calc(${progress}% - 5px)` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/40 shrink-0">
            {loading ? "--:--" : error ? "错误" : duration > 0 ? formatTime(current) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  )
}
