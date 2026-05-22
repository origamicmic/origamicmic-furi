"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { cn } from "@/lib/utils"

export type IntroAnimationState = "hidden" | "entering" | "active" | "exiting"

interface PageSwitcherProps {
  searchPage: React.ReactNode
  introPage: (switchToSearch: () => void, animState: IntroAnimationState) => React.ReactNode
}

type Page = "search" | "intro"
type Transition = "none" | "to-intro" | "to-search"

const ANIMATION_DURATION = 700
const WATER_BOB_DELAY = 0
const WATER_BOB_DURATION = 1800
const WHEEL_THRESHOLD = 50
const TOUCH_THRESHOLD = 50

export function PageSwitcher({ searchPage, introPage }: PageSwitcherProps) {
  const [currentPage, setCurrentPage] = useState<Page>("search")
  const [transition, setTransition] = useState<Transition>("none")
  const animatingRef = useRef(false)
  const wheelAccumRef = useRef(0)
  const touchStartY = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefersReducedMotion = useRef(false)
  const currentPageRef = useRef<Page>("search")
  const [waterBobbing, setWaterBobbing] = useState(false)
  const [scrollPercent, setScrollPercent] = useState(0)

  // Keep ref in sync with state
  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

  // Track scroll position for themed scrollbar thumb
  useEffect(() => {
    const update = () => {
      if (currentPageRef.current === "intro") {
        const el = document.querySelector("[data-intro-scroll]") as HTMLElement | null
        if (el && el.scrollHeight > el.clientHeight) {
          setScrollPercent(el.scrollTop / (el.scrollHeight - el.clientHeight))
          return
        }
        setScrollPercent(0)
        return
      }
      // Search page: track window scroll
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      if (maxScroll > 0) {
        setScrollPercent(window.scrollY / maxScroll)
      } else {
        setScrollPercent(0)
      }
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    // Also listen on intro scroll element
    const introEl = document.querySelector("[data-intro-scroll]")
    introEl?.addEventListener("scroll", update, { passive: true })
    return () => {
      window.removeEventListener("scroll", update)
      introEl?.removeEventListener("scroll", update)
    }
  }, [currentPage])

  // Check reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    prefersReducedMotion.current = mq.matches
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Auto-clear water bob after animation completes
  useEffect(() => {
    if (!waterBobbing) return
    const timer = setTimeout(() => setWaterBobbing(false), WATER_BOB_DURATION)
    return () => clearTimeout(timer)
  }, [waterBobbing])

  const getIntroScrollEl = useCallback(() => {
    return document.querySelector("[data-intro-scroll]") as HTMLElement | null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finishTransition = useCallback(() => {
    setTransition("none")
    animatingRef.current = false
    wheelAccumRef.current = 0
  }, [])

  const switchTo = useCallback(
    (target: Page) => {
      // Use ref to avoid stale closure — prevents double-transition on fast scroll
      if (animatingRef.current) return
      if (target === currentPageRef.current) return

      animatingRef.current = true
      wheelAccumRef.current = 0
      clearTimer()

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      if (target === "intro") {
        setTransition("to-intro")
      } else {
        setTransition("to-search")
      }

      if (target === "search") {
        setTimeout(() => setWaterBobbing(true), WATER_BOB_DELAY)
      }

      timerRef.current = setTimeout(() => {
        setCurrentPage(target)
        finishTransition()
      }, ANIMATION_DURATION)
    },
    [clearTimer, finishTransition]
  )

  const switchToSearch = useCallback(() => switchTo("search"), [switchTo])

  // Derive intro animation state
  const introAnimState = useMemo<IntroAnimationState>(() => {
    if (transition === "to-intro") return "entering"
    if (transition === "to-search") return "exiting"
    if (currentPage === "intro") return "active"
    return "hidden"
  }, [currentPage, transition])

  // Derive search content animation state (mirror of intro)
  const searchContentAnimState = useMemo<IntroAnimationState>(() => {
    if (transition === "to-search") return "entering"
    if (transition === "to-intro") return "exiting"
    if (currentPage === "search") return "active"
    return "hidden"
  }, [currentPage, transition])

  // Wheel handler
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const cp = currentPageRef.current
      if (animatingRef.current) {
        e.preventDefault()
        return
      }

      // Search dropdown: let native scroll work, don't interfere
      const target = e.target as HTMLElement | null
      if (target?.closest("[role='listbox']")) return

      // Lyrics loaded → let page scroll globally, block page transitions
      if (cp === "search") {
        const hasLyrics = document.querySelector(".search-content-wrapper [data-has-lyrics='true']")
        if (hasLyrics) {
          return // Don't intercept — browser handles global scrolling
        }
      }

      if (cp === "intro") {
        const introEl = getIntroScrollEl()
        if (introEl) {
          const { scrollTop, scrollHeight, clientHeight } = introEl
          const atTop = scrollTop <= 0
          const atBottom = scrollTop + clientHeight >= scrollHeight - 1

          if (e.deltaY > 0 && !atBottom) return
          if (e.deltaY < 0 && !atTop) return
        }
      }

      e.preventDefault()

      if (cp === "search" && e.deltaY <= 0) return
      if (cp === "intro" && e.deltaY >= 0) return

      wheelAccumRef.current += e.deltaY

      if (cp === "search" && wheelAccumRef.current > WHEEL_THRESHOLD) {
        switchTo("intro")
      } else if (cp === "intro" && wheelAccumRef.current < -WHEEL_THRESHOLD) {
        switchTo("search")
      }
    },
    [switchTo, getIntroScrollEl]
  )

  // Touch handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (animatingRef.current) return

      const cp = currentPageRef.current
      const deltaY = touchStartY.current - e.changedTouches[0].clientY

      if (cp === "intro") {
        const introEl = getIntroScrollEl()
        if (introEl) {
          const { scrollTop, scrollHeight, clientHeight } = introEl
          const atTop = scrollTop <= 0
          const atBottom = scrollTop + clientHeight >= scrollHeight - 1

          if (deltaY > 0 && !atBottom) return
          if (deltaY < 0 && !atTop) return
        }
      }

      // When lyrics are loaded, don't allow touch-to-switch from search page
      if (cp === "search") {
        const hasLyrics = document.querySelector(".search-content-wrapper [data-has-lyrics='true']")
        if (hasLyrics) return
        if (deltaY > TOUCH_THRESHOLD) {
          switchTo("intro")
        }
      } else if (cp === "intro" && deltaY < -TOUCH_THRESHOLD) {
        switchTo("search")
      }
    },
    [switchTo, getIntroScrollEl]
  )

  // Attach/detach event listeners
  useEffect(() => {
    const container = document.getElementById("page-switcher-root")
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("touchstart", handleTouchStart, { passive: true })
    container.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchend", handleTouchEnd)
      clearTimer()
    }
  }, [handleWheel, handleTouchStart, handleTouchEnd, clearTimer])

  // Visibility (both pages always mounted for state preservation)
  const isSearchVisible = currentPage === "search" || transition !== "none"
  const isIntroVisible = currentPage === "intro" || transition !== "none"
  const isTransitioning = transition !== "none"

  const searchAnimationClass =
    transition === "to-intro" ? "page-exit-up" : transition === "to-search" ? "page-enter-from-top" : ""

  const introAnimationClass =
    transition === "to-intro" ? "page-enter-from-bottom" : transition === "to-search" ? "page-exit-down" : ""

  return (
    <div id="page-switcher-root" className="relative min-h-screen bg-background">
      {/* Scrollbar toggle indicator */}
      <div
        className="pointer-events-none fixed right-0 top-0 z-[100] h-full w-[6px]"
        aria-hidden="true"
      >
        <div className="relative mx-auto h-full w-[4px] rounded-full bg-border/20">
          <div
            className="page-switch-thumb"
            style={{ top: `${scrollPercent * 50}%` }}
          />
        </div>
      </div>

      {/* Search Page (always mounted) */}
      <div
        className={cn(
          // During transition: absolute overlay for animation; otherwise: normal flow for global scroll
          isTransitioning ? "absolute inset-0 overflow-hidden" : "flex flex-col",
          searchAnimationClass,
          !isSearchVisible && "hidden"
        )}
        style={{ zIndex: currentPage === "search" ? 2 : 1 }}
        aria-hidden={!isSearchVisible}
        data-search-anim-state={searchContentAnimState}
      >
        <div className={cn("search-content-wrapper", waterBobbing && "search-water-bob")}>
          {searchPage}
        </div>
      </div>

      {/* Intro Page (always mounted) */}
      <div
        className={cn(
          // During transition: absolute overlay for animation; otherwise: normal flow, fills viewport
          isTransitioning ? "absolute inset-0 overflow-hidden" : "flex flex-col h-screen overflow-x-hidden",
          introAnimationClass,
          !isIntroVisible && "hidden"
        )}
        style={{ zIndex: currentPage === "intro" ? 2 : 1 }}
        aria-hidden={!isIntroVisible}
      >
        {introPage(switchToSearch, introAnimState)}
      </div>
    </div>
  )
}
