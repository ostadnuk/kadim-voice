"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Waveform } from "./waveform"
import type { RecordingState } from "@/lib/types"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, SignalBar, COLOR, FONT } from "./ds"

interface ScreenReviewProps {
  language:   Language
  recording:  RecordingState
  onContinue: () => void
  onReRecord: () => void
}

const LANG_COLOR: Record<Language, string> = {
  en: "#c8a048",
  he: "#c07848",
  ar: "#50b09a",
}

const LANG_FONT: Record<Language, string> = {
  en: "'narkiss-yair-variable', sans-serif",
  he: "'narkiss-yair-variable', sans-serif",
  ar: "'narkiss-yair-variable', sans-serif",
}

const CONTENT: Record<Language, { label: string; captured: string; duration: string; cta: string; rerecord: string }> = {
  en: {
    label:    "VESSEL · INTERIOR",
    captured: "Signature captured.",
    duration: "DURATION",
    cta:      "LOCK IN MY SIGNATURE",
    rerecord: "record again",
  },
  he: {
    label:    "כלי · פנים",
    captured: "חתימה נקלטה.",
    duration: "משך",
    cta:      "נעל את החתימה שלי",
    rerecord: "הקלט שוב",
  },
  ar: {
    label:    "الإناء · داخل",
    captured: "تم التقاط التوقيع.",
    duration: "المدة",
    cta:      "أثبّت توقيعي",
    rerecord: "سجّل مجدداً",
  },
}

export function ScreenReview({ language, recording, onContinue, onReRecord }: ScreenReviewProps) {
  const dir     = translations[language].direction
  const color   = LANG_COLOR[language]
  const font    = LANG_FONT[language]
  const content = CONTENT[language]

  const [isPlaying, setIsPlaying] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef   = useRef<string | null>(null)

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`

  useEffect(() => {
    if (recording.blob) {
      urlRef.current = URL.createObjectURL(recording.blob)
      const audio = new Audio(urlRef.current)
      audioRef.current = audio
      audio.addEventListener("ended",      () => { setIsPlaying(false); setProgress(0) })
      audio.addEventListener("timeupdate", () => { if (audio.duration) setProgress(audio.currentTime / audio.duration) })
      return () => { audio.pause(); if (urlRef.current) URL.revokeObjectURL(urlRef.current) }
    }
  }, [recording.blob])

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false) }
    else           { audioRef.current.play();  setIsPlaying(true)  }
  }, [isPlaying])

  return (
    <DSShell dir={dir}>
      <style>{`
        @keyframes play-ring {
          0%,100% { transform: scale(1);    opacity: var(--ro); }
          50%      { transform: scale(1.07); opacity: calc(var(--ro) * 1.9); }
        }
        @keyframes sig-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <DSTopBar
        left={<SignalBar color={color} />}
        right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color, opacity: 0.45 }}>{content.label}</span>}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between px-5 py-4">

        {/* Header */}
        <div style={{ animation: "sig-in 0.7s ease both", paddingTop: "clamp(0.5rem, 3vw, 1.2rem)" }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.3em", color, opacity: 0.4, marginBottom: 10 }}>
            — {content.duration}: {fmt(recording.duration)} —
          </div>
          <p style={{
            fontFamily: font, fontWeight: language === "en" ? 600 : 500,
            fontSize: "clamp(1.4rem, 7vw, 2rem)", lineHeight: 1.2,
            color, opacity: 0.95, margin: 0,
            textShadow: `0 0 30px ${color}55`,
            textAlign: dir === "rtl" ? "right" : "left",
          }}>
            {content.captured}
          </p>
        </div>

        {/* Waveform */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "sig-in 0.7s ease 0.15s both" }}>
          <Waveform
            peaks={recording.waveformPeaks}
            progress={progress}
            height={72}
            barColor={`${color}44`}
            activeColor={color}
          />
          {/* Progress track */}
          <div style={{ width: "100%", height: 1, background: COLOR.veryDim }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: color, transition: "width 0.1s linear" }} />
          </div>
        </div>

        {/* Play button */}
        <div style={{ display: "flex", justifyContent: "center", animation: "sig-in 0.7s ease 0.3s both" }}>
          <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isPlaying && [100, 72].map((size, i) => (
              <div key={i} style={{
                position: "absolute", width: size, height: size, borderRadius: "50%",
                border: `1px solid ${color}`,
                // @ts-expect-error css var
                "--ro": [0.15, 0.25][i],
                animation: `play-ring ${["2s", "1.4s"][i]} ease-in-out ${i * 0.3}s infinite`,
              }} />
            ))}
            <button
              onClick={togglePlayback}
              aria-label={isPlaying ? "Pause" : "Play"}
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background:  isPlaying ? color : "transparent",
                border:      `2px solid ${color}`,
                display:     "flex", alignItems: "center", justifyContent: "center",
                cursor:      "pointer",
                transition:  "background 0.3s ease, box-shadow 0.3s ease",
                boxShadow:   isPlaying ? `0 0 24px ${color}55` : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {isPlaying
                ? <div style={{ width: 14, height: 14, display: "flex", gap: 4 }}>
                    <div style={{ flex: 1, background: COLOR.bg }} />
                    <div style={{ flex: 1, background: COLOR.bg }} />
                  </div>
                : <div style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "7px 0 7px 13px", borderColor: `transparent transparent transparent ${color}`, marginLeft: 3 }} />
              }
            </button>
          </div>
        </div>

      </div>

      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4" style={{ paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onReRecord}>{content.rerecord}</DSBack>
        </div>
        <DSButton onClick={onContinue} color={color}>{content.cta}</DSButton>
      </div>
    </DSShell>
  )
}
