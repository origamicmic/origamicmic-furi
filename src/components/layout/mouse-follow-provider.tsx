"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Tracks cursor position relative to the currently hovered element
 * and applies a subtle opposite translation.
 *
 * Cursor moves LEFT  → element shifts RIGHT (0.5-2px)
 * Cursor moves UP    → element shifts DOWN
 *
 * Uses CSS transform with smooth transition via [data-hover-follow] attribute.
 */
export function MouseFollowProvider() {
  const currentElRef = useRef<HTMLElement | SVGElement | null>(null)
  const rafRef = useRef<number>(0)
  const [ready, setReady] = useState(false)

  // Delay activation until after hydration is complete
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const resetElement = () => {
      if (currentElRef.current) {
        currentElRef.current.style.transform = ""
        currentElRef.current = null
      }
    }

    const onMove = (e: MouseEvent) => {
      if (!ready) return
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        // Find the deepest hoverable element under cursor
        const el = document.elementFromPoint(e.clientX, e.clientY)
        if (!el) { resetElement(); return }

        const target = findHoverTarget(el)
        if (!target) { resetElement(); return }

        // If same element, just update position
        if (currentElRef.current !== target) {
          resetElement()
          currentElRef.current = target
        }

        const rect = target.getBoundingClientRect()
        // Cursor offset from element center, normalized to -1..1
        const cx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
        const cy = ((e.clientY - rect.top) / rect.height - 0.5) * 2

        // Opposite direction, clamped to 2px max
        const dx = clamp(cx * -1.5, -2, 2)
        const dy = clamp(cy * -1.5, -2, 2)

        target.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      })
    }

    const onLeave = () => resetElement()

    document.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseleave", onLeave)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
      cancelAnimationFrame(rafRef.current)
      resetElement()
    }
  }, [])

  return null
}

/**
 * Walk up from the element under cursor to find a suitable hover target.
 */
function findHoverTarget(el: Element): HTMLElement | SVGElement | null {
  let current: Element | null = el
  while (current) {
    if (!(current instanceof HTMLElement) && !(current instanceof SVGElement)) {
      current = current.parentElement
      continue
    }
    const tag = current.tagName.toLowerCase()
    // Direct hit on an interactive or visual element
    if (
      tag === "button" || tag === "a" || tag === "input" ||
      tag === "textarea" || tag === "select" || tag === "svg" ||
      tag === "article" || tag === "h1" || tag === "h2" ||
      tag === "h3" || tag === "h4" || tag === "p" ||
      current.getAttribute("role") === "button"
    ) {
      return current
    }
    // Visual containers with rounded corners or frosted glass
    const cls = String(current.getAttribute("class") || "")
    if (
      cls.includes("rounded-") ||
      cls.includes("backdrop-blur") ||
      cls.includes("char-float")
    ) {
      return current
    }
    // Stop at structural roots or excluded functional areas
    if (
      tag === "body" || tag === "html" || current.id === "page-switcher-root" ||
      current.closest("[role='listbox']") ||
      current.closest("[data-no-hover]")
    ) {
      return null
    }
    current = current.parentElement
  }
  return null
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
