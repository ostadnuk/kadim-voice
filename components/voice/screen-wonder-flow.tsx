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
  cosmicTime: string
  sigPrefix: string
  remote: string
  saveToArchive: string
  retryError: string
}> = {
  en: {
    captured:      "SIGNATURE FORMING",
    transmitting:  "TRANSMITTING SIGNAL",
    savedHud:      "SIGNATURE FORMED",
    amp: "DEPTH", pitch: "TONE", timbre: "CLARITY",
    cosmicTime:    "COSMIC TIME",
    sigPrefix:     "VOICE #",
    remote:        "Remote",
    saveToArchive: "SAVE MY SIGNATURE TO THE ARCHIVE",
    retryError:    "Transmission failed. Retrying…",
  },
  he: {
    captured:      "חתימה נוצרת",
    transmitting:  "שידור אות",
    savedHud:      "חתימה נוצרה",
    amp: "עומק", pitch: "גוון", timbre: "בהירות",
    cosmicTime:    "זמן קוסמי",
    sigPrefix:     "קול מספר ",
    remote:        "מרחוק",
    saveToArchive: "שמור את חתימתי לארכיון",
    retryError:    "שידור נכשל. מנסה שוב…",
  },
  ar: {
    captured:      "البصمة تتشكّل",
    transmitting:  "إرسال الإشارة",
    savedHud:      "البصمة تشكّلت",
    amp: "عمق", pitch: "لون", timbre: "وضوح",
    cosmicTime:    "الزمن الكوني",
    sigPrefix:     "صوت #",
    remote:        "عن بُعد",
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
  onArchive:     (entryId: string) => void
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function ScreenWonderFlow({
  language, waveformPeaks, duration, location, audioBlob, mixOptIn, onArchive,
}: ScreenWonderFlowProps) {
  const dir = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const lbl = LABELS[language]

  const locationLabel = location.sourceType === "exhibition" && location.venueName
    ? location.venueName
    : [location.city, location.country].filter(Boolean).join(", ") || lbl.remote

  const [bassE, midE, highE] = deriveEnergies(waveformPeaks)

  // Derive approximate Hz values from energy fractions — unique per voice
  const bassHz  = Math.round(60   + bassE  * 220)   // ~60–280 Hz
  const midHz   = Math.round(300  + midE   * 2700)  // ~300–3000 Hz
  const highHz  = Math.round(3200 + highE  * 8800)  // ~3200–12000 Hz

  const [canvasPhase,      setCanvasPhase]      = useState<CanvasPhase>("wonder")
  const [signaturePoints,  setSignaturePoints]  = useState<number[] | null>(null)
  const [signatureNumber,  setSignatureNumber]  = useState<number | null>(null)
  const [uploadedId,       setUploadedId]       = useState<string | null>(null)
  const [uploadError,      setUploadError]      = useState(false)
  const [uploadAttempts,   setUploadAttempts]   = useState(0)
  const [uploadGaveUp,     setUploadGaveUp]     = useState(false)
  const [enteringVessel,   setEnteringVessel]   = useState(false)
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

  // ── Upload — two phases: fast analysis → immediate Chladni, then network upload ─
  const hasStartedUpload  = useRef(false)
  const analysisRunRef    = useRef(false)       // analysis runs once; upload may retry
  const cachedSigPtsRef   = useRef<number[]>([])
  const cachedPeaksRef    = useRef<number[]>(waveformPeaks)
  const imprintTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleImprint = useCallback(() => {
    if (imprintTimerRef.current) return   // already scheduled
    const elapsed = (Date.now() - mountTimeRef.current) / 1000
    const waitMs  = Math.max((MORPH_A_DONE_AT + 0.5 - elapsed) * 1000, 0)
    imprintTimerRef.current = setTimeout(() => {
      setCanvasPhase("imprint")
      setTimeout(() => {
        const el = archiveCtaRef.current
        if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto" }
      }, 5500)
    }, waitMs)
  }, [])

  const runUpload = useCallback(async () => {
    if (hasStartedUpload.current) return
    hasStartedUpload.current = true
    setUploadError(false)
    setCanvasPhase("transmitting")

    // ── Step 1: analysis — runs once, triggers Chladni immediately ────────────
    if (!analysisRunRef.current) {
      analysisRunRef.current = true
      try {
        const { waveformPeaks: realPeaks, signaturePoints: sigPts } = await analyzeAudioBlob(audioBlob)
        cachedSigPtsRef.current   = sigPts
        cachedPeaksRef.current    = realPeaks.length > 0 ? realPeaks : waveformPeaks
      } catch {
        // analysis failed — sigPts stays empty, canvas will use voice shape
        cachedPeaksRef.current = waveformPeaks
      }
      // Set signaturePoints NOW — canvas starts building Chladni in the background.
      // MorphB only fires when phase = "imprint", which is gated on MORPH_A_DONE_AT.
      // That gives the geometry ~7s to compute before the morph starts.
      setSignaturePoints(cachedSigPtsRef.current)
      scheduleImprint()
    }

    // ── Step 2: network upload — may fail and retry without re-running analysis ─
    try {
      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")
      formData.append("meta", JSON.stringify({
        durationSec:     duration,
        signaturePoints: cachedSigPtsRef.current,
        waveformPeaks:   cachedPeaksRef.current,
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

      const uploadResult = await res.json()
      setUploadedId(uploadResult.id ?? null)
      if (typeof uploadResult.signatureNumber === "number") {
        setSignatureNumber(uploadResult.signatureNumber)
      }

    } catch (err) {
      console.error("Upload failed:", err)
      setUploadError(true)
      hasStartedUpload.current = false   // allow retry of upload only
      setUploadAttempts(prev => {
        const next = prev + 1
        if (next >= 3) {
          setUploadGaveUp(true)
        } else {
          // Exponential backoff: 3s, 6s, 12s
          setTimeout(() => {
            if (hasStartedUpload.current === false) runUpload()
          }, 3000 * Math.pow(2, prev))
        }
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, waveformPeaks, duration, location, mixOptIn, scheduleImprint])

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
        exiting={enteringVessel}
      />

      {/* ── TOP RAIL — unified HUD for all phases, same grid as landing ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", gap: "0.4rem",
        direction: dir,          // RTL-aware: flex-start = reading-start side
      }}>

        {/* Status label — color shifts from amber→green on imprint */}
        <div style={{
          fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs,
          letterSpacing: TRACK.caps, textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 7,
          color: canvasPhase === "imprint" ? "#7dd4a0" : hudColor,
          textShadow: canvasPhase === "imprint"
            ? "0 0 8px rgba(125,212,160,0.6), 0 0 20px rgba(125,212,160,0.28)"
            : hudGlow,
          opacity: 0.9,
          transition: "color 1s ease, text-shadow 1s ease",
        }}>
          {canvasPhase === "transmitting" && (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: "rec-dot 1.2s ease-in-out infinite", flexShrink: 0 }} />
          )}
          {canvasPhase === "imprint" && (
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
          )}
          {hudLabel}
        </div>

        {/* Duration · location — fades out on imprint */}
        <div style={{
          fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs,
          letterSpacing: TRACK.sm, color: COLOR.text, opacity: canvasPhase === "imprint" ? 0 : OPACITY.tertiary,
          direction: "ltr", textAlign: dir === "rtl" ? "right" : "left",
          transition: "opacity 0.8s ease",
        }}>
          {fmtDuration(duration)}  ·  {locationLabel}
        </div>

        {/* Hz metrics — always visible (transmitting + imprint), reading-start aligned */}
        <div style={{
          display: "flex", flexDirection: "row",
          justifyContent: "flex-start",   // in RTL context this is right-aligned ✓
          gap: "clamp(1.25rem, 5vw, 2rem)",
          marginTop: "0.25rem",
        }}>
          {([
            { label: lbl.amp,    hz: bassHz,  color: BAND.amp },
            { label: lbl.pitch,  hz: midHz,   color: BAND.pitch },
            { label: lbl.timbre, hz: highHz,  color: BAND.timbre },
          ] as const).map(({ label, hz, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{
                fontFamily: FONT.base, fontWeight: 300,
                fontSize: "clamp(0.6rem, 2vw, 0.72rem)",
                letterSpacing: TRACK.caps, textTransform: "uppercase",
                color, opacity: 0.7,
              }}>
                {label}
              </span>
              <span style={{
                fontFamily: FONT.base, fontWeight: 600,
                fontSize: "clamp(1rem, 3.8vw, 1.25rem)",
                letterSpacing: "-0.01em", color,
                textShadow: `0 0 14px ${color}70`,
                direction: "ltr",
              }}>
                {hz.toLocaleString("en-US")}<span style={{ fontWeight: 300, fontSize: "0.6em", opacity: 0.6, marginLeft: "0.2em" }}>Hz</span>
              </span>
            </div>
          ))}
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


          </div>
        </div>
      </div>

      {/* ── BOTTOM READOUT — mirrors landing RA/DEC/VEL zone ── */}
      {/* Signature breathes free in center; data anchors to bottom corner    */}
      <div style={{
        position: "absolute", bottom: "clamp(5.5rem, 18vw, 7.5rem)",
        left: 0, right: 0, zIndex: 9, pointerEvents: "none",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        display: "flex", flexDirection: "column",
        direction: dir,              // cascade RTL; flex-start = reading-start
        alignItems: "flex-start",   // reading-start side (right in RTL, left in LTR)
        gap: "0.45rem",
        opacity: canvasPhase === "imprint" ? 1 : 0,
        transition: "opacity 1.4s ease 2s",
      }}>
        {/* Signature number — hero line, like the voice-count on the landing */}
        {signatureNumber !== null && (
          <p style={{
            fontFamily: FONT.base, fontWeight: 700,
            fontSize: "clamp(2rem, 8vw, 3rem)",
            letterSpacing: "-0.02em", lineHeight: 1,
            color: "#edf4ff",
            textShadow: "0 0 24px rgba(125,212,160,0.35)",
            margin: 0, direction: "ltr",
          }}>
            {lbl.sigPrefix}{signatureNumber.toLocaleString("en-US")}
          </p>
        )}

        {/* Cosmic time — like RA (right ascension) readout */}
        <p style={{
          fontFamily: FONT.base, fontWeight: 300,
          fontSize: "clamp(0.8rem, 2.8vw, 0.95rem)",
          letterSpacing: TRACK.sm, color: COLOR.text, opacity: 0.45,
          margin: 0, direction: "ltr",
        }}>
          <span style={{ textTransform: "uppercase", letterSpacing: TRACK.caps, fontSize: "0.78em", opacity: 0.65, marginRight: "0.5em" }}>
            {lbl.cosmicTime}
          </span>
          {cosmicTime.toLocaleString("en-US")}
        </p>

        {/* Location · timestamp — like DEC/VEL readout */}
        <p style={{
          fontFamily: FONT.base, fontWeight: 300,
          fontSize: "clamp(0.8rem, 2.8vw, 0.95rem)",
          letterSpacing: TRACK.sm, color: COLOR.text, opacity: 0.5,
          margin: 0, direction: "ltr",
        }}>
          {locationLabel}  ·  {formattedTime}
        </p>
      </div>

      {/* Error notice — auto-retry or manual retry */}
      {uploadError && (
        <div style={{
          position: "absolute", top: "clamp(5rem, 15vw, 7rem)",
          left: "clamp(1.25rem, 6vw, 2.5rem)", right: "clamp(1.25rem, 6vw, 2.5rem)",
          zIndex: 12,
          display: "flex", flexDirection: "column",
          alignItems: dir === "rtl" ? "flex-end" : "flex-start",
          gap: 8,
        }}>
          <p style={{ fontFamily: FONT.base, fontSize: TYPE.xs, color: COLOR.error, opacity: 0.7, margin: 0 }}>
            {lbl.retryError}
          </p>
          {uploadGaveUp && (
            <button
              onClick={() => {
                setUploadGaveUp(false)
                setUploadAttempts(0)
                setUploadError(false)
                runUpload()
              }}
              style={{
                fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps,
                color: COLOR.text, background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "6px 14px", cursor: "pointer",
              }}
            >
              {language === "he" ? "נסה שוב" : language === "ar" ? "أعد المحاولة" : "RETRY"}
            </button>
          )}
        </div>
      )}

      {/* Archive CTA — fixed at bottom, appears only when pattern has settled */}
      <div ref={archiveCtaRef} className="ds-safe-bottom px-4"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, paddingTop: 8, transition: "opacity 1.2s ease" }}>
        <DSButton
          onClick={() => {
            setEnteringVessel(true)
            setTimeout(() => onArchive(uploadedId ?? ""), 1000)
          }}
          color={COLOR.text}
        >
          {lbl.saveToArchive}
        </DSButton>
      </div>

      {/* Vessel entry fade — black-out before transitioning into the archive */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "#070c17",
        opacity: enteringVessel ? 1 : 0,
        transition: "opacity 0.9s ease",
        pointerEvents: "none",
      }} />

    </DSShell>
  )
}
