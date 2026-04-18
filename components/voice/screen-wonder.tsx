"use client"

import { useEffect, useState, useRef, useLayoutEffect } from "react"
import dynamic from "next/dynamic"
import type { Language } from "@/lib/i18n"
import type { LocationState } from "@/lib/types"
import { DSShell, DSTopBar, DSButton, DSBack, AltSigTicker, COLOR, FONT, TYPE, TRACK, OPACITY } from "./ds"

const VoicePointCloud = dynamic(
  () => import("./voice-point-cloud").then((m) => m.VoicePointCloud),
  { ssr: false }
)

interface ScreenWonderProps {
  language:      Language
  waveformPeaks: number[]
  duration:      number
  location:      LocationState
  onContinue:    () => void
  onReRecord:    () => void
}

// ── Copy ───────────────────────────────────────────────────────────────────────

const STORY_LINES: Record<Language, string[]> = {
  en: [
    "Amplitude. Pitch. Cadence. Timbre.",
    "Each dimension is yours alone.",
    "Their combination has never existed before.",
    "This is your voice signature.",
  ],
  he: [
    "עוצמה. גובה. קצב. גוון.",
    "כל מאפיין שייך לך בלבד.",
    "השילוב שלהם לא קיים באף קול אחר.",
    "זוהי חתימת הקול שלך.",
  ],
  ar: [
    "الشدة. النبرة. الإيقاع. الجرس.",
    "كل بُعد خاص بك وحدك.",
    "تركيبتها لم توجد في أي صوت آخر.",
    "هذه هي بصمتك الصوتية.",
  ],
}

const LABELS: Record<Language, {
  captured: string
  amp: string; pitch: string; timbre: string
  save: string; reRecord: string
}> = {
  en: { captured: "SIGNATURE FORMING", amp: "AMPLITUDE", pitch: "PITCH",  timbre: "TIMBRE", save: "SAVE MY VOICE", reRecord: "Re-record"   },
  he: { captured: "חתימה נוצרת",       amp: "עוצמה",     pitch: "גובה",   timbre: "גוון",   save: "שמור את קולי", reRecord: "הקלט מחדש"   },
  ar: { captured: "البصمة تتشكّل",     amp: "الشدة",     pitch: "النبرة", timbre: "الجرس",  save: "احفظ صوتي",    reRecord: "أعد التسجيل" },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveEnergies(peaks: number[]): [number, number, number] {
  if (!peaks.length) return [0.33, 0.34, 0.33]
  const n = peaks.length; const third = Math.floor(n / 3)
  const avg = (a: number, b: number) => {
    const s = peaks.slice(a, b); return s.reduce((ac, v) => ac + v, 0) / Math.max(s.length, 1)
  }
  const bass = avg(0, third); const mid = avg(third, third * 2); const high = avg(third * 2, n)
  const sum = bass + mid + high || 1
  return [bass / sum, mid / sum, high / sum]
}

function fmtDuration(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function ScreenWonder({ language, waveformPeaks, duration, location, onContinue, onReRecord }: ScreenWonderProps) {
  const dir    = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const lbl    = LABELS[language]
  const lines  = STORY_LINES[language]

  const locationLabel = location.sourceType === "exhibition" && location.venueName
    ? location.venueName
    : [location.city, location.country].filter(Boolean).join(", ") || "Remote"

  const [ts] = useState(() => new Date().toLocaleString(
    language === "en" ? "en-GB" : language === "he" ? "he-IL" : "ar-SA",
    { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
  ))

  const [bassE, midE, highE] = deriveEnergies(waveformPeaks)
  const bassP = Math.round(bassE * 100)
  const midP  = Math.round(midE  * 100)
  const highP = Math.round(highE * 100)

  const dataLine = `${lbl.amp} ${bassP}%  ·  ${lbl.pitch} ${midP}%  ·  ${lbl.timbre} ${highP}%`
  const allLines = [...lines, dataLine]

  const [visibleLines, setVisibleLines] = useState(0)

  // CTA shown via ref — no React re-render so opacity transition is never disrupted
  const ctaRef = useRef<HTMLDivElement>(null)

  // Hide before first paint — keeps opacity out of JSX so React never re-applies it
  useLayoutEffect(() => {
    const el = ctaRef.current
    if (el) { el.style.opacity = "0"; el.style.pointerEvents = "none" }
  }, [])

  useEffect(() => {
    const delays   = [800, 2000, 3200, 4400, 5600]
    const ctaDelay = 7200
    const timers   = delays.map((d, i) => setTimeout(() => setVisibleLines(i + 1), d))
    const ctaTimer = setTimeout(() => {
      const el = ctaRef.current
      if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto" }
    }, ctaDelay)
    return () => { timers.forEach(clearTimeout); clearTimeout(ctaTimer) }
  }, [])

  return (
    <DSShell dir={dir}>
      <DSTopBar right={<AltSigTicker />} />

      <VoicePointCloud data={waveformPeaks} mode="forming" />

      {/* HUD */}
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
        alignItems:    dir === "rtl" ? "flex-end" : "flex-start",
      }}>
        <div style={{
          fontFamily:    FONT.base,
          fontWeight:    300,
          fontSize:      TYPE.xs,
          letterSpacing: TRACK.caps,
          textTransform: "uppercase",
          color:         "#7dd4a0",
          textShadow:    "0 0 8px rgba(125,212,160,0.5), 0 0 18px rgba(125,212,160,0.25)",
          opacity:       0.90,
        }}>
          {lbl.captured}
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
          {fmtDuration(duration)}  ·  {locationLabel}  ·  {ts}
        </div>
      </div>

      {/* Story text — bottom anchored */}
      <div className="relative z-10 flex flex-1 flex-col justify-end"
        style={{
          paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
          paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
          paddingBottom: "clamp(2rem, 8vw, 3.5rem)",
        }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.5rem, 1.5vw, 0.75rem)" }}>
          {allLines.map((line, i) => {
            const isData = i === allLines.length - 1
            return (
              <p key={i} style={{
                fontFamily:    FONT.base,
                fontWeight:    isData ? 300 : 400,
                fontSize:      isData ? TYPE.xs : TYPE.lg,
                letterSpacing: isData ? TRACK.caps : undefined,
                lineHeight:    1.65,
                color:         isData ? "#7dd4a0" : COLOR.text,
                textShadow:    isData ? "0 0 8px rgba(125,212,160,0.4)" : undefined,
                opacity:       visibleLines > i
                  ? (isData ? 0.85 : i === allLines.length - 2 ? OPACITY.primary : 0.38)
                  : 0,
                margin:        0,
                textAlign:     dir === "rtl" ? "right" : "left",
                transition:    "opacity 1.6s ease",
              }}>
                {line}
              </p>
            )
          })}
        </div>
      </div>

      {/* CTAs — ref-driven opacity, no translateY */}
      <div
        ref={ctaRef}
        className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4"
        style={{
          paddingTop: 8,
          transition: "opacity 1.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onReRecord}>{lbl.reRecord}</DSBack>
        </div>
        <DSButton onClick={onContinue} color={COLOR.text}>{lbl.save}</DSButton>
      </div>
    </DSShell>
  )
}
