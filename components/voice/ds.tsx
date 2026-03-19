"use client"

/**
 * Kadim Design System v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every token, component, and pattern.
 * Mobile-first. WCAG AA best-effort on artistic dark palette.
 * Every screen imports from here — no local overrides.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { Language } from "@/lib/i18n"

// ─── COLOR ────────────────────────────────────────────────────────────────────

export const COLOR = {
  // Background
  bg:        "#0d0b0e",   // near-black

  // Brand accents (for large text, buttons, decorative)
  amber:     "#C36981",   // EN — dusty rose
  copper:    "#A53D1E",   // HE — rust / terracotta
  teal:      "#5a8f78",   // AR — brightened teal (was #324238, now ~3:1 on dark bg)
  tealDeep:  "#324238",   // original teal for gradient blobs only

  // Text
  text:      "#f0ece4",   // primary body — warm near-white, high contrast
  secondary: "#c8bad0",   // supporting text — lifted from #a89aaa
  dim:       "#8a7890",   // inactive / captions — lifted from #6a5a70

  // Surfaces
  surface:   "#181420",   // subtle card / overlay surface
  veryDim:   "#3d3248",   // inactive borders — lifted from #2a2030

  // Feedback
  error:     "#d05555",
} as const

// ─── LANGUAGE ACCENT MAP ─────────────────────────────────────────────────────

export const LANG_COLOR: Record<Language, string> = {
  en: COLOR.amber,
  he: COLOR.copper,
  ar: COLOR.teal,
}

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────

export const FONT = {
  base: "'narkiss-yair-variable', sans-serif",
  // convenience aliases — all same font, kept for semantic clarity
  mono:    "'narkiss-yair-variable', sans-serif",
  display: "'narkiss-yair-variable', sans-serif",
  he:      "'narkiss-yair-variable', sans-serif",
  ar:      "'narkiss-yair-variable', sans-serif",
} as const

/**
 * TYPE — mobile-first clamp scale.
 * Minimum values are the floor on a 320px phone.
 */
export const TYPE = {
  hud:  "clamp(12px, 3vw,  13px)",    // tiny status / coords (minimum usage only)
  xs:   "clamp(13px, 3.5vw, 15px)",   // secondary labels, captions
  sm:   "clamp(15px, 4vw,  16px)",    // buttons, tags, HUD labels
  base: "clamp(17px, 4.5vw, 20px)",   // body text
  lg:   "clamp(20px, 5.5vw, 24px)",   // lead text / emphasis
  xl:   "clamp(1.5rem, 7vw, 2.2rem)", // section headings
  disp: "clamp(3.5rem, 20vw, 8rem)",  // hero / title display
} as const

/**
 * TRACKING — letter-spacing scale.
 * Keep low for Hebrew/Arabic; higher only for all-caps Latin HUD text.
 */
export const TRACK = {
  body:  "0",           // Hebrew & Arabic body text
  en:    "0.01em",      // English body
  sm:    "0.08em",      // small labels
  caps:  "0.15em",      // all-caps HUD / button text
  wide:  "0.22em",      // wide spaced labels (Latin only)
} as const

// ─── OPACITY ─────────────────────────────────────────────────────────────────

export const OPACITY = {
  full:       1,
  primary:    0.92,   // important body text
  secondary:  0.72,   // supporting text
  tertiary:   0.55,   // captions, timestamps
  decorative: 0.35,   // dividers, inactive borders
  ghost:      0.18,   // very subtle backgrounds
} as const

// ─── SPACING / TOUCH ─────────────────────────────────────────────────────────

/** ADA minimum touch target size in px */
export const TOUCH_MIN = 44

// ─── PRIMARY ACCENT (inner screens — no language cycling) ────────────────────

export const ACCENT = COLOR.amber

// ─── LANGUAGE CONTEXT ─────────────────────────────────────────────────────────

