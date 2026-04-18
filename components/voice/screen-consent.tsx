"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { ConsentState } from "@/lib/types"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, DSDivider, DSCheckbox, AltSigTicker, InteriorBg, COLOR, FONT, TYPE, TRACK, OPACITY, TOUCH_MIN, TypewriterText } from "./ds"

interface ScreenConsentProps {
  language:   Language
  onContinue: (consent: ConsentState) => void
  onBack:     () => void
}

export function ScreenConsent({ language, onContinue, onBack }: ScreenConsentProps) {
  const t   = translations[language].consent
  const dir = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"

  const [archiveConsent, setArchiveConsent] = useState(false)
  const [mixOptIn,       setMixOptIn]       = useState(true)
  const [privacyOpen,    setPrivacyOpen]    = useState(false)
  const [showUI,         setShowUI]         = useState(false)

  return (
    <DSShell dir={dir}>
      <InteriorBg />
      <DSTopBar right={<AltSigTicker />} />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%", maxWidth: 340 }}>

          <div style={{ textAlign: dir === "rtl" ? "right" : "left" }}>
            <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps, color: COLOR.text, opacity: OPACITY.tertiary, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              {t.heading.replace(/^[—\s]+|[—\s]+$/g, "")}
            </span>
            <p style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.5, color: COLOR.text, opacity: OPACITY.primary, margin: 0 }}>
              <TypewriterText text={t.title} speed={30} onDone={() => setShowUI(true)} />
            </p>
          </div>

          <div style={{ opacity: showUI ? 1 : 0, transition: "opacity 0.9s ease", pointerEvents: showUI ? "auto" : "none", display: "flex", flexDirection: "column", gap: 20 }}>
            <DSCheckbox checked={archiveConsent} onChange={setArchiveConsent}>{t.archive}</DSCheckbox>
            <DSDivider opacity={0.08} />
            <DSCheckbox checked={mixOptIn} onChange={setMixOptIn}>{t.mix}</DSCheckbox>
          </div>
        </div>
      </div>

      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => setPrivacyOpen(true)}
            style={{
              background: "none", border: "none",
              fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps,
              color: COLOR.text, opacity: OPACITY.tertiary,
              cursor: "pointer", minHeight: TOUCH_MIN, display: "flex", alignItems: "center",
            }}
          >
            {t.privacyLink}
          </button>
          <DSBack onClick={onBack}>{t.back}</DSBack>
        </div>
        <DSButton onClick={() => onContinue({ archiveConsent, mixOptIn })} disabled={!archiveConsent} color={COLOR.text}>
          {t.submit}
        </DSButton>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent style={{ background: COLOR.bg, border: `1px solid ${COLOR.veryDim}`, borderRadius: 0, color: COLOR.text, fontFamily: FONT.base }} dir={dir}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.base, letterSpacing: TRACK.caps, textTransform: "uppercase", color: COLOR.text }}>
              {t.privacyTitle}
            </DialogTitle>
            <DialogDescription style={{ fontFamily: FONT.base, fontSize: TYPE.xs, lineHeight: 1.75, color: COLOR.secondary, letterSpacing: TRACK.en }}>
              {t.privacyBody}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </DSShell>
  )
}
