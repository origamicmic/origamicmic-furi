"use client"

import { useState, useRef, useEffect } from "react"
import { Upload } from "lucide-react"
import type { LyricToken } from "@/types"
import { cn } from "@/lib/utils"

interface WordEditorProps {
  token: LyricToken
  onEdit: (newReading: string) => void
  onSubmitCorrection?: () => Promise<boolean>
  highlightEnabled?: boolean
  onWordSelect?: () => void
}

export function WordEditor({
  token,
  onEdit,
  onSubmitCorrection,
  highlightEnabled = true,
  onWordSelect,
}: WordEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(
    token.userReading || token.reading
  )
  const [showSubmit, setShowSubmit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      setEditValue(token.userReading || token.reading)
    }
  }, [token.userReading, token.reading, isEditing])

  const displayText = token.userReading || token.reading

  const handleClick = () => {
    if (token.isKanji) {
      setEditValue(token.userReading || token.reading)
      setIsEditing(true)
      onWordSelect?.()
    }
  }

  const handleFinishEdit = () => {
    setIsEditing(false)
    const currentDisplay = token.userReading || token.reading
    if (editValue !== currentDisplay) {
      onEdit(editValue)
      setShowSubmit(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleFinishEdit()
    }
    if (e.key === "Escape") {
      setEditValue(token.userReading || token.reading)
      setIsEditing(false)
    }
  }

  const handleSubmit = async () => {
    if (!onSubmitCorrection) return
    setIsSubmitting(true)
    try {
      await onSubmitCorrection()
    } finally {
      setIsSubmitting(false)
      setShowSubmit(false)
    }
  }

  return (
    <span
      className={cn(
        "group relative inline-flex items-center rounded px-0.5 transition-all",
        highlightEnabled && token.isKanji && "bg-orange-200/60 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200",
        token.isKanji && !isEditing && "hover:scale-110 cursor-pointer"
      )}
      onClick={handleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleFinishEdit}
          onKeyDown={handleKeyDown}
          aria-label="修改读音"
          className="w-16 border-b border-primary bg-transparent text-center text-sm outline-none"
          size={Math.max(editValue.length, 2)}
        />
      ) : (
        <>
          <span>{displayText}</span>
          {showSubmit && onSubmitCorrection && token.isKanji && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSubmit()
              }}
              disabled={isSubmitting}
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500/20 text-orange-600 hover:bg-orange-500/30 dark:text-orange-400 transition-colors"
              aria-label="提交修正读音"
              title="提交修正读音"
            >
              <Upload className={cn("h-2.5 w-2.5", isSubmitting && "animate-spin")} />
            </button>
          )}
        </>
      )}
    </span>
  )
}
