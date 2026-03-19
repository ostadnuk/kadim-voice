"use client"

/**
 * Kadim Design System
 * All visual tokens, components, and patterns derived from screen-welcome.tsx.
 * Every screen in the app must use these — no overrides, no exceptions.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { Language } from "@/lib/i18n"

// ── Language context ───────────────────────────────────────────────────────────

const LANG_COLORS: Record<Language, string> = { en: "#C36981", he: "#A53D1E", ar: "#324238" }

interface LangCtx { lang: Language; setLang: (l: Language) => void }
const LanguageCtx = createContext<LangCtx | null>(null)

export function LanguageProvider({ lang, setLang, children }: LangCtx & { children: React.ReactNode }) {
  return <LanguageCtx.Provider value={{ lang, setLang }}>{children}</LanguageCtx.Provider>
}

function useLang() { return useContext(LanguageCtx) }

/** Fixed HUD language switcher — always visible on inner screens */
function LangSwitcher() {
  const ctx = useLang()
  if (!ctx) return null
  const { lang, setLang } = ctx
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, zIndex: 50,
      paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.25rem))",
      paddingRight: 16,
      display: "flex", gap: 4,
    }}>
      {(["en", "he", "ar"] as Language[]).map((l) => {
        const active = l === lang
        const color  = LANG_COLORS[l]
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              background: active ? color : "transparent",
              border: `1px solid ${active ? color : "#2a2010"}`,
              color: active ? "#070604" : "#4a3c28",
              fontFamily: "'narkiss-yair-variable', sans-serif",
              fontSize: 10,
              letterSpacing: "0.15em",
              padding: "3px 7px",
              cursor: "pointer",
              transition: "all .25s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

// ── Tokens ────────────────────────────────────────────────────────────────────

export const COLOR = {
  bg:       "#0d0b0e",
  amber:    "#C36981",  // EN / primary accent — dusty rose
  copper:   "#A53D1E",  // HE accent — rust / terracotta
  teal:     "#324238",  // AR accent — dark teal
  dim:      "#6a5a70",  // inactive text
  veryDim:  "#2a2030",  // inactive borders / lines
  text:     "#f0ece4",  // body text — near white warm
  secondary:"#a89aaa",  // secondary text — lifted for legibility
} as const

export const FONT = {
  mono:    "'narkiss-yair-variable', sans-serif",
  display: "'narkiss-yair-variable', sans-serif",
  he:      "'narkiss-yair-variable', sans-serif",
  ar:      "'narkiss-yair-variable', sans-serif",
} as const

// Primary accent for all inner screens (no language cycling)
export const ACCENT = COLOR.amber

// ── Gradient blob background ──────────────────────────────────────────────────

function GradientBg() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* #324238 teal — top left */}
      <div style={{
        position: "absolute",
        width: "65%", height: "65%",
        top: "-15%", left: "-10%",
        background: "radial-gradient(ellipse, rgba(50,66,56,0.85) 0%, transparent 70%)",
        filter: "blur(48px)",
      }} />
      {/* #C36981 rose — right center */}
      <div style={{
        position: "absolute",
        width: "55%", height: "55%",
        top: "25%", right: "-15%",
        background: "radial-gradient(ellipse, rgba(195,105,129,0.55) 0%, transparent 70%)",
        filter: "blur(52px)",
      }} />
      {/* #A53D1E rust — bottom left */}
      <div style={{
        position: "absolute",
        width: "55%", height: "50%",
        bottom: "-5%", left: "-5%",
        background: "radial-gradient(ellipse, rgba(165,61,30,0.7) 0%, transparent 70%)",
        filter: "blur(46px)",
      }} />
      {/* rose blend — center bottom, ties blobs together */}
      <div style={{
        position: "absolute",
        width: "45%", height: "35%",
        bottom: "10%", left: "30%",
        background: "radial-gradient(ellipse, rgba(195,105,129,0.2) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />
    </div>
  )
}

// ── Screen shell ──────────────────────────────────────────────────────────────

/**
 * Base layout for every screen.
 * Provides: dark bg, gradient blobs, grain, scanlines, safe-area padding, flex column full-height.
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
      style={{ background: COLOR.bg, color: COLOR.text, fontFamily: FONT.mono }}
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

// ── Top bar ───────────────────────────────────────────────────────────────────

/**
 * Top info row — matches the welcome screen's top-left/top-right HUD row.
 * Pass `left` and/or `right` slots.
 */
export function DSTopBar({
  left,
  right,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div
      className="ds-safe-top relative z-10 flex items-start justify-between px-4"
    >
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

// ── Bracket edge ──────────────────────────────────────────────────────────────

/**
 * Horizontal line with corner brackets — the signature decoration from welcome.
 * Use above and below content blocks.
 */
export function BracketEdge({
  color = ACCENT,
  position,
}: {
  color?: string
  position: "top" | "bottom"
}) {
  const isTop = position === "top"
  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flexShrink: 0 }}>
        {isTop
          ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderLeft:  `1px solid ${color}`, opacity: 0.6 }} />
          : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderLeft:  `1px solid ${color}`, opacity: 0.6 }} />
        }
      </div>
      <div style={{ flex: 1, height: 1, background: color, opacity: 0.12 }} />
      <div style={{ flexShrink: 0 }}>
        {isTop
          ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: 0.6 }} />
          : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: 0.6 }} />
        }
      </div>
    </div>
  )
}

// ── Content block ─────────────────────────────────────────────────────────────

