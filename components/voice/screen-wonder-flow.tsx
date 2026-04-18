"use client"

/**
 * ScreenWonderFlow — fully automatic wonder → upload → imprint experience.
 *
 * Phases:
 *   0–5.5 s  calm reading: soft dim cloud drifts, story text staggers in, metrics appear
 *   5.5–9 s  active: cloud brightens and morphs to voice shape
 *   9 s+     upload done: cloud morphs to unique Chladni imprint pattern
 *   14.5 s+  archive CTA appears
 */

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import type { Language } from "@/lib/i18n"
import type { LocationState } from "@/lib/types"
import { translations } from "@/lib/i18n"
import { analyzeAudioBlob } from "@/lib/audio-analysis"
import { DSShell, DSTopBar, DSButton, AltSigTicker, COLOR, FONT, TYPE, TRACK, OPACITY } from "./ds"
import type { CanvasPhase } from "./voice-canvas-unified"
import { MORPH_A_DONE_AT } from "./voice-canvas-unified"

const VoiceCanvasUnified = dynamic(
  () => import("./voice-canvas-unified").then((m) => m.VoiceCanvasUnified),
  { ssr: false }
)

// ── Band colors (match canvas shader uniforms) ─────────────────────────────────
const BAND = {
  amp:    "#e8a87c",  // warm amber  — amplitude
  pitch:  "#7dd4c0",  // teal        — pitch
  timbre: "#c4a8e8",  // soft violet — timbre
} as const

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
  captured: string; transmitting: string; savedHud: string
  amp: string; pitch: string; timbre: string
  savedTitle: string
  saveToArchive: string
  retryError: string
}> = {
  en: {
    captured:      "SIGNATURE FORMING",
    transmitting:  "TRANSMITTING SIGNAL",
    savedHud:      "SIGNATURE FORMED",
    amp: "AMPLITUDE", pitch: "PITCH", timbre: "TIMBRE",
    savedTitle:    "Your voice is now\npart of the archive.",
    saveToArchive: "SAVE MY SIGNATURE TO THE ARCHIVE",
    retryError:    "Transmission failed. Retrying…",
  },
  he: {
    captured:      "חתימה נוצרת",
    transmitting:  "שידור אות",
    savedHud:      "חתימה נוצרה",
    amp: "עוצמה", pitch: "גובה", timbre: "גוון",
    savedTitle:    "קולך הוא עכשיו\nחלק מהארכיון.",
    saveToArchive: "שמור את חתימתי לארכיון",
    retryError:    "שידור נכשל. מנסה שוב…",
  },
  ar: {
    captured:      "البصمة تتشكّل",
    transmitting:  "إرسال الإشارة",
    savedHud:      "البصمة تشكّلت",
    amp: "الشدة", pitch: "النبرة", timbre: "الجرس",
    savedTitle:    "أصبح صوتك الآن\nجزءاً من الأرشيف.",
    saveToArchive: "احفظ بصمتي في الأرشيف",
    retryError:    "فشل الإرسال. جارٍ الإعادة…",
  },
}

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

// ── Props ──────────────────────────────────────────────────────────────────────

