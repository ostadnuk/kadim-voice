"use client"

import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { ScreenWelcome } from "./screen-welcome"
import { ScreenLanguage } from "./screen-language"
import { ScreenExhibition } from "./screen-exhibition"
import { ScreenWonderFlow } from "./screen-wonder-flow"
import { ScreenRecord } from "./screen-record"
import { ScreenLocation } from "./screen-location"
import { ScreenArchive } from "./screen-archive"
import { getVenueById } from "@/lib/mock-api"
import type { FlowStep, RecordingState, LocationState, ConsentState } from "@/lib/types"
import type { Language } from "@/lib/i18n"
import { LanguageProvider, StepProvider } from "./ds"

// ── Dev nav ───────────────────────────────────────────────────────────────────

const DEV_STEPS: Array<FlowStep | "archive"> = [
  "welcome", "language", "exhibition", "record", "location", "wunderflow", "archive",
]
// Note: "wonder" and "review" screens removed — dead code cleaned up

function mockRecording(): RecordingState {
  const dur   = 18
  const count = Math.max(40, dur * 4)
  const peaks = Array.from({ length: count }, (_, i) => {
    const base = Math.sin((i / count) * Math.PI) * 0.6
    return Math.max(0.05, base + (Math.random() - 0.5) * 0.4)
  })
  return { blob: new Blob([], { type: "audio/webm" }), duration: dur, waveformPeaks: peaks }
}

function mockLocation(): LocationState {
  return { sourceType: "remote", venueId: null, venueName: null, country: "Israel", city: "Tel Aviv", lat: null, lng: null }
}

function mockUploadResult() {
  return {
    id:              "dev-" + Math.random().toString(36).slice(2, 8),
    audioUrl:        "/mock-audio.webm",
    signaturePoints: Array.from({ length: 64 }, () => Math.random()),
  }
}

function DevNav({
  step, steps, onJump,
}: { step: FlowStep | "archive"; steps: typeof DEV_STEPS; onJump: (s: FlowStep | "archive") => void }) {
  const idx  = steps.indexOf(step)
  const prev = steps[idx - 1]
  const next = steps[idx + 1]

  return (
    <div style={{
      position:       "fixed",
      bottom:         0, left: 0, right: 0,
      zIndex:         9999,
      background:     "rgba(0,0,0,0.82)",
      backdropFilter: "blur(8px)",
      borderTop:      "1px solid rgba(255,255,255,0.08)",
      display:        "flex",
      alignItems:     "center",
      gap:            6,
      padding:        "6px 10px",
      overflowX:      "auto",
    }}>
      <button
        onClick={() => prev && onJump(prev)}
        disabled={!prev}
        style={{ color: prev ? "#aaa" : "#333", background: "none", border: "none", fontSize: 16, cursor: prev ? "pointer" : "default", padding: "2px 6px", flexShrink: 0 }}
      >←</button>

      {steps.map((s) => (
        <button
          key={s}
          onClick={() => onJump(s)}
          style={{
            background:    s === step ? "rgba(255,255,255,0.12)" : "none",
            border:        "1px solid",
            borderColor:   s === step ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
            color:         s === step ? "#fff" : "#666",
            borderRadius:  4,
            fontSize:      10,
            letterSpacing: "0.06em",
            padding:       "3px 8px",
            cursor:        "pointer",
            flexShrink:    0,
            textTransform: "uppercase",
          }}
        >
          {s}
        </button>
      ))}

      <button
        onClick={() => next && onJump(next)}
        disabled={!next}
        style={{ color: next ? "#aaa" : "#333", background: "none", border: "none", fontSize: 16, cursor: next ? "pointer" : "default", padding: "2px 6px", flexShrink: 0 }}
      >→</button>
    </div>
  )
}

export function VoiceApp() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get("venue_id")
  const venue = venueId ? getVenueById(venueId) : null

  const [step, setStep] = useState<FlowStep | "archive">("welcome")
  const [language, setLanguage] = useState<Language>("en")
  const [recording, setRecording] = useState<RecordingState | null>(null)
  const [location, setLocation] = useState<LocationState | null>(null)
  const [, setConsent] = useState<ConsentState | null>(null)

  const resetFlow = useCallback(() => {
    setStep("welcome")
    setRecording(null)
    setLocation(null)
    setConsent(null)
  }, [])

  const jumpTo = useCallback((target: FlowStep | "archive") => {
    // Seed whatever state is needed for the target screen
    if (["wonder", "wunderflow", "review", "upload", "result"].includes(target) && !recording) {
      setRecording(mockRecording())
    }
    if (["wonder", "wunderflow", "result"].includes(target) && !location) {
      setLocation(mockLocation())
    }
    setStep(target)
  }, [recording, location])

  if (step === "welcome") {
    return (
      <>
        <ScreenWelcome onContinue={() => setStep("language")} />
      </>
    )
  }

  if (step === "language") {
    return (
      <>
        <ScreenLanguage onSelect={(lang) => { setLanguage(lang); setStep("exhibition") }} />
      </>
    )
  }

  function inner() {
    switch (step) {
      case "exhibition":
        return (
          <ScreenExhibition
            language={language}
            onContinue={() => setStep("record")}
          />
        )

      case "record":
        return (
          <ScreenRecord
            language={language}
            onComplete={(rec) => {
              setRecording(rec)
              setStep("location")
            }}
            onBack={() => setStep("exhibition")}
          />
        )

      case "location":
        return (
          <ScreenLocation
            language={language}
            venueId={venue?.id ?? null}
            venueName={venue?.name ?? null}
            onContinue={(loc) => {
              setLocation(loc)
              setConsent({ archiveConsent: true, mixOptIn: true })
              setStep("wunderflow")
            }}
            onBack={() => setStep("record")}
          />
        )

      case "wunderflow":
        if (!recording || !location) return null
        return (
          <ScreenWonderFlow
            language={language}
            waveformPeaks={recording.waveformPeaks}
            duration={recording.duration}
            location={location}
            audioBlob={recording.blob ?? new Blob([], { type: "audio/webm" })}
            mixOptIn={true}
            onArchive={() => setStep("archive")}
          />
        )

      case "archive":
        return <ScreenArchive language={language} onBack={resetFlow} />

      default:
        return null
    }
  }

  // Actual 5-step flow: exhibition(1) → record(2) → location(3) → wunderflow(4) → archive(5)
  const stepNumber: Record<string, number> = {
    exhibition: 1, record: 2, location: 3, wunderflow: 4, archive: 5,
  }

  return (
    <LanguageProvider lang={language} setLang={setLanguage}>
      <StepProvider step={stepNumber[step] ?? 0}>
        {inner()}
      </StepProvider>
    </LanguageProvider>
  )
}
