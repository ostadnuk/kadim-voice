"use client"

import { useState, useEffect } from "react"
import type { Language } from "@/lib/i18n"
import { COLOR, FONT, LANG_COLOR, TYPE, TRACK, OPACITY, TOUCH_MIN } from "./ds"

interface ScreenLanguageProps {
  onSelect: (lang: Language) => void
}

const ENTRIES: {
  code:    Language
  text:    string
  font:    string
  weight:  number
  color:   string
  dir:     "ltr" | "rtl"
  ch:      string
  freq:    string
}[] = [
  { code: "en", text: "ENTER",  font: "'narkiss-yair-variable', sans-serif",         weight: 700, color: LANG_COLOR.en, dir: "ltr", ch: "CH·01", freq: "440.00" },
  { code: "he", text: "כניסה",  font: "'narkiss-yair-variable', sans-serif",     weight: 700, color: LANG_COLOR.he, dir: "rtl", ch: "CH·02", freq: "528.00" },
  { code: "ar", text: "ادخل",   font: "'narkiss-yair-variable', sans-serif",           weight: 700, color: LANG_COLOR.ar, dir: "rtl", ch: "CH·03", freq: "639.00" },
]

const BAR_COUNT = 9

function WaveBar({ color, active }: { color: string; active: boolean }) {
  const [bars, setBars] = useState(() => Array.from({ length: BAR_COUNT }, (_, i) => 0.15 + Math.abs(Math.sin(i * 0.9)) * 0.3))

  useEffect(() => {
    const interval = active ? 70 : 180
    const id = setInterval(() => {
      const t = Date.now() / 1000
      setBars(prev => prev.map((_, i) =>
        active
          ? 0.15 + Math.random() * 0.85
          : 0.1 + Math.abs(Math.sin(t * 0.6 + i * 0.7)) * 0.25
      ))
    }, interval)
    return () => clearInterval(id)
  }, [active])

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width:      4,
            height:     `${h * 100}%`,
            background: color,
            opacity:    active ? 0.85 : 0.22,
            transition: `height ${active ? 60 : 160}ms ease, opacity 0.3s`,
          }}
        />
      ))}
    </div>
  )
}

function LiveFreq({ base, color, active }: { base: string; color: string; active: boolean }) {
  const [val, setVal] = useState(base)

  useEffect(() => {
    if (!active) { setVal(base); return }
    const id = setInterval(() => {
      const jitter = (Math.random() * 0.08 - 0.04).toFixed(2).replace("-", "")
      const n = (parseFloat(base) + parseFloat(jitter)).toFixed(2)
      setVal(n)
    }, 90)
    return () => clearInterval(id)
  }, [active, base])

  return (
    <span style={{
      fontFamily: FONT.base,
      fontSize:   TYPE.hud,
      letterSpacing: TRACK.sm,
      color,
      opacity: active ? 0.9 : OPACITY.tertiary,
      transition: "opacity 0.25s",
    }}>
      {val} kHz
    </span>
  )
}

export function ScreenLanguage({ onSelect }: ScreenLanguageProps) {
  const [hovered, setHovered] = useState<Language | null>(null)
  const [visible, setVisible]  = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center"
      style={{ background: COLOR.bg }}
    >
      <div className="ds-scanlines" />

      <div
        className="relative z-10 flex flex-col items-center w-full max-w-xs select-none"
        style={{
          gap:     "clamp(1.5rem, 5vw, 2.5rem)",
          opacity: visible ? 1 : 0,
          transition: "opacity 1.2s ease",
          padding: "0 2rem",
        }}
      >
        {ENTRIES.map(({ code, text, font, weight, color, dir, ch, freq }, idx) => {
          const isActive = hovered === code
          const isDimmed = hovered !== null && !isActive

          return (
            <button
              key={code}
              onClick={() => onSelect(code)}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background:  "none",
                border:      "none",
                cursor:      "pointer",
                padding:     0,
                width:       "100%",
                minHeight:   TOUCH_MIN,
                display:     "flex",
                flexDirection: "column",
                alignItems:  "center",
                gap:         8,
                opacity:     isDimmed ? 0.08 : 1,
                transition:  "opacity 0.3s ease",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* channel row */}
              <div style={{
                width:       "100%",
                display:     "flex",
                justifyContent: "space-between",
                alignItems:  "center",
                opacity:     visible ? 1 : 0,
                transition:  `opacity 0.6s ease ${idx * 0.15}s`,
              }}>
                <span style={{
                  fontFamily: FONT.base,
                  fontSize:   TYPE.hud,
                  letterSpacing: TRACK.wide,
                  color,
                  opacity: isActive ? 0.9 : OPACITY.tertiary,
                  transition: "opacity 0.25s",
                }}>
                  {ch}
                </span>
                <LiveFreq base={freq} color={color} active={isActive} />
              </div>

              {/* main word */}
              <span style={{
                fontFamily:    font,
                fontWeight:    weight,
                fontSize:      "clamp(3rem, 16vw, 6.5rem)",
                letterSpacing: code === "en" ? "0.1em" : "0.03em",
                textTransform: code === "en" ? "uppercase" : "none",
                color,
                direction:     dir,
                lineHeight:    1,
                textShadow:    isActive
                  ? `0 0 40px ${color}99, 0 0 80px ${color}44`
                  : "none",
                transform:     isActive ? "scale(1.04)" : "scale(1)",
                transition:    "text-shadow 0.25s ease, transform 0.25s ease",
                display:       "block",
              }}>
                {text}
              </span>

              {/* waveform */}
              <WaveBar color={color} active={isActive} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
