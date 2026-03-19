"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Waveform } from "./waveform"
import type { RecordingState } from "@/lib/types"
import { Play, Pause } from "lucide-react"

interface ScreenReviewProps {
  recording: RecordingState
  onContinue: () => void
  onReRecord: () => void
}

export function ScreenReview({ recording, onContinue, onReRecord }: ScreenReviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (recording.blob) {
      urlRef.current = URL.createObjectURL(recording.blob)
      const audio = new Audio(urlRef.current)
      audioRef.current = audio

      audio.addEventListener("ended", () => {
        setIsPlaying(false)
        setProgress(0)
      })

      audio.addEventListener("timeupdate", () => {
        if (audio.duration) {
          setProgress(audio.currentTime / audio.duration)
        }
      })

      return () => {
        audio.pause()
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      }
    }
  }, [recording.blob])

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-lg font-medium">Review your recording</h2>
          <span className="font-mono text-sm text-muted-foreground">
            {formatTime(recording.duration)}
          </span>
        </div>

        <div className="w-full rounded-2xl border border-border bg-card p-6">
          <Waveform peaks={recording.waveformPeaks} progress={progress} height={64} />
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={togglePlayback}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-foreground" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={onContinue}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Continue
          </Button>
          <button
            onClick={onReRecord}
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Re-record
          </button>
        </div>
      </div>
    </div>
  )
}
