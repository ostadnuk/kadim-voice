"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LiveWaveform } from "./live-waveform"
import type { RecordingState } from "@/lib/types"

interface ScreenRecordProps {
  onComplete: (recording: RecordingState) => void
  onBack: () => void
}

const MAX_DURATION = 30

export function ScreenRecord({ onComplete, onBack }: ScreenRecordProps) {
  const [permissionState, setPermissionState] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const startTimeRef = useRef<number>(0)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const requestPermission = async () => {
    setPermissionState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPermissionState("granted")

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 2048
      source.connect(analyserNode)
      setAnalyser(analyserNode)
    } catch {
      setPermissionState("denied")
    }
  }

  const startRecording = () => {
    if (!streamRef.current) return

    chunksRef.current = []
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    })
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" })
      const duration = elapsed
      const peaks = generatePeaksFromDuration(duration)
      onComplete({ blob, duration, waveformPeaks: peaks })
    }

    mediaRecorder.start(100)
    setIsRecording(true)
    startTimeRef.current = Date.now()
    setElapsed(0)

    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(sec)
      if (sec >= MAX_DURATION) {
        stopRecording()
      }
    }, 250)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  if (permissionState === "idle" || permissionState === "requesting") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <h2 className="text-lg font-medium">Microphone access needed</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To record your voice signature, we need permission to use your microphone.
            </p>
          </div>
          <Button
            onClick={requestPermission}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
            disabled={permissionState === "requesting"}
          >
            {permissionState === "requesting" ? "Requesting..." : "Allow microphone"}
          </Button>
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  if (permissionState === "denied") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-destructive"
            >
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
              <path d="M5 10v2a7 7 0 0 0 12 5" />
              <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Microphone blocked</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please enable microphone access in your browser settings and try again.
            </p>
          </div>
          <Button
            onClick={() => setPermissionState("idle")}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Try again
          </Button>
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-3xl tabular-nums tracking-tight">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-muted-foreground">
            {isRecording ? "Recording..." : "Ready to record"}
          </span>
        </div>

        <div className="w-full">
          <LiveWaveform
            analyser={analyser}
            isRecording={isRecording}
            height={80}
          />
        </div>

        <div className="flex flex-col items-center gap-6">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="group flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground transition-all hover:bg-foreground"
              aria-label="Start recording"
            >
              <div className="h-6 w-6 rounded-full bg-destructive transition-transform group-hover:scale-110" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="group flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground bg-foreground transition-all"
              aria-label="Stop recording"
            >
              <div className="h-5 w-5 rounded-sm bg-background" />
            </button>
          )}

          {!isRecording && (
            <button
              onClick={onBack}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Go back
            </button>
          )}
        </div>

        <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-foreground transition-all duration-300"
            style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function generatePeaksFromDuration(duration: number): number[] {
  const count = Math.max(40, duration * 4)
  const peaks: number[] = []
  for (let i = 0; i < count; i++) {
    const base = Math.sin((i / count) * Math.PI) * 0.6
    peaks.push(Math.max(0.05, base + (Math.random() - 0.5) * 0.4))
  }
  return peaks
}
