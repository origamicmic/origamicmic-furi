"use client"

import { useState, useCallback } from "react"
import type { Recommendation } from "@/types"

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchRecommendations = useCallback(async (word: string) => {
    if (!word.trim()) {
      setRecommendations([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/recommendations?word=${encodeURIComponent(word)}`)
      const data = await res.json()
      setRecommendations(data.recommendations ?? [])
    } catch {
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [])

  const submitRecommendation = useCallback(async (
    word: string,
    reading: string,
    default_reading?: string
  ): Promise<boolean> => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, reading, default_reading }),
      })
      const data = await res.json()
      if (data.recommendation) {
        setRecommendations((prev) => [...prev, data.recommendation])
        return true
      }
      if (res.status === 429) {
        throw new Error(data.error || "今日提交次数已达上限")
      }
      return false
    } catch (e) {
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [])

  const castVote = useCallback(async (
    recommendationId: string,
    vote: "up" | "down"
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation_id: recommendationId, vote }),
      })
      const data = await res.json()
      if (data.success && data.votes) {
        setRecommendations((prev) =>
          prev.map((r) =>
            r.id === recommendationId
              ? { ...r, votes_up: data.votes.votes_up, votes_down: data.votes.votes_down }
              : r
          )
        )
        return true
      }
      if (res.status === 429) {
        throw new Error(data.error || "今日投票次数已达上限")
      }
      return false
    } catch (e) {
      throw e
    }
  }, [])

  return { recommendations, loading, submitting, fetchRecommendations, submitRecommendation, castVote }
}
