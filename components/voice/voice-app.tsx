"use client"

import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { ScreenWelcome } from "./screen-welcome"
import { ScreenLanguage } from "./screen-language"
import { ScreenExhibition } from "./screen-exhibition"
import { ScreenRecord } from "./screen-record"
import { ScreenReview } from "./screen-review"
import { ScreenLocation } from "./screen-location"
import { ScreenConsent } from "./screen-consent"
import { ScreenUpload } from "./screen-upload"
import { ScreenResult } from "./screen-result"
import { ScreenArchive } from "./screen-archive"
import { getVenueById } from "@/lib/mock-api"
import type { FlowStep, RecordingState, LocationState, ConsentState } from "@/lib/types"
import type { Language } from "@/lib/i18n"
import { LanguageProvider } from "./ds"

export function VoiceApp() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get("venue_id")
  const venue = venueId ? getVenueById(venueId) : null

  const [step, setStep] = useState<FlowStep | "archive">("welcome")
  const [language, setLanguage] = useState<Language>("en")
  const [recording, setRecording] = useState<RecordingState | null>(null)
  const [location, setLocation] = useState<LocationState | null>(null)
  const [, setConsent] = useState<ConsentState | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    id: string
    audioUrl: string
    signaturePoints: number[]
  } | null>(null)

  const resetFlow = useCallback(() => {
    setStep("welcome")
    setRecording(null)
    setLocation(null)
    setConsent(null)
    setUploadResult(null)
  }, [])

  if (step === "welcome") {
    return (
      <ScreenWelcome
        onContinue={() => setStep("language")}
      />
    )
  }

  if (step === "language") {
    return (
      <ScreenLanguage
        onSelect={(lang) => {
          setLanguage(lang)
          setStep("exhibition")
        }}
      />
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
              setStep("review")
            }}
            onBack={() => setStep("exhibition")}
          />
        )

      case "review":
        if (!recording) return null
        return (
          <ScreenReview
            language={language}
            recording={recording}
            onContinue={() => setStep("location")}
            onReRecord={() => {
              setRecording(null)
              setStep("record")
            }}
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
              setStep("consent")
            }}
            onBack={() => setStep("review")}
          />
        )

      case "consent":
        return (
          <ScreenConsent
            language={language}
            onContinue={(c) => {
              setConsent(c)
              setStep("upload")
            }}
            onBack={() => setStep("location")}
          />
        )

      case "upload":
        if (!recording?.blob) return null
        return (
          <ScreenUpload
            audioBlob={recording.blob}
            onComplete={(result) => {
              setUploadResult(result)
              setStep("result")
            }}
          />
        )

      case "result":
        if (!recording || !location || !uploadResult) return null
        return (
          <ScreenResult
            language={language}
            recording={recording}
            location={location}
            signaturePoints={uploadResult.signaturePoints}
            timestamp={new Date().toISOString()}
            onArchive={() => setStep("archive")}
            onAnother={resetFlow}
          />
        )

      case "archive":
        return <ScreenArchive language={language} onBack={resetFlow} />

      default:
        return null
    }
  }

  return (
    <LanguageProvider lang={language} setLang={setLanguage}>
      {inner()}
    </LanguageProvider>
  )
}
