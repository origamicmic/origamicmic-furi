"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle } from "lucide-react"

interface CorrectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  word: string
  defaultReading: string
  userReading: string
  songTitle?: string
  artist?: string
  onSubmit: (data: {
    word: string
    default_reading: string
    user_reading: string
    song_title?: string
    artist?: string
  }) => Promise<boolean>
}

export function CorrectionDialog({
  open,
  onOpenChange,
  word,
  defaultReading,
  userReading,
  songTitle,
  artist,
  onSubmit,
}: CorrectionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [reading, setReading] = useState(userReading)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const ok = await onSubmit({
        word,
        default_reading: defaultReading,
        user_reading: reading,
        song_title: songTitle,
        artist,
      })
      setIsSubmitting(false)
      if (ok) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          onOpenChange(false)
        }, 1200)
      }
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>提交读音修正</DialogTitle>
          <DialogDescription>
            此词在歌曲中可能有特殊读法（当て字），提交后可帮助其他用户更准确地注音。
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-sm text-muted-foreground">提交成功，感谢贡献！</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>原文</Label>
              <p className="rounded-md bg-muted px-3 py-2 font-medium">{word}</p>
            </div>
            <div className="space-y-1">
              <Label>默认读音</Label>
              <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                {defaultReading}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="correction-reading">修正读音</Label>
              <Input
                id="correction-reading"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          {!success && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              提交修正
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
