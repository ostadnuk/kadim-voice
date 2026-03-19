"use client"

import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { ScreenIntro } from "./screen-intro"
import { ScreenIntent } from "./screen-intent"
import { ScreenRecord } from "./screen-record"
import { ScreenReview } from "./screen-review"
import { ScreenLocation } from "./screen-location"
import { ScreenConsent } from "./screen-consent"
import { ScreenUpload } from "./screen-upload"
import { ScreenResult } from "./screen-result"
import { ScreenArchive } from "./screen-archive"
import { getVenueById } from "@/lib/mock-api"
import type { FlowStep, RecordingState, LocationState, ConsentState } from "@/lib/types"

export function VoiceApp() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get("venue_id")
  const venue = venueId ? getVenueById(venueId) : null

  const [step, setStep] = useState<FlowStep | "archive">("intro")
  const [recording, setRecording] = useState<RecordingState | null>(null)
  const [location, setLocation] = useState<LocationState | null>(null)
  const [, setConsent] = useState<ConsentState | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    id: string
    audioUrl: string
    signaturePoints: number[]
  } | null>(null)

  const resetFlow = useCallback(() => {
    setStep("intro")
    setRecording(null)
    setLocation(null)
    setConsent(null)
    setUploadResult(null)
  }, [])

  switch (step) {
    case "intro":
      return (
        <ScreenIntro
          onStart={() => setStep("intent")}
          onArchive={() => setStep("archive")}
        />
      )

    case "intent":
      return (
        <ScreenIntent
          onRecord={() => setStep("record")}
          onSkip={() => setStep("record")}
        />
      )

    case "record":
      return (
        <ScreenRecord
          onComplete={(rec) => {
            setRecording(rec)
            setStep("review")
          }}
          onBack={() => setStep("intent")}
        />
      )

    case "review":
      if (!recording) return null
      return (
        <ScreenReview
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
          recording={recording}
          location={location}
          signaturePoints={uploadResult.signaturePoints}
          timestamp={new Date().toISOString()}
          onArchive={() => setStep("archive")}
          onAnother={resetFlow}
        />
      )

    case "archive":
      return <ScreenArchive onBack={resetFlow} />

    default:
      return null
  }
}
