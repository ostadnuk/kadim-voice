"use client"

import { Button } from "@/components/ui/button"

interface ScreenIntentProps {
  prompt?: string
  onRecord: () => void
  onSkip: () => void
}

export function ScreenIntent({
  prompt = "Say one word you want to send into the future.",
  onRecord,
  onSkip,
}: ScreenIntentProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-12 text-center">
        <div className="flex flex-col items-center gap-6">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Prompt
          </span>
          <p className="text-balance text-xl font-medium leading-relaxed tracking-tight">
            {`"${prompt}"`}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={onRecord}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Record
          </Button>
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
