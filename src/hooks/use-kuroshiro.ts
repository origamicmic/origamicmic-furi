"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { initKuroshiro, resetEngine, isEngineAlive, tokenizeLyrics } from "@/lib/furigana"
import type { LyricLine, ConvertMode, CorrectionEntry } from "@/types"

let engineReady = false

export function forceKuroshiroReset() {
  engineReady = false
  resetEngine()
}

export function useKuroshiro() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const errorRef = useRef<string | null>(null)
  const initRef = useRef(false)
  const mounted = useRef(false)
  const lastVerified = useRef(0)

  const ensureReady = useCallback(async (): Promise<boolean> => {
    if (engineReady) {
      if (Date.now() - lastVerified.current < 30000) return true
      const alive = await isEngineAlive()
      lastVerified.current = Date.now()
      if (!alive) {
        engineReady = false
        resetEngine()
      } else {
        return true
      }
    }
    if (errorRef.current) {
      errorRef.current = null
      resetEngine()
      engineReady = false
      setError(null)
    }
    if (!initRef.current) {
      initRef.current = true
      setInitializing(true)
    }
    try {
      await initKuroshiro()
      if (!mounted.current) return false
      engineReady = true
      lastVerified.current = Date.now()
      setIsReady(true)
      errorRef.current = null
      setError(null)
      return true
    } catch (err: unknown) {
      if (!mounted.current) return false
      const msg = (err as Error).message
      errorRef.current = msg
      setError(msg)
      // Schedule one automatic retry after backoff (in case of transient dict load failures)
      setTimeout(() => {
        if (!mounted.current) return
        forceKuroshiroReset()
        initRef.current = false
        setError(null)
        errorRef.current = null
        lastVerified.current = 0
      }, 2500)
      return false
    } finally {
      initRef.current = false
      if (mounted.current) {
        setInitializing(false)
      }
    }
  }, [])

  const retry = useCallback(() => {
    forceKuroshiroReset()
    lastVerified.current = 0
    setIsReady(false)
    setError(null)
    errorRef.current = null
    initRef.current = false
    setInitializing(false)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      initRef.current = false
    }
  }, [])

  return { isReady, error, initializing, ensureReady, retry }
}

export function useConvert(ensureReady?: () => Promise<boolean>) {
  const [lines, setLines] = useState<LyricLine[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const generationRef = useRef(0)

  const convert = useCallback(
    async (
      lyrics: string,
      mode: ConvertMode,
      corrections?: CorrectionEntry[]
    ) => {
      const gen = generationRef.current
      setIsConverting(true)
      try {
        if (ensureReady) {
          const ok = await ensureReady()
          if (!ok || generationRef.current !== gen) return
        }
        const result = await tokenizeLyrics(lyrics, mode, corrections)
        if (generationRef.current !== gen) return
        setLines(result)
        return result
      } finally {
        if (generationRef.current === gen) setIsConverting(false)
      }
    },
    [ensureReady]
  )

  const resetGeneration = useCallback(() => {
    generationRef.current++
  }, [])

  const updateToken = useCallback(
    (lineIndex: number, tokenId: string, newReading: string) => {
      setLines((prev) =>
        prev.map((line) => {
          if (line.index !== lineIndex) return line
          return {
            ...line,
            tokens: line.tokens.map((token) => {
              if (token.tokenId !== tokenId) return token
              return {
                ...token,
                userReading: newReading,
                userModified: newReading !== token.reading,
              }
            }),
          }
        })
      )
    },
    []
  )

  return { lines, setLines, isConverting, convert, updateToken, resetGeneration }
}