interface LangCtx { lang: Language; setLang: (l: Language) => void }
const LanguageCtx = createContext<LangCtx | null>(null)

export function LanguageProvider({ lang, setLang, children }: LangCtx & { children: React.ReactNode }) {
  return <LanguageCtx.Provider value={{ lang, setLang }}>{children}</LanguageCtx.Provider>
}

function useLang() { return useContext(LanguageCtx) }

// ─── LANG SWITCHER ────────────────────────────────────────────────────────────

function LangSwitcher() {
  const ctx = useLang()
  if (!ctx) return null
  const { lang, setLang } = ctx
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, zIndex: 50,
      paddingTop: "max(0.75rem, calc(env(safe-area-inset-top) + 0.25rem))",
      paddingRight: 12,
      display: "flex", gap: 4,
    }}>
      {(["en", "he", "ar"] as Language[]).map((l) => {
        const active = l === lang
        const color  = LANG_COLOR[l]
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-label={`Switch language to ${l.toUpperCase()}`}
            aria-pressed={active}
            style={{
              background:   active ? color : "transparent",
              border:       `1px solid ${active ? color : COLOR.veryDim}`,
              color:        active ? COLOR.bg : COLOR.dim,
              fontFamily:   FONT.base,
              fontSize:     TYPE.xs,
              letterSpacing: TRACK.caps,
              padding:      "0 10px",
              minHeight:    TOUCH_MIN,
              minWidth:     TOUCH_MIN,
              cursor:       "pointer",
              transition:   "all .25s",
              WebkitTapHighlightColor: "transparent",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
            }}
          >
            {l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

// ─── GRADIENT BLOB BACKGROUND ────────────────────────────────────────────────

function GradientBg() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* teal — top left */}
      <div style={{
        position: "absolute", width: "65%", height: "65%", top: "-15%", left: "-10%",
        background: "radial-gradient(ellipse, rgba(50,66,56,0.85) 0%, transparent 70%)",
        filter: "blur(48px)",
      }} />
      {/* rose — right center */}
      <div style={{
        position: "absolute", width: "55%", height: "55%", top: "25%", right: "-15%",
        background: "radial-gradient(ellipse, rgba(195,105,129,0.55) 0%, transparent 70%)",
        filter: "blur(52px)",
      }} />
      {/* rust — bottom left */}
      <div style={{
        position: "absolute", width: "55%", height: "50%", bottom: "-5%", left: "-5%",
        background: "radial-gradient(ellipse, rgba(165,61,30,0.7) 0%, transparent 70%)",
        filter: "blur(46px)",
      }} />
      {/* rose blend — center bottom */}
      <div style={{
        position: "absolute", width: "45%", height: "35%", bottom: "10%", left: "30%",
        background: "radial-gradient(ellipse, rgba(195,105,129,0.2) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />
    </div>
  )
}

// ─── SCREEN SHELL ─────────────────────────────────────────────────────────────

/**
 * Base layout for every screen.
 * Provides: dark bg, gradient blobs, grain, scanlines, safe-area padding, flex column.
 */
export function DSShell({
  children,
  className = "",
  dir,
}: {
  children: React.ReactNode
  className?: string
  dir?: "ltr" | "rtl"
}) {
  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col overflow-hidden ${className}`}
      style={{ background: COLOR.bg, color: COLOR.text, fontFamily: FONT.base }}
      dir={dir}
    >
      <GradientBg />
      <div className="ds-grain" />
      <div className="ds-scanlines" />
      <LangSwitcher />
      {children}
    </div>
  )
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────

export function DSTopBar({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="ds-safe-top relative z-10 flex items-start justify-between px-4">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

// ─── BRACKET EDGE ────────────────────────────────────────────────────────────

export function BracketEdge({ color = ACCENT, position }: { color?: string; position: "top" | "bottom" }) {
  const isTop = position === "top"
  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flexShrink: 0 }}>
        {isTop
          ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderLeft:  `1px solid ${color}`, opacity: OPACITY.secondary }} />
          : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderLeft:  `1px solid ${color}`, opacity: OPACITY.secondary }} />
        }
      </div>
      <div style={{ flex: 1, height: 1, background: color, opacity: OPACITY.ghost }} />
      <div style={{ flexShrink: 0 }}>
        {isTop
          ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: OPACITY.secondary }} />
          : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: OPACITY.secondary }} />
        }
      </div>
    </div>
  )
}

// ─── CONTENT BLOCK ───────────────────────────────────────────────────────────

export function DSBlock({ children, color = ACCENT, className = "" }: {
  children: React.ReactNode; color?: string; className?: string
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 ${className}`}>
      <BracketEdge color={color} position="top" />
      <div className="w-full py-4">{children}</div>
      <BracketEdge color={color} position="bottom" />
    </div>
  )
}

// ─── LABEL ───────────────────────────────────────────────────────────────────

/**
 * Small uppercase tracking label.
 * Use for section labels, HUD captions, "WELCOME TO" style markers.
 */
export function DSLabel({
  children,
  color    = ACCENT,
  opacity  = OPACITY.secondary,
  size     = TYPE.xs,
  spacing  = TRACK.caps,
}: {
  children: React.ReactNode
  color?:   string
  opacity?: number
  size?:    string
  spacing?: string
}) {
  return (
    <span style={{
      fontFamily:    FONT.base,
      fontWeight:    400,
      fontSize:      size,
      letterSpacing: spacing,
      textTransform: "uppercase",
      color,
      opacity,
      display:       "block",
      textShadow:    `0 0 10px ${color}88`,
    }}>
      {children}
    </span>
  )
}

// ─── PRIMARY CTA BUTTON ──────────────────────────────────────────────────────

/**
 * Full-width primary CTA button.
 * 56px min-height for accessible tap target.
 */
export function DSButton({
  children,
  onClick,
  disabled = false,
  color    = ACCENT,
}: {
  children:  string
  onClick?:  () => void
  disabled?: boolean
  color?:    string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width:          "100%",
        fontFamily:     FONT.base,
        fontSize:       TYPE.sm,
        letterSpacing:  TRACK.caps,
        textTransform:  "uppercase",
        color:          disabled ? COLOR.secondary : COLOR.bg,
        background:     disabled ? COLOR.veryDim   : color,
        border:         "none",
        padding:        "0 24px",
        minHeight:      56,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            8,
        fontWeight:     700,
        cursor:         disabled ? "not-allowed" : "pointer",
        transition:     "background 0.2s ease, opacity 0.2s ease",
        WebkitTapHighlightColor: "transparent",
        opacity:        disabled ? 0.55 : 1,
      }}
    >
      <span>[ {children} ]</span>
      {!disabled && <span className="ds-cursor" style={{ color: `${COLOR.bg}99` }}>▋</span>}
    </button>
  )
}

