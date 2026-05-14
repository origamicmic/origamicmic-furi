"use client"

import { useState, useCallback } from "react"
import type { CorrectionEntry } from "@/types"

export function useCorrections() {
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCorrections = useCallback(async () => {
    try {
      const res = await fetch("/api/corrections")
      const data = await res.json()
      setCorrections(data.corrections ?? [])
    } catch {
      // Silent fail - corrections are optional
    }
  }, [])

  const submitCorrection = useCallback(
    async (entry: CorrectionEntry) => {
      setIsSubmitting(true)
      try {
        const res = await fetch("/api/corrections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        })
        const data = await res.json()

        if (data.correction) {
          setCorrections((prev) => [...prev, data.correction])
          return true
        }
        return false
      } catch {
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    []
  )

  return { corrections, isSubmitting, loadCorrections, submitCorrection }
}
