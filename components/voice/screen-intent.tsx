"use client"

import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, DSDivider, SignalBar, COLOR, FONT } from "./ds"

interface ScreenIntentProps {
  language: Language
  prompt?:  string
  onRecord: () => void
  onSkip:   () => void
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

const LABEL: Record<Language, string> = {
  en: "— TRANSMISSION BRIEF —",
  he: "— תדריך השידור —",
  ar: "— موجز الإرسال —",
}

const SUB: Record<Language, string> = {
  en: "Say this. Or say anything. The signature is yours.",
  he: "אמור זאת. או כל דבר אחר. החתימה היא שלך.",
  ar: "قل هذا. أو قل أي شيء. التوقيع لك.",
}

const SKIP: Record<Language, string> = {
  en: "skip — record freely",
  he: "דלג — הקלט בחופשיות",
  ar: "تخطّ — سجّل بحرية",
}

export function ScreenIntent({ language, prompt, onRecord, onSkip }: ScreenIntentProps) {
  const t     = translations[language].intent
  const dir   = translations[language].direction
  const color = LANG_COLOR[language]
  const font  = LANG_FONT[language]

  return (
    <DSShell dir={dir}>
      <DSTopBar
        left={<SignalBar color={color} />}
        right={
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color, opacity: 0.45 }}>
            VESSEL · INTERIOR
          </span>
        }
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5">
        <div className="flex w-full max-w-sm flex-col gap-5">

          {/* Label */}
          <span style={{
            fontFamily:    FONT.mono, fontSize: 10,
            letterSpacing: "0.3em", textTransform: "uppercase",
            color, opacity: 0.4, display: "block",
            textAlign:     dir === "rtl" ? "right" : "left",
          }}>
            {LABEL[language]}
          </span>

          <DSDivider color={color} opacity={0.12} />

          {/* The prompt — large, lit, transmitted */}
          <p style={{
            fontFamily:    font,
            fontWeight:    language === "en" ? 700 : 600,
            fontSize:      "clamp(1.3rem, 7vw, 2rem)",
            lineHeight:    1.35,
            color,
            opacity:       0.92,
            margin:        0,
            textShadow:    `0 0 30px ${color}55`,
            textAlign:     dir === "rtl" ? "right" : "left",
            letterSpacing: language === "en" ? "0.02em" : "0",
          }}>
            {`"${prompt ?? t.defaultPrompt}"`}
          </p>

          <DSDivider color={color} opacity={0.08} />

          {/* Sub */}
          <p style={{
            fontFamily:    FONT.mono, fontSize: "clamp(11px, 3vw, 12px)",
            lineHeight:    1.7, letterSpacing: "0.06em",
            color:         COLOR.text, opacity: 0.38,
            margin:        0,
            textAlign:     dir === "rtl" ? "right" : "left",
          }}>
            {SUB[language]}
          </p>

        </div>
      </div>

      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onSkip}>{SKIP[language]}</DSBack>
        </div>
        <DSButton onClick={onRecord} color={color}>
          {t.record}
        </DSButton>
      </div>
    </DSShell>
  )
}