// ─── BACK / SECONDARY LINK ───────────────────────────────────────────────────

export function DSBack({ children = "← back", onClick }: { children?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:     "none",
        border:         "none",
        fontFamily:     FONT.base,
        fontSize:       TYPE.xs,
        letterSpacing:  TRACK.caps,
        color:          ACCENT,
        opacity:        OPACITY.secondary,
        cursor:         "pointer",
        minHeight:      TOUCH_MIN,
        padding:        "0 4px",
        display:        "flex",
        alignItems:     "center",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      [ {children} ]
    </button>
  )
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────────

export function DSDivider({ color = ACCENT, opacity = OPACITY.ghost }: { color?: string; opacity?: number }) {
  return <div style={{ width: "100%", height: 1, background: color, opacity }} />
}

// ─── SIGNAL BAR ──────────────────────────────────────────────────────────────

export function SignalBar({ color = ACCENT }: { color?: string }) {
  const [sig, setSig] = useState(7)
  useEffect(() => {
    const id = setInterval(() => setSig(Math.round(4 + Math.sin(Date.now() / 1000 * 0.08) * 3)), 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps, color, opacity: OPACITY.secondary }}>
      SIG [{("█".repeat(sig) + "░".repeat(10 - sig))}]
    </div>
  )
}

// ─── COORDS TICKER ───────────────────────────────────────────────────────────

export function CoordsTicker({ color = ACCENT }: { color?: string }) {
  const [vals, setVals] = useState({ a: "0000.000", b: "0000.000" })
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now() / 1000
      setVals({
        a: (Math.abs(Math.sin(t * 0.031) * 9999.999)).toFixed(3).padStart(8, "0"),
        b: (Math.abs(Math.cos(t * 0.047) * 9999.999)).toFixed(3).padStart(8, "0"),
      })
    }, 120)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.sm, color, opacity: OPACITY.tertiary, lineHeight: 1.8 }}>
      <div>TX {vals.a}</div>
      <div>RX {vals.b}</div>
    </div>
  )
}

