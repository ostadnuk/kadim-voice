"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { ConsentState } from "@/lib/types"

interface ScreenConsentProps {
  onContinue: (consent: ConsentState) => void
  onBack: () => void
}

export function ScreenConsent({ onContinue, onBack }: ScreenConsentProps) {
  const [archiveConsent, setArchiveConsent] = useState(false)
  const [mixOptIn, setMixOptIn] = useState(true)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-lg font-medium">Before we save</h2>
          <p className="text-sm text-muted-foreground">Please review and confirm.</p>
        </div>

        <div className="flex w-full flex-col gap-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-accent">
            <Checkbox
              checked={archiveConsent}
              onCheckedChange={(checked) => setArchiveConsent(checked === true)}
              className="mt-0.5 h-5 w-5 rounded"
            />
            <span className="text-sm leading-relaxed text-foreground">
              I consent to my audio being stored and played as part of the artwork and archive.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-accent">
            <Checkbox
              checked={mixOptIn}
              onCheckedChange={(checked) => setMixOptIn(checked === true)}
              className="mt-0.5 h-5 w-5 rounded"
            />
            <span className="text-sm leading-relaxed text-foreground">
              Allow my recording to be used in the collective mix.
            </span>
          </label>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={() => onContinue({ archiveConsent, mixOptIn })}
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
            disabled={!archiveConsent}
          >
            Submit recording
          </Button>
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Go back
          </button>
        </div>

        <button
          onClick={() => setPrivacyOpen(true)}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Privacy / Info
        </button>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Privacy and Data Use</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Your voice recording is stored securely and used solely as part of this art project.
              Recordings become part of a collective archive and may be played back in exhibition
              settings. If you opt into the collective mix, your recording may be blended with others
              to create a shared composition. No personal identifying information is collected beyond
              your optional location data. You can request removal of your entry at any time by
              contacting the exhibition team.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
