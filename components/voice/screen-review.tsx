"use client"

import { useState } from "react"
import type { RecordingState } from "@/lib/types"
import type { Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, AltSigTicker, InteriorBg, COLOR, FONT, TYPE, TRACK, OPACITY, TypewriterText } from "./ds"
import { VoiceSphere, SPHERE_FIXED, SPHERE_SIZE } from "./voice-sphere"

interface ScreenReviewProps {
  language:   Language
  recording:  RecordingState
  onContinue: () => void
  onReRecord: () => void
}

const CONTENT: Record<Language, { captured: string; duration: string; cta: string; rerecord: string }> = {
  en: {
    captured: "I've received your voice signature. Shall I keep it?",
    duration: "DURATION",
    cta:      "KEEP IT",
    rerecord: "No, record again",
  },
  he: {
    captured: "קיבלתי את חתימת הקול שלך, לשמור אותה אצלי?",
    duration: "משך",
    cta:      "שמור",
    rerecord: "לא, הקלט מחדש",
  },
  ar: {
    captured: "تلقيت توقيعك الصوتي، هل أحتفظ به؟",
    duration: "المدة",
    cta:      "احتفظ به",
    rerecord: "لا، سجّل مجدداً",
  },
}

export function ScreenReview({ language, recording, onContinue, onReRecord }: ScreenReviewProps) {
  const dir     = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const content = CONTENT[language]

  const [showUI, setShowUI] = useState(false)

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`

  return (
    <DSShell dir={dir}>
      <InteriorBg />
      <DSTopBar right={<AltSigTicker />} />

      {/* Sphere — ready mode: alive, breathing */}
      <div style={SPHERE_FIXED}>
        <div style={SPHERE_SIZE}>
          <VoiceSphere analyser={null} isRecording={false} mode="ready" />
        </div>
      </div>

      {/* HUD — top */}
      <div style={{
        position:      "absolute",
        top:           0, left: 0, right: 0,
        zIndex:        10,
        paddingTop:    "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
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
          {content.duration}  ·  {fmt(recording.duration)}
        </div>
      </div>

      {/* Text — bottom anchored, vessel voice style */}
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
          <TypewriterText text={content.captured} speed={38} onDone={() => setShowUI(true)} />
        </p>
      </div>

      {/* CTA + record again */}
      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4"
        style={{ paddingTop: 8, opacity: showUI ? 1 : 0, transition: "opacity 0.9s ease 0.3s" }}>
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onReRecord}>{content.rerecord}</DSBack>
        </div>
        <DSButton onClick={onContinue} color={COLOR.text}>{content.cta}</DSButton>
      </div>
    </DSShell>
  )
}
