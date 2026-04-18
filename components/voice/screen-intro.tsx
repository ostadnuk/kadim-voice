"use client"

import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, SignalBar, DSDivider, COLOR, FONT, LANG_COLOR, TYPE, TRACK, OPACITY } from "./ds"

interface ScreenIntroProps {
  language:  Language
  onStart:   () => void
  onArchive: () => void
}

const LANG_FONT: Record<Language, string> = {
  en: "'narkiss-yair-variable', sans-serif",
  he: "'narkiss-yair-variable', sans-serif",
  ar: "'narkiss-yair-variable', sans-serif",
}

const CONTENT: Record<Language, {
  label:   string
  lines:   string[]
  cta:     string
  archive: string
}> = {
  en: {
    label:   "— YOUR SIGNATURE —",
    lines: [
      "Speak for up to thirty seconds — anything you want to send forward.",
      "Your signature joins 2,847 others already inside this vessel.",
      "Once it leaves this room, so do they. So does yours.",
    ],
    cta:     "BEGIN RECORDING",
    archive: "explore archive",
  },
  he: {
    label:   "— החתימה שלך —",
    lines: [
      "דבר עד שלושים שניות — כל מה שתרצה לשלוח קדימה.",
      "החתימה שלך מצטרפת ל-2,847 חתימות שכבר בתוך הכלי.",
      "כשהוא עוזב את החדר הזה — הן עוזבות. גם שלך.",
    ],
    cta:     "התחל הקלטה",
    archive: "עיין בארכיון",
  },
  ar: {
    label:   "— توقيعك —",
    lines: [
      "تحدث حتى ثلاثين ثانية — أي شيء تريد إرساله إلى الأمام.",
      "توقيعك ينضم إلى 2٬847 توقيعاً داخل هذا الإناء.",
      "حين يغادر هذه الغرفة — تغادر معه. توقيعك أيضاً.",
    ],
    cta:     "ابدأ التسجيل",
    archive: "استكشف الأرشيف",
  },
}

export function ScreenIntro({ language, onStart, onArchive }: ScreenIntroProps) {
  const color   = LANG_COLOR[language]
  const font    = LANG_FONT[language]
  const dir     = translations[language].direction
  const content = CONTENT[language]

  return (
    <DSShell dir={dir}>
      <style>{`
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1);    opacity: var(--ro); }
          50%       { transform: scale(1.07); opacity: calc(var(--ro) * 1.8); }
        }
      `}</style>

      <DSTopBar
        
        right={
          <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color, opacity: OPACITY.primary }}>
            VESSEL · INTERIOR
          </span>
        }
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between px-5 pt-4">

        {/* Rings — smaller, ambient */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "clamp(0.5rem, 3vw, 1.5rem)" }}>
          <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {[
              { size: 120, opacity: 0.06, delay: "0s" },
              { size:  84, opacity: 0.11, delay: "0.5s" },
              { size:  48, opacity: 0.22, delay: "1s" },
            ].map(({ size, opacity, delay }, i) => (
              <div key={i} style={{
                position:     "absolute",
                width:        size, height: size,
                borderRadius: "50%",
                border:       `1px solid ${color}`,
                // @ts-expect-error css var
                "--ro":       opacity,
                animation:    `ring-pulse 3.8s ease-in-out ${delay} infinite`,
              }} />
            ))}
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, opacity: 0.7 }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1rem, 4vw, 1.5rem)" }}>

          {/* Label */}
          <span style={{
            fontFamily: FONT.base, fontSize: TYPE.hud,
            letterSpacing: TRACK.caps, textTransform: "uppercase",
            color, opacity: OPACITY.tertiary, display: "block",
            textAlign: dir === "rtl" ? "right" : "left",
          }}>
            {content.label}
          </span>

          <DSDivider color={color} opacity={0.12} />

          {/* Three lines — what / why / why now */}
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.5rem, 5vw, 2rem)" }}>
            {content.lines.map((line, i) => (
              <p key={i} style={{
                fontFamily:    font,
                fontWeight:    i === 2 ? (language === "en" ? 700 : 600) : 400,
                fontSize:      i === 2 ? TYPE.lg : TYPE.base,
                lineHeight:    1.75,
                color:         i === 2 ? color : COLOR.text,
                opacity:       i === 0 ? OPACITY.secondary : i === 1 ? OPACITY.primary : OPACITY.full,
                margin:        0,
                letterSpacing: language === "en" ? "0.01em" : "0",
                textAlign:     dir === "rtl" ? "right" : "left",
                textShadow:    i === 2 ? `0 0 20px ${color}44` : "none",
              }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4 pt-4">
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onArchive}>{content.archive}</DSBack>
        </div>
        <DSButton onClick={onStart} color={color}>
          {content.cta}
        </DSButton>
      </div>
    </DSShell>
  )
}
