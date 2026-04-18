"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { analyzeAudioBlob } from "@/lib/audio-analysis"
import type { LocationState } from "@/lib/types"
import { DSShell, DSTopBar, DSButton, AltSigTicker, InteriorBg, COLOR, FONT, TYPE, TRACK, OPACITY } from "./ds"

type UploadStatus = "analyzing" | "uploading" | "done" | "error"

interface ScreenUploadProps {
  audioBlob:     Blob
  durationSec:   number
  waveformPeaks: number[]
  location:      LocationState
  mixOptIn:      boolean
  onComplete:    (result: { id: string; audioUrl: string; signaturePoints: number[] }) => void
}

const STATUS_COPY: Record<UploadStatus, { hud: string; label: string }> = {
  analyzing:  { hud: "READING SIGNAL",       label: "Extracting your acoustic fingerprint…" },
  uploading:  { hud: "TRANSMITTING SIGNAL",  label: "Sending your voice into the archive…" },
  done:       { hud: "SIGNATURE STORED",     label: "Your voice has been received." },
  error:      { hud: "TRANSMISSION FAILED",  label: "Something went wrong. Try again." },
}

const HUD_COLOR: Record<UploadStatus, string> = {
  analyzing:  "#d97a96",
  uploading:  "#7dd4a0",
  done:       "#7dd4a0",
  error:      "#be5a2c",
}

const HUD_GLOW: Record<UploadStatus, string> = {
  analyzing:  "0 0 8px rgba(217,122,150,0.7), 0 0 20px rgba(217,122,150,0.35)",
  uploading:  "0 0 8px rgba(125,212,160,0.7), 0 0 20px rgba(125,212,160,0.35)",
  done:       "0 0 8px rgba(125,212,160,0.7), 0 0 20px rgba(125,212,160,0.35)",
  error:      "0 0 8px rgba(212,105,58,0.7),  0 0 20px rgba(212,105,58,0.35)",
}

export function ScreenUpload({ audioBlob, durationSec, waveformPeaks, location, mixOptIn, onComplete }: ScreenUploadProps) {
  const [status, setStatus] = useState<UploadStatus>("analyzing")
  const hasStarted = useRef(false)

  const startUpload = useCallback(async () => {
    try {
      // Step 1: real client-side audio analysis
      setStatus("analyzing")
      const { waveformPeaks: realPeaks, signaturePoints } = await analyzeAudioBlob(audioBlob)
      const peaks = realPeaks.length > 0 ? realPeaks : waveformPeaks

      // Step 2: upload blob + metadata to Supabase via API route
      setStatus("uploading")
      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")
      formData.append("meta", JSON.stringify({
        durationSec,
        signaturePoints,
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
      const data: { id: string; audioUrl: string } = await res.json()

      setStatus("done")
      setTimeout(() => {
        onComplete({ id: data.id, audioUrl: data.audioUrl, signaturePoints })
      }, 1800)
    } catch (err) {
      console.error("Upload failed:", err)
      setStatus("error")
    }
  }, [audioBlob, waveformPeaks, location, mixOptIn, onComplete])

  useEffect(() => {
    if (!hasStarted.current) { hasStarted.current = true; startUpload() }
  }, [startUpload])

  const copy = STATUS_COPY[status]

  return (
    <DSShell>
      <style>{`@keyframes rec-dot { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
      <InteriorBg />
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
          color:         HUD_COLOR[status],
          textShadow:    HUD_GLOW[status],
          opacity:       0.95,
          transition:    "color 0.6s ease, text-shadow 0.6s ease",
          display:       "flex",
          alignItems:    "center",
          gap:           8,
        }}>
          {(status === "uploading" || status === "analyzing") && (
            <span style={{
              width:        5,
              height:       5,
              borderRadius: "50%",
              background:   "currentColor",
              display:      "inline-block",
              animation:    "rec-dot 1.2s ease-in-out infinite",
              flexShrink:   0,
            }} />
          )}
          {copy.hud}
        </div>
      </div>

      {/* Bottom label + retry on error */}
      <div className="relative z-10 flex flex-1 flex-col justify-end">
        <div className="ds-safe-bottom flex flex-col gap-4 px-4" style={{ paddingBottom: "clamp(2rem, 8vw, 3.5rem)" }}>
          <p style={{
            fontFamily: FONT.base,
            fontWeight: 400,
            fontSize:   TYPE.lg,
            lineHeight: 1.65,
            color:      COLOR.text,
            opacity:    OPACITY.primary,
            margin:     0,
            transition: "opacity 0.5s ease",
          }}>
            {copy.label}
          </p>
          {status === "error" && (
            <DSButton onClick={() => { hasStarted.current = false; startUpload() }} color={COLOR.text}>
              TRY AGAIN
            </DSButton>
          )}
        </div>
      </div>
    </DSShell>
  )
}
