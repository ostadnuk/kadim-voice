"use client"

import { Button } from "@/components/ui/button"
import { SignatureRing } from "./signature-ring"
import { Waveform } from "./waveform"
import type { LocationState, RecordingState } from "@/lib/types"

interface ScreenResultProps {
  recording: RecordingState
  location: LocationState
  signaturePoints: number[]
  timestamp: string
  onArchive: () => void
  onAnother: () => void
}

export function ScreenResult({
  recording,
  location,
  signaturePoints,
  timestamp,
  onArchive,
  onAnother,
}: ScreenResultProps) {
  const locationLabel =
    location.sourceType === "exhibition" && location.venueName
      ? location.venueName
      : [location.city, location.country].filter(Boolean).join(", ") || "Remote"

  const formattedTime = new Date(timestamp).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-background"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-medium">Your entry was added</h2>
        </div>

        <div className="flex flex-col items-center gap-2">
          <SignatureRing points={signaturePoints} size={180} animated />
        </div>

        <div className="w-full rounded-2xl border border-border bg-card p-5">
          <Waveform peaks={recording.waveformPeaks} height={48} />
        </div>

        <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Timestamp
            </span>
            <span className="font-mono text-xs text-foreground">{formattedTime}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Location
            </span>
            <span className="text-xs text-foreground">{locationLabel}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Duration
            </span>
            <span className="font-mono text-xs text-foreground">{recording.duration}s</span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={onArchive}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Explore the archive
          </Button>
          <button
            onClick={onAnother}
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Add another recording
          </button>
        </div>
      </div>
    </div>
  )
}
