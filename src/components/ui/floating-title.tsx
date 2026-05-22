"use client"

import { useMemo, useState, useEffect } from "react"

/**
 * Pseudo-random number from a seed (character index).
 * Produces a consistent "random" value for each character.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

interface CharParams {
  delay: number
  period: number
  amp: number
  rotate: number
}

function charParams(idx: number, total: number): CharParams {
  const r1 = seededRandom(idx * 3 + 1)
  const r2 = seededRandom(idx * 7 + 2)
  const r3 = seededRandom(idx * 13 + 3)
  const r4 = seededRandom(idx * 17 + 4)

  return {
    delay: (idx / Math.max(total, 1)) * 5 + r1 * 2,
    period: 8 + r2 * 7,
    amp: 1.0 + r3 * 0.8,
    rotate: (r4 - 0.5) * 2,
  }
}

interface FloatingTitleProps {
  children: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
  className?: string
  style?: React.CSSProperties
}

/**
 * Splits text into individual characters with independent floating animation.
 *
 * SSR strategy: renders plain text on the server to avoid hydration mismatch
 * from floating-point inline styles. Switches to animated spans on the client
 * via useLayoutEffect (before paint, no flash).
 */
export function FloatingTitle({ children, as: Tag = "h2", className, style }: FloatingTitleProps) {
  const [hydrated, setHydrated] = useState(false)
  const chars = useMemo(() => [...children], [children])

  useEffect(() => {
    setHydrated(true)
  }, [])

  // SSR / initial render: plain text
  if (!hydrated) {
    return <Tag className={className} style={style} suppressHydrationWarning>{children}</Tag>
  }

  // Client: animated character spans
  return (
    <Tag className={className} style={style} aria-label={children} suppressHydrationWarning>
      {chars.map((char, i) => {
        if (char === " " || char === "\n") {
          return char === "\n" ? <br key={i} /> : <span key={i}> </span>
        }
        const p = charParams(i, chars.length)
        return (
          <span
            key={i}
            className="char-float"
            aria-hidden="true"
            style={{
              ["--char-delay" as string]: `${p.delay.toFixed(2)}s`,
              ["--char-period" as string]: `${p.period.toFixed(2)}s`,
              ["--char-amp" as string]: `${p.amp.toFixed(2)}px`,
              ["--char-rotate" as string]: `${p.rotate.toFixed(2)}deg`,
            }}
          >
            {char}
          </span>
        )
      })}
    </Tag>
  )
}
