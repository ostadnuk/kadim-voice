"use client"

import { SignatureRing } from "./signature-ring"
import { Waveform } from "./waveform"
import type { LocationState, RecordingState } from "@/lib/types"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSBlock, DSLabel, DSButton, DSBack, DSDivider, DSStatusLine, CoordsTicker, ACCENT, FONT } from "./ds"

interface ScreenResultProps {
  language:        Language
  recording:       RecordingState
  location:        LocationState
  signaturePoints: number[]
  timestamp:       string
  onArchive:       () => void
  onAnother:       () => void
}

export function ScreenResult({ language, recording, location, signaturePoints, timestamp, onArchive, onAnother }: ScreenResultProps) {
  const t   = translations[language].result
  const dir = translations[language].direction

  const locationLabel =
    location.sourceType === "exhibition" && location.venueName
      ? location.venueName
      : [location.city, location.country].filter(Boolean).join(", ") || "Remote"

  const formattedTime = new Date(timestamp).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })

  return (
    <DSShell dir={dir}>
      <DSTopBar
        left={<CoordsTicker />}
        right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: ACCENT, opacity: 0.7 }}>{t.added}</span>}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <DSBlock>
            <div className="flex flex-col items-center gap-2 text-center">
              <DSLabel spacing="0.4em" opacity={0.65}>{t.heading}</DSLabel>
              <p style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: "clamp(1.4rem, 8vw, 2rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: ACCENT, textShadow: `0 0 30px rgba(200,160,72,0.45)`, whiteSpace: "pre-line" }}>{t.title}</p>
            </div>
          </DSBlock>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <SignatureRing points={signaturePoints} size={160} animated />
          </div>

          <div className="w-full" style={{ padding: "0 4px" }}>
            <Waveform peaks={recording.waveformPeaks} height={40} />
          </div>

          <DSDivider opacity={0.15} />

          <div className="w-full" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 4px" }}>
            <DSStatusLine label={t.timestamp} value={formattedTime} />
            <DSDivider opacity={0.08} />
            <DSStatusLine label={t.location}  value={locationLabel} />
            <DSDivider opacity={0.08} />
            <DSStatusLine label={t.duration}  value={`${recording.duration}s`} />
          </div>
        </div>
      </div>

      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
        <div className="flex justify-end px-1 pb-1">
          <DSBack onClick={onAnother}>{t.another}</DSBack>
        </div>
        <DSButton onClick={onArchive}>{t.explore}</DSButton>
      </div>
    </DSShell>
  )
}
