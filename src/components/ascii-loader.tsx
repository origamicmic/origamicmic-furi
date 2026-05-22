"use client"

import { useEffect, useRef } from "react"
import { asciiFrames, frameDelays } from "@/components/ascii-loader-frames"
import { cn } from "@/lib/utils"

export function AsciiLoader({ className }: { className?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (asciiFrames.length === 0) return
    const el = ref.current
    if (!el) return

    let frame = 0
    const delays = frameDelays.length === asciiFrames.length ? frameDelays : asciiFrames.map(() => 100)

    const tick = () => {
      el.textContent = asciiFrames[frame].join("\n")
      frame = (frame + 1) % asciiFrames.length
      timerRef.current = setTimeout(tick, delays[frame] ?? 100)
    }

    tick()
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div className="flex w-full items-start justify-center overflow-visible" style={{ contain: "none" }}>
      <pre
        ref={ref}
        aria-label="搜索中..."
        className={cn(
          "inline-block select-none font-bold text-foreground dark:text-foreground",
          "text-[6.5px] leading-[6.5px] sm:text-[7.5px] sm:leading-[7.5px]",
          "tracking-[0.5px] whitespace-pre",
          className
        )}
        style={{
          transform: "scaleX(1.14)",
          transformOrigin: "center top",
        }}
      />
    </div>
  )
}