interface ScreenWonderFlowProps {
  language:      Language
  waveformPeaks: number[]
  duration:      number
  location:      LocationState
  audioBlob:     Blob
  mixOptIn:      boolean
  onArchive:     () => void
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function ScreenWonderFlow({
  language, waveformPeaks, duration, location, audioBlob, mixOptIn, onArchive,
}: ScreenWonderFlowProps) {
  const dir = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const lbl = LABELS[language]
  const t   = translations[language].result

  const locationLabel = location.sourceType === "exhibition" && location.venueName
    ? location.venueName
    : [location.city, location.country].filter(Boolean).join(", ") || "Remote"

  const [bassE, midE, highE] = deriveEnergies(waveformPeaks)

  const [canvasPhase,     setCanvasPhase]     = useState<CanvasPhase>("wonder")
  const [signaturePoints, setSignaturePoints] = useState<number[] | null>(null)
  const [uploadError,     setUploadError]     = useState(false)
  const [visibleLines,    setVisibleLines]    = useState(0)
  const [formattedTime] = useState(() => new Date().toLocaleString(
    language === "en" ? "en-GB" : language === "he" ? "he-IL" : "ar-SA",
    { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
  ))
  // Live cosmic time (T+ Unix seconds)
  const [cosmicTime, setCosmicTime] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setCosmicTime(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Track mount time so we can delay imprint until morph A is done
  const mountTimeRef = useRef(Date.now())

  const archiveCtaRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = archiveCtaRef.current
    if (el) { el.style.opacity = "0"; el.style.pointerEvents = "none" }
  }, [])

  // ── Story text + metrics stagger (5 reveals: 4 lines + metrics row) ─────────
  useEffect(() => {
    const delays = [800, 2000, 3200, 4400, 5600]
    const ts = delays.map((d, i) => setTimeout(() => setVisibleLines(i + 1), d))
    return () => ts.forEach(clearTimeout)
  }, [])

  // ── Upload — starts automatically on mount ───────────────────────────────────
  const hasStartedUpload = useRef(false)

  const runUpload = useCallback(async () => {
    if (hasStartedUpload.current) return
    hasStartedUpload.current = true
    setUploadError(false)
    setCanvasPhase("transmitting")

    try {
      const { waveformPeaks: realPeaks, signaturePoints: sigPts } = await analyzeAudioBlob(audioBlob)
      const peaks = realPeaks.length > 0 ? realPeaks : waveformPeaks

      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")
      formData.append("meta", JSON.stringify({
        durationSec:     duration,
        signaturePoints: sigPts,
        waveformPeaks:   peaks,
        sourceType:      location.sourceType,
        venueId:         location.venueId,
        venueName:       location.venueName,
        country:         location.country,
        city:            location.city,
        lat:             location.lat,
        lng:             location.lng,
        consentVersion:  "1.0",
        mixOptIn,
      }))

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error(await res.text())

      // Delay imprint until morph A has completed (canvas needs ~9s from mount)
      const elapsed = (Date.now() - mountTimeRef.current) / 1000
      const waitMs  = Math.max((MORPH_A_DONE_AT + 0.5 - elapsed) * 1000, 0)

      setTimeout(() => {
        setSignaturePoints(sigPts)
        setCanvasPhase("imprint")
        // Archive CTA appears after imprint pattern has settled (~5.5s)
        setTimeout(() => {
          const el = archiveCtaRef.current
          if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto" }
        }, 5500)
      }, waitMs)

    } catch (err) {
      console.error("Upload failed:", err)
      setUploadError(true)
      setCanvasPhase("wonder")
      hasStartedUpload.current = false
      setTimeout(() => {
        if (hasStartedUpload.current === false) runUpload()
      }, 3000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, waveformPeaks, duration, location, mixOptIn])

  useEffect(() => {
    const timer = setTimeout(runUpload, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── HUD ─────────────────────────────────────────────────────────────────────
  const hudColor = canvasPhase === "imprint"      ? "#7dd4a0"
                 : canvasPhase === "transmitting" ? "#d97a96"
                 : "#7dd4a0"
  const hudGlow  = canvasPhase === "imprint"
    ? "0 0 8px rgba(125,212,160,0.6), 0 0 20px rgba(125,212,160,0.28)"
    : canvasPhase === "transmitting"
    ? "0 0 8px rgba(217,122,150,0.6), 0 0 20px rgba(217,122,150,0.28)"
    : "0 0 8px rgba(125,212,160,0.5), 0 0 18px rgba(125,212,160,0.25)"
  const hudLabel = canvasPhase === "imprint"      ? lbl.savedHud
                 : canvasPhase === "transmitting" ? lbl.transmitting
                 : lbl.captured

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DSShell dir={dir}>
      <style>{`@keyframes rec-dot { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>

      {/* TopBar — only during wonder/transmitting */}
      <div style={{
        opacity: canvasPhase === "imprint" ? 0 : 1,
        transition: "opacity 0.8s ease",
        pointerEvents: canvasPhase === "imprint" ? "none" : "auto",
      }}>
        <DSTopBar right={<AltSigTicker />} />
      </div>

      {/* Persistent canvas */}
      <VoiceCanvasUnified
        waveformPeaks={waveformPeaks}
        signaturePoints={signaturePoints}
        phase={canvasPhase}
      />

      {/* HUD — process states (wonder / transmitting) */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", gap: "0.35rem",
        alignItems: dir === "rtl" ? "flex-end" : "flex-start",
        opacity: canvasPhase === "imprint" ? 0 : 1,
        transition: "opacity 0.8s ease",
      }}>
        <div style={{
          fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs,
          letterSpacing: TRACK.caps, textTransform: "uppercase",
          color: hudColor, textShadow: hudGlow, opacity: 0.9,
          display: "flex", alignItems: "center", gap: 7,
          transition: "color 0.8s ease, text-shadow 0.8s ease",
        }}>
          {canvasPhase === "transmitting" && (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: "rec-dot 1.2s ease-in-out infinite", flexShrink: 0 }} />
          )}
          {hudLabel}
        </div>
        <div style={{
          fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs,
          letterSpacing: TRACK.sm, color: COLOR.text, opacity: OPACITY.tertiary, direction: "ltr",
        }}>
          {fmtDuration(duration)}  ·  {locationLabel}
        </div>
      </div>

      {/* Imprint top indicator — replaces HUD when pattern is revealed */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: "max(1.25rem, calc(env(safe-area-inset-top) + 0.5rem))",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
        opacity: canvasPhase === "imprint" ? 1 : 0,
        transition: "opacity 1s ease 1.5s",
      }}>
        <div style={{
          fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs,
          letterSpacing: TRACK.caps, textTransform: "uppercase",
          color: "#7dd4a0",
          textShadow: "0 0 8px rgba(125,212,160,0.6), 0 0 20px rgba(125,212,160,0.28)",
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
          {lbl.savedHud}
        </div>
      </div>

      {/* Story + metrics — visible during wonder/transmitting, fade when imprint starts */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
        opacity: canvasPhase === "imprint" ? 0 : 1,
        transition: "opacity 1s ease",
      }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
          paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
          paddingBottom: "clamp(6rem, 16vw, 8rem)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.5rem, 1.5vw, 0.75rem)" }}>

            {/* Story lines */}
            {STORY_LINES[language].map((line, i) => (
              <p key={i} style={{
                fontFamily: FONT.base, fontWeight: i === STORY_LINES[language].length - 1 ? 500 : 400,
                fontSize: TYPE.lg,
                lineHeight: 1.65,
                color: COLOR.text,
                opacity: visibleLines > i ? (i === STORY_LINES[language].length - 1 ? OPACITY.primary : 0.38) : 0,
                margin: 0, textAlign: dir === "rtl" ? "right" : "left",
                transition: "opacity 1.6s ease",
              }}>
                {line}
              </p>
            ))}

            {/* Colored metrics row — fades in as 5th element */}
            <div style={{
              display: "flex",
              flexDirection: dir === "rtl" ? "row-reverse" : "row",
              gap: "clamp(1rem, 4vw, 1.75rem)",
              opacity: visibleLines > 4 ? 1 : 0,
              transition: "opacity 1.6s ease",
              marginTop: "clamp(0.25rem, 1vw, 0.5rem)",
            }}>
              {/* AMPLITUDE — amber */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 300, fontSize: "0.6rem",
                  letterSpacing: TRACK.caps, textTransform: "uppercase",
                  color: BAND.amp, opacity: 0.7,
                }}>
                  {lbl.amp}
                </span>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 500, fontSize: TYPE.sm,
                  color: BAND.amp,
                  textShadow: `0 0 12px ${BAND.amp}80`,
                }}>
                  {Math.round(bassE * 100)}%
                </span>
              </div>

              {/* PITCH — teal */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 300, fontSize: "0.6rem",
                  letterSpacing: TRACK.caps, textTransform: "uppercase",
                  color: BAND.pitch, opacity: 0.7,
                }}>
                  {lbl.pitch}
                </span>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 500, fontSize: TYPE.sm,
                  color: BAND.pitch,
                  textShadow: `0 0 12px ${BAND.pitch}80`,
                }}>
                  {Math.round(midE * 100)}%
                </span>
              </div>

              {/* TIMBRE — violet */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 300, fontSize: "0.6rem",
                  letterSpacing: TRACK.caps, textTransform: "uppercase",
                  color: BAND.timbre, opacity: 0.7,
                }}>
                  {lbl.timbre}
                </span>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 500, fontSize: TYPE.sm,
                  color: BAND.timbre,
                  textShadow: `0 0 12px ${BAND.timbre}80`,
                }}>
                  {Math.round(highE * 100)}%
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Imprint text — large statement + single metadata line */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
        opacity: canvasPhase === "imprint" ? 1 : 0,
        transition: "opacity 1.4s ease 1.2s",
      }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
          paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
          paddingBottom: "clamp(5rem, 14vw, 7rem)",
          display: "flex", flexDirection: "column",
          alignItems: dir === "rtl" ? "flex-end" : "flex-start",
          gap: "0.45rem",
        }}>
          {/* Main statement — large */}
          <p style={{
            fontFamily: FONT.base, fontWeight: 600,
            fontSize: "clamp(1.9rem, 7vw, 2.8rem)",
            lineHeight: 1.2,
            color: COLOR.text, opacity: OPACITY.primary,
            margin: 0, textAlign: dir === "rtl" ? "right" : "left",
          }}>
            {t.title.replace("\n", " ")}
          </p>

          {/* Metrics row — same colors as canvas bands */}
          <div style={{
            display: "flex",
            flexDirection: dir === "rtl" ? "row-reverse" : "row",
            gap: "clamp(1rem, 4vw, 1.75rem)",
            marginTop: "0.35rem",
          }}>
            {[
              { label: lbl.amp,    val: Math.round(bassE * 100), color: BAND.amp },
              { label: lbl.pitch,  val: Math.round(midE  * 100), color: BAND.pitch },
              { label: lbl.timbre, val: Math.round(highE * 100), color: BAND.timbre },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: FONT.base, fontWeight: 300, fontSize: "0.55rem", letterSpacing: TRACK.caps, textTransform: "uppercase", color, opacity: 0.7 }}>
                  {label}
                </span>
                <span style={{ fontFamily: FONT.base, fontWeight: 500, fontSize: TYPE.sm, color, textShadow: `0 0 10px ${color}70` }}>
                  {val}%
                </span>
              </div>
            ))}
          </div>

          {/* Cosmic + earth time */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: "0.25rem" }}>
            <p style={{ fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color: COLOR.text, opacity: OPACITY.tertiary * 0.6, margin: 0, direction: "ltr" }}>
              T+ {cosmicTime.toLocaleString("en-US")}
            </p>
            <p style={{ fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color: COLOR.text, opacity: OPACITY.tertiary * 0.8, margin: 0, direction: "ltr" }}>
              {locationLabel}  ·  {formattedTime}
            </p>
          </div>
        </div>
      </div>

      {/* Subtle error notice */}
      {uploadError && (
        <div style={{
          position: "absolute", top: "clamp(5rem, 15vw, 7rem)",
          left: "clamp(1.25rem, 6vw, 2.5rem)", right: "clamp(1.25rem, 6vw, 2.5rem)",
          zIndex: 12, pointerEvents: "none",
        }}>
          <p style={{ fontFamily: FONT.base, fontSize: TYPE.xs, color: COLOR.error, opacity: 0.7, margin: 0 }}>
            {lbl.retryError}
          </p>
        </div>
      )}

      {/* Archive CTA — fixed at bottom, appears only when pattern has settled */}
      <div ref={archiveCtaRef} className="ds-safe-bottom px-4"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, paddingTop: 8, transition: "opacity 1.2s ease" }}>
        <DSButton onClick={onArchive} color={COLOR.text}>{lbl.saveToArchive}</DSButton>
      </div>

    </DSShell>
  )
}