/**
 * Bracketed content area — BracketEdge top + children + BracketEdge bottom.
 * Matches the hero title block layout from welcome.
 */
export function DSBlock({
  children,
  color = ACCENT,
  className = "",
}: {
  children: React.ReactNode
  color?: string
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 ${className}`}>
      <BracketEdge color={color} position="top" />
      <div className="w-full py-4">{children}</div>
      <BracketEdge color={color} position="bottom" />
    </div>
  )
}

// ── Label ─────────────────────────────────────────────────────────────────────

/**
 * Small uppercase tracking label — matches `— WELCOME TO —` and subtitles.
 */
export function DSLabel({
  children,
  color = ACCENT,
  opacity = 0.65,
  size = "clamp(10px, 2.8vw, 13px)",
  spacing = "0.3em",
}: {
  children: React.ReactNode
  color?: string
  opacity?: number
  size?: string
  spacing?: string
}) {
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontWeight: 400,
        fontSize: size,
        letterSpacing: spacing,
        textTransform: "uppercase",
        color,
        opacity,
        display: "block",
        textShadow: `0 0 10px ${color}99`,
      }}
    >
      {children}
    </span>
  )
}

// ── Primary CTA button ────────────────────────────────────────────────────────

/**
 * Full-width amber CTA — exact pattern from welcome's [ ENTER ARCHIVE ] button.
 */
export function DSButton({
  children,
  onClick,
  disabled = false,
  color = ACCENT,
}: {
  children: string
  onClick?: () => void
  disabled?: boolean
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        fontFamily: FONT.mono,
        fontSize: "clamp(11px, 3vw, 13px)",
        letterSpacing: "0.4em",
        textTransform: "uppercase",
        color: disabled ? COLOR.secondary : COLOR.bg,
        background: disabled ? COLOR.veryDim : color,
        border: "none",
        padding: "14px 0",
        minHeight: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.2s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span>[ {children} ]</span>
      {!disabled && <span className="ds-cursor" style={{ color: `${COLOR.bg}88` }}>▋</span>}
    </button>
  )
}

// ── Back / secondary link ─────────────────────────────────────────────────────

/**
 * Dim text link for back navigation and secondary actions.
 */
export function DSBack({
  children = "← back",
  onClick,
}: {
  children?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: "0.18em",
        color: ACCENT,
        opacity: 0.5,
        cursor: "pointer",
        padding: "8px 0",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      [ {children} ]
    </button>
  )
}

// ── Thin divider line ─────────────────────────────────────────────────────────

export function DSDivider({ color = ACCENT, opacity = 0.12 }: { color?: string; opacity?: number }) {
  return (
    <div style={{ width: "100%", height: 1, background: color, opacity }} />
  )
}

// ── Signal bar ────────────────────────────────────────────────────────────────

export function SignalBar({ color = ACCENT }: { color?: string }) {
  const [sig, setSig] = useState(7)
  useEffect(() => {
    const id = setInterval(() => {
      setSig(Math.round(4 + Math.sin(Date.now() / 1000 * 0.08) * 3))
    }, 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color, opacity: 0.7 }}>
      SIG [{("█".repeat(sig) + "░".repeat(10 - sig))}]
    </div>
  )
}

// ── Live coords ticker ────────────────────────────────────────────────────────

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
    <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.12em", color, opacity: 0.55, lineHeight: 1.7 }}>
      <div>TX {vals.a}</div>
      <div>RX {vals.b}</div>
    </div>
  )
}

// ── Animated counter / status ticker ─────────────────────────────────────────

export function DSStatusLine({ label, value, color = ACCENT }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.2em", color, opacity: 0.5, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.08em", color, opacity: 0.8 }}>
        {value}
      </span>
    </div>
  )
}

// ── Input field ───────────────────────────────────────────────────────────────

/**
 * Flat dark input — no border-radius, amber bottom border on focus.
 */
export function DSInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.25em", color: ACCENT, opacity: 0.65, textTransform: "uppercase" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: 44,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${focused ? ACCENT : COLOR.veryDim}`,
          color: COLOR.text,
          fontFamily: FONT.mono,
          fontSize: 13,
          letterSpacing: "0.05em",
          padding: "0 2px",
          outline: "none",
          transition: "border-color 0.2s ease",
        }}
      />
    </div>
  )
}

// ── Select field ──────────────────────────────────────────────────────────────

export function DSSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.25em", color: ACCENT, opacity: 0.65, textTransform: "uppercase" }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: 44,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${focused ? ACCENT : COLOR.veryDim}`,
          color: value ? COLOR.text : COLOR.secondary,
          fontFamily: FONT.mono,
          fontSize: 13,
          letterSpacing: "0.05em",
          padding: "0 2px",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          cursor: "pointer",
          transition: "border-color 0.2s ease",
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

// ── Checkbox row ──────────────────────────────────────────────────────────────

export function DSCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          border: `1px solid ${checked ? ACCENT : COLOR.veryDim}`,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginTop: 2,
          padding: 0,
          transition: "border-color 0.2s ease",
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5 5 4 7.5 8.5 2" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="square" />
          </svg>
        )}
      </button>
      <span style={{ fontFamily: FONT.mono, fontSize: 12, lineHeight: 1.7, color: checked ? COLOR.text : COLOR.secondary, letterSpacing: "0.04em", transition: "color 0.2s ease" }}>
        {children}
      </span>
    </label>
  )
}
