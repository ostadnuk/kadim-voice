"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { ConsentState } from "@/lib/types"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSBlock, DSLabel, DSButton, DSBack, DSDivider, DSCheckbox, SignalBar, ACCENT, COLOR, FONT } from "./ds"

interface ScreenConsentProps {
  language: Language
  onContinue: (consent: ConsentState) => void
  onBack: () => void
}

export function ScreenConsent({ language, onContinue, onBack }: ScreenConsentProps) {
  const t   = translations[language].consent
  const dir = translations[language].direction

  const [archiveConsent, setArchiveConsent] = useState(false)
  const [mixOptIn,       setMixOptIn]       = useState(true)
  const [privacyOpen,    setPrivacyOpen]    = useState(false)

  return (
    <DSShell dir={dir}>
      <DSTopBar
        left={<SignalBar />}
        right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: ACCENT, opacity: 0.55 }}>{t.label}</span>}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <DSBlock>
            <div className="flex flex-col items-center gap-2 text-center">
              <DSLabel spacing="0.4em" opacity={0.65}>{t.heading}</DSLabel>
              <p style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: "clamp(1.4rem, 8vw, 2rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: ACCENT }}>{t.title}</p>
            </div>
          </DSBlock>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 4px" }}>
            <DSCheckbox checked={archiveConsent} onChange={setArchiveConsent}>{t.archive}</DSCheckbox>
            <DSDivider opacity={0.08} />
            <DSCheckbox checked={mixOptIn} onChange={setMixOptIn}>{t.mix}</DSCheckbox>
          </div>
        </div>
      </div>

      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
        <div className="flex items-end justify-between px-1 pb-1">
          <button onClick={() => setPrivacyOpen(true)} style={{ background: "none", border: "none", fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", color: ACCENT, opacity: 0.4, cursor: "pointer" }}>
            {t.privacyLink}
          </button>
          <DSBack onClick={onBack}>{t.back}</DSBack>
        </div>
        <DSButton onClick={() => onContinue({ archiveConsent, mixOptIn })} disabled={!archiveConsent}>{t.submit}</DSButton>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent style={{ background: COLOR.bg, border: `1px solid ${COLOR.veryDim}`, borderRadius: 0, color: COLOR.text, fontFamily: FONT.mono }} dir={dir}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.06em", textTransform: "uppercase", color: ACCENT }}>{t.privacyTitle}</DialogTitle>
            <DialogDescription style={{ fontSize: 12, lineHeight: 1.75, color: COLOR.secondary, letterSpacing: "0.04em" }}>{t.privacyBody}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </DSShell>
  )
}