// ─── STATUS LINE ─────────────────────────────────────────────────────────────

export function DSStatusLine({ label, value, color = ACCENT }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color, opacity: OPACITY.tertiary, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT.base, fontSize: TYPE.sm, letterSpacing: TRACK.en, color, opacity: OPACITY.primary }}>
        {value}
      </span>
    </div>
  )
}

// ─── INPUT ───────────────────────────────────────────────────────────────────

export function DSInput({ id, label, value, onChange, placeholder, type = "text" }: {
  id: string; label: string; value: string
  onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor={id} style={{
        fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps,
        color: ACCENT, opacity: OPACITY.secondary, textTransform: "uppercase",
      }}>
        {label}
      </label>
      <input
        id={id} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 48,
          background: "transparent", border: "none",
          borderBottom: `1px solid ${focused ? ACCENT : COLOR.veryDim}`,
          color: COLOR.text, fontFamily: FONT.base,
          fontSize: TYPE.base, letterSpacing: TRACK.en,
          padding: "0 2px", outline: "none",
          transition: "border-color 0.2s ease",
        }}
      />
    </div>
  )
}

// ─── SELECT ──────────────────────────────────────────────────────────────────

export function DSSelect({ id, label, value, onChange, options }: {
  id: string; label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor={id} style={{
        fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps,
        color: ACCENT, opacity: OPACITY.secondary, textTransform: "uppercase",
      }}>
        {label}
      </label>
      <select
        id={id} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 48,
          background: "transparent", border: "none",
          borderBottom: `1px solid ${focused ? ACCENT : COLOR.veryDim}`,
          color: value ? COLOR.text : COLOR.secondary,
          fontFamily: FONT.base, fontSize: TYPE.base, letterSpacing: TRACK.en,
          padding: "0 2px", outline: "none",
          appearance: "none", WebkitAppearance: "none",
          cursor: "pointer", transition: "border-color 0.2s ease",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: COLOR.bg, color: COLOR.text }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── CHECKBOX ────────────────────────────────────────────────────────────────

export function DSCheckbox({ checked, onChange, children }: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode
}) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer", padding: "6px 0" }}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-checked={checked}
        role="checkbox"
        style={{
          width: 20, height: 20, flexShrink: 0,
          border: `1px solid ${checked ? ACCENT : COLOR.veryDim}`,
          background: "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", marginTop: 1, padding: 0,
          transition: "border-color 0.2s ease",
        }}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5 5 4 7.5 8.5 2" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="square" />
          </svg>
        )}
      </button>
      <span style={{
        fontFamily: FONT.base, fontSize: TYPE.sm, lineHeight: 1.7,
        color: checked ? COLOR.text : COLOR.secondary,
        letterSpacing: TRACK.en,
        transition: "color 0.2s ease",
      }}>
        {children}
      </span>
    </label>
  )
}
