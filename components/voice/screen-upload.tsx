"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { uploadAudio, analyzeAudio } from "@/lib/mock-api"

type UploadStatus = "uploading" | "processing" | "done" | "error"

interface ScreenUploadProps {
  audioBlob: Blob
  onComplete: (result: { id: string; audioUrl: string; signaturePoints: number[] }) => void
}

export function ScreenUpload({ audioBlob, onComplete }: ScreenUploadProps) {
  const [status, setStatus] = useState<UploadStatus>("uploading")
  const [progress, setProgress] = useState(0)
  const hasStarted = useRef(false)

  const startUpload = async () => {
    try {
      setStatus("uploading")
      setProgress(0)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + Math.random() * 15
        })
      }, 200)

      const uploadResult = await uploadAudio(audioBlob)
      clearInterval(progressInterval)
      setProgress(95)
      setStatus("processing")

      const analysis = await analyzeAudio(uploadResult.audioUrl)
      setProgress(100)
      setStatus("done")

      setTimeout(() => {
        onComplete({
          id: uploadResult.id,
          audioUrl: uploadResult.audioUrl,
          signaturePoints: analysis.signaturePoints,
        })
      }, 600)
    } catch {
      setStatus("error")
    }
  }

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      startUpload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLabel = {
    uploading: "Uploading...",
    processing: "Processing...",
    done: "Done",
    error: "Upload failed",
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        {status !== "error" ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                {status !== "done" && (
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                )}
                {status === "done" && (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-foreground"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <p className="text-base font-medium">{statusLabel[status]}</p>
            </div>

            <div className="w-full">
              <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-foreground transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {Math.round(Math.min(progress, 100))}%
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-destructive"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <p className="text-base font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground">Could not save your recording. Please try again.</p>
            </div>
            <Button
              onClick={() => {
                hasStarted.current = false
                startUpload()
              }}
              size="lg"
              className="h-14 w-full rounded-xl text-base font-medium"
            >
              Retry
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
