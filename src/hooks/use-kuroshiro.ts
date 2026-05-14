"use client"

import { useEffect, useState, useCallback } from "react"
import { initKuroshiro, tokenizeLyrics } from "@/lib/furigana"
import type { LyricLine, ConvertMode, CorrectionEntry } from "@/types"

let engineReady = false

export function useKuroshiro() {
  const [isReady, setIsReady] = useState(engineReady)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (engineReady) return
    initKuroshiro()
      .then(() => {
        engineReady = true
        setIsReady(true)
      })
      .catch((err) => setError(err.message))
  }, [])

  return { isReady, error }
}

export function useConvert() {
  const [lines, setLines] = useState<LyricLine[]>([])
  const [isConverting, setIsConverting] = useState(false)

  const convert = useCallback(
    async (
      lyrics: string,
      mode: ConvertMode,
      corrections?: CorrectionEntry[]
    ) => {
      setIsConverting(true)
      try {
        const result = await tokenizeLyrics(lyrics, mode, corrections)
        setLines(result)
        return result
      } finally {
        setIsConverting(false)
      }
    },
    []
  )

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

  return { lines, setLines, isConverting, convert, updateToken }
}
