"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface ScreenIntroProps {
  onStart: () => void
  onArchive: () => void
}

export function ScreenIntro({ onStart, onArchive }: ScreenIntroProps) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <svg
              width="20"
              height="20"
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
          <h1 className="text-balance text-2xl font-medium leading-tight tracking-tight">
            Add your voice signature to the archive
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            One recording. Up to 30 seconds.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={onStart}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Start
          </Button>
          <button
            onClick={onArchive}
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Explore the archive
          </button>
        </div>

        <button
          onClick={() => setInfoOpen(true)}
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          What is a voice signature?
        </button>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">What is a voice signature?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              A voice signature is a unique audio imprint created from the qualities of your voice
              — its tone, rhythm, and texture. Each recording is transformed into a visual form,
              a kind of sonic fingerprint, and added to a growing collective archive. Together,
              these signatures compose a portrait of shared presence.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
