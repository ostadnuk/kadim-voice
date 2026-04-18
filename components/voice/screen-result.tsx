"use client"

import { useRef, useLayoutEffect } from "react"
import dynamic from "next/dynamic"
import type { LocationState, RecordingState } from "@/lib/types"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, AltSigTicker, COLOR, FONT, TYPE, TRACK, OPACITY, TypeLine } from "./ds"

const VoiceImprint = dynamic(
  () => import("./voice-imprint").then((m) => m.VoiceImprint),
  { ssr: false }
)

interface ScreenResultProps {
  language:        Language
  recording:       RecordingState
  location:        LocationState
  signaturePoints: number[]
  timestamp:       string
  onArchive:       () => void
  onAnother:       () => void
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ScreenResult({ language, recording, location, signaturePoints, timestamp, onArchive, onAnother }: ScreenResultProps) {
  const t   = translations[language].result
  const dir = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"

  const ctaRef     = useRef<HTMLDivElement>(null)
  const timestampRef = useRef<HTMLParagraphElement>(null)

  // Hide before first paint — keeps opacity out of JSX so React never re-applies it
  useLayoutEffect(() => {
    const cta = ctaRef.current
    const ts  = timestampRef.current
    if (cta) { cta.style.opacity = "0"; cta.style.pointerEvents = "none" }
    if (ts)  ts.style.opacity = "0"
  }, [])

  function showUI() {
    const cta = ctaRef.current
    const ts  = timestampRef.current
    if (cta) { cta.style.opacity = "1"; cta.style.pointerEvents = "auto" }
    if (ts)  ts.style.opacity = String(OPACITY.tertiary * 0.7)
  }

  const locationLabel =
    location.sourceType === "exhibition" && location.venueName
      ? location.venueName
      : [location.city, location.country].filter(Boolean).join(", ") || "Remote"

  const formattedTime = new Date(timestamp).toLocaleString(
    language === "en" ? "en-GB" : language === "he" ? "he-IL" : "ar-SA",
    { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
  )

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`

  return (
    <DSShell dir={dir}>
      <VoiceImprint signaturePoints={signaturePoints} />
      <DSTopBar right={<AltSigTicker />} />

      {/* HUD — top */}
      <div style={{
        position:      "absolute",
        top:           0, left: 0, right: 0,
        zIndex:        10,
        paddingTop:    "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
        display:       "flex",
        flexDirection: "column",
        gap:           "0.35rem",
      }}>
        <div style={{
          fontFamily:    FONT.base,
          fontWeight:    300,
          fontSize:      TYPE.xs,
          letterSpacing: TRACK.caps,
          textTransform: "uppercase",
          color:         "#7dd4a0",
          textShadow:    "0 0 8px rgba(125,212,160,0.6), 0 0 20px rgba(125,212,160,0.28)",
          opacity:       0.95,
          direction:     "ltr",
        }}>
          {t.label}
        </div>
        <div style={{
          fontFamily:    FONT.base,
          fontWeight:    300,
          fontSize:      TYPE.xs,
          letterSpacing: TRACK.sm,
          color:         COLOR.text,
          opacity:       OPACITY.tertiary,
          direction:     "ltr",
        }}>
          {fmt(recording.duration)} · {locationLabel}
        </div>
      </div>

      {/* Vessel text — bottom */}
      <div className="relative z-10 flex flex-1 flex-col justify-end"
        style={{ paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)", paddingRight: "clamp(1.25rem, 6vw, 2.5rem)", paddingBottom: "clamp(2rem, 8vw, 3.5rem)" }}>
        <p style={{
          fontFamily:  FONT.base,
          fontWeight:  400,
          fontSize:    TYPE.lg,
          lineHeight:  1.65,
          color:       COLOR.text,
          opacity:     OPACITY.primary,
          margin:      0,
          direction:   dir,
          textAlign:   dir === "rtl" ? "right" : "left",
        }}>
          <TypeLine text={t.title.replace("\n", " ")} speed={24} onDone={showUI} />
        </p>
        <p ref={timestampRef} style={{
          fontFamily:  FONT.base,
          fontWeight:  300,
          fontSize:    TYPE.xs,
          letterSpacing: TRACK.sm,
          color:       COLOR.text,
          margin:      "0.5rem 0 0",
          direction:   "ltr",
          transition:  "opacity 1s ease 0.3s",
        }}>
          {formattedTime}
        </p>
      </div>

      {/* CTA */}
      <div ref={ctaRef} className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4"
        style={{ paddingTop: 8, transition: "opacity 0.9s ease 0.3s" }}>
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onAnother}>{t.another}</DSBack>
        </div>
        <DSButton onClick={onArchive} color={COLOR.text}>{t.explore}</DSButton>
      </div>
    </DSShell>
  )
}
