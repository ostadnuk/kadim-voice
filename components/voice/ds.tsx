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

/** Shared premium easing — snappy start, smooth deceleration (from Utopia Tokyo) */
export const EASE = "cubic-bezier(0.625, 0.05, 0, 1)"

export const COLOR = {
  // Background
  bg:        "#14111a",   // matches welcome screen 3D canvas background

  // Accent — monochrome
  amber:     "#f0ece4",
  copper:    "#f0ece4",
  teal:      "#f0ece4",
  tealDeep:  "#f0ece4",

  // Text
  text:      "#f0ece4",   // warm near-white — matches welcome screen primary
  secondary: "#b8b4ae",   // supporting text
  dim:       "#5a5258",   // inactive / captions

  // Surfaces
  surface:   "#130f14",   // subtle card / overlay surface
  veryDim:   "#2e2a30",   // inactive borders

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

// ─── STEP CONTEXT ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6
interface StepCtx { step: number }
const StepContext = createContext<StepCtx>({ step: 0 })

export function StepProvider({ step, children }: { step: number; children: React.ReactNode }) {
  return <StepContext.Provider value={{ step }}>{children}</StepContext.Provider>
}

// ─── STEP BAR ─────────────────────────────────────────────────────────────────

export function DSStepBar({ color = ACCENT }: { color?: string }) {
  const { step } = useContext(StepContext)
  const filled = "█".repeat(step)
  const empty  = "░".repeat(TOTAL_STEPS - step)
  return (
    <div style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps, color, opacity: OPACITY.secondary }}>
      {String(TOTAL_STEPS).padStart(2, "0")} [{filled}{empty}] {String(step).padStart(2, "0")}
    </div>
  )
}

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

// ─── INTERIOR BACKGROUND (shared by all inner screens) ───────────────────────

const INTERIOR_GOLD = "rgba(240, 214, 140,"

export function InteriorBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    const dots = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
      speed: 0.04 + Math.random() * 0.10,
      base:  0.05 + Math.random() * 0.15,
    }))
    let raf: number
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const t = Date.now() / 1000
      dots.forEach(d => {
        const a = d.base + Math.sin(t * d.speed + d.phase) * 0.06
        ctx.beginPath()
        ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `${INTERIOR_GOLD} ${a})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "#14111a", zIndex: 0 }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", opacity: 0.045,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "180px 180px",
      }} />
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }} />
    </>
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
      <style>{`@keyframes ds-cursor-blink { 50% { opacity: 0; } }`}</style>
      {children}
    </div>
  )
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────

export function DSTopBar({ left, right, color }: { left?: React.ReactNode; right?: React.ReactNode; color?: string }) {
  return (
    <>
      {/* Step number — fixed top-left */}
      <div className="ds-safe-top" style={{ position: "fixed", top: 0, left: 0, zIndex: 100, paddingLeft: "1rem" }}>
        {left ?? <DSStepBar color={color} />}
      </div>
      {/* Right content — fixed top-right */}
      {right && (
        <div className="ds-safe-top" style={{ position: "fixed", top: 0, right: 0, zIndex: 100, paddingRight: "1rem" }}>
          {right}
        </div>
      )}
    </>
  )
}

// ─── BRACKET EDGE ────────────────────────────────────────────────────────────

export function BracketEdge({ color = ACCENT, position }: { color?: string; position: "top" | "bottom" }) {
  const isTop = position === "top"
  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {isTop
        ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderLeft:  `1px solid ${color}`, opacity: OPACITY.secondary }} />
        : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderLeft:  `1px solid ${color}`, opacity: OPACITY.secondary }} />
      }
      {isTop
        ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: OPACITY.secondary }} />
        : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: OPACITY.secondary }} />
      }
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
    }}>
      {children}
    </span>
  )
}

// ─── TYPELINE — rAF-driven, zero React re-renders per character ──────────────
// Use this instead of TypewriterText when the parent has any CTA that fades in
// on completion — TypewriterText re-renders the parent on every character which
// disrupts CSS transitions on sibling elements.

export function TypeLine({
  text, speed = 18, onDone, cursorOpacity = 0.6,
}: {
  text: string; speed?: number; onDone?: () => void; cursorOpacity?: number
}) {
  const spanRef   = useRef<HTMLSpanElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const el = spanRef.current as HTMLSpanElement | null
    if (!el) return
    if (!text) { onDoneRef.current?.(); return }
    const node = el
    let idx = 0, lastTime = -1, rafId: number, cancelled = false
    function tick(time: number) {
      if (cancelled) return
      if (lastTime < 0 || time - lastTime >= speed) {
        idx++
        node.textContent = text.slice(0, idx)
        lastTime = time
        if (idx >= text.length) {
          if (cursorRef.current) cursorRef.current.style.display = "none"
          onDoneRef.current?.()
          return
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => { cancelled = true; cancelAnimationFrame(rafId) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <span ref={spanRef} />
      <span ref={cursorRef} className="ds-cursor" style={{ opacity: cursorOpacity }}>▌</span>
    </>
  )
}

// ─── TYPEWRITER TEXT ─────────────────────────────────────────────────────────

/**
 * Renders text character-by-character as if the vessel is speaking.
 * Matches the animation style of screen-exhibition.
 */
export function TypewriterText({
  text,
  speed   = 28,
  onDone,
  style,
}: {
  text:    string
  speed?:  number
  onDone?: () => void
  style?:  React.CSSProperties
}) {
  const [displayed, setDisplayed] = useState("")
  const [done,      setDone]      = useState(false)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone })

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        setDone(true)
        onDoneRef.current?.()
      }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed]) // onDone via ref — excluded to prevent restart on re-render

  return (
    <span style={style}>
      {displayed}
      {!done && <span style={{ animation: "ds-cursor-blink 1s step-end infinite" }}>▌</span>}
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
  variant  = "solid",
}: {
  children:  string
  onClick?:  () => void
  disabled?: boolean
  color?:    string
  variant?:  "solid" | "outline"
}) {
  const isOutline = variant === "outline"
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width:          "100%",
        fontFamily:     FONT.base,
        fontSize:       TYPE.base,
        letterSpacing:  TRACK.caps,
        textTransform:  "uppercase",
        color:          disabled ? COLOR.secondary : isOutline ? COLOR.text : COLOR.bg,
        background:     disabled ? COLOR.veryDim   : isOutline ? "transparent" : color,
        border:         isOutline ? `1px solid ${disabled ? COLOR.veryDim : COLOR.text}` : "none",
        padding:        "0 24px",
        minHeight:      56,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        textAlign:      "center",
        fontWeight:     700,
        cursor:         disabled ? "not-allowed" : "pointer",
        transition:     `all 0.6s ${EASE}`,
        WebkitTapHighlightColor: "transparent",
        opacity:        disabled ? 0.55 : 1,
      }}
    >
      {children}
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

// ─── RA/DEC — orbital position (welcome screen, external view) ───────────────

export function RADecTicker({ color = ACCENT }: { color?: string }) {
  const [pos,  setPos]  = useState({ ra: "04h23m", dec: "+31°14'" })
  const [vel,  setVel]  = useState("7.614")

  useEffect(() => {
    const posId = setInterval(() => {
      const t = Date.now() / 1000
      const raH  = Math.floor(4  + Math.sin(t * 0.00031) * 0.8)
      const raM  = Math.floor(23 + Math.sin(t * 0.00071) * 12)
      const decD = Math.floor(31 + Math.sin(t * 0.00047) * 8)
      const decM = Math.floor(14 + Math.cos(t * 0.00059) * 10)
      setPos({
        ra:  `${String(raH).padStart(2,"0")}h${String(Math.abs(raM)).padStart(2,"0")}m`,
        dec: `+${String(decD).padStart(2,"0")}°${String(Math.abs(decM)).padStart(2,"0")}'`,
      })
    }, 1200)

    const velId = setInterval(() => {
      const t = Date.now() / 1000
      const v = 7.614 + Math.sin(t * 0.13) * 0.008 + (Math.random() - 0.5) * 0.004
      setVel(v.toFixed(3))
    }, 180)

    return () => { clearInterval(posId); clearInterval(velId) }
  }, [])

  return (
    <div style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color, opacity: OPACITY.tertiary, lineHeight: 1.8 }}>
      <div>RA  {pos.ra}</div>
      <div>DEC {pos.dec}</div>
      <div>VEL {vel} km/s</div>
    </div>
  )
}

// ─── ALT/SIG — altitude + signature count (exhibition screen) ────────────────

const TICKER_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+·,."

function useTickerScramble(text: string, trigger: number) {
  const [display, setDisplay] = useState(text)
  useEffect(() => {
    const duration = 480
    const start    = Date.now()
    const lockAt   = text.split("").map((_, i) =>
      (i / Math.max(text.length - 1, 1)) * duration * 0.65 + Math.random() * duration * 0.35
    )
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed >= duration) { setDisplay(text); clearInterval(id); return }
      setDisplay(text.split("").map((char, i) => {
        if (char === " " || char === "," || char === ".") return char
        if (elapsed >= lockAt[i]) return char
        return TICKER_CHARS[Math.floor(Math.random() * TICKER_CHARS.length)]
      }).join(""))
    }, 38)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
  return display
}

export function AltSigTicker({ color = ACCENT }: { color?: string }) {
  const [slotIdx, setSlotIdx] = useState(0)
  const [epoch,   setEpoch]   = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setEpoch(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setSlotIdx(i => (i + 1) % 3)
    }, 3200)
    return () => clearInterval(id)
  }, [])

  const label = ["T+", "SIG", "F̄"][slotIdx]
  const value = slotIdx === 0 ? epoch.toLocaleString()
              : slotIdx === 1 ? "2,847"
              :                 "432.0 Hz"
  const full  = `${label}  ${value}`
  const display = useTickerScramble(full, slotIdx)

  return (
    <div style={{
      fontFamily: FONT.mono, fontSize: TYPE.xs, letterSpacing: TRACK.sm,
      color, opacity: OPACITY.tertiary,
      textAlign: "right",
      direction: "ltr",
    }}>
      {display}
    </div>
  )
}

// ─── SIG/FREQ — signatures + voice frequency (record → result) ───────────────

export function SigFreqTicker({ color = ACCENT, freq, sigCount = 2847 }: { color?: string; freq?: number | null; sigCount?: number }) {
  const freqStr = freq != null ? `${freq.toFixed(1)} Hz` : "—"
  return (
    <div style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color, opacity: OPACITY.tertiary, lineHeight: 1.8 }}>
      <div>SIG {sigCount.toLocaleString()}</div>
      <div>F̄   {freqStr}</div>
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
          transition: `border-color 0.35s ${EASE}`,
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
          cursor: "pointer", transition: `border-color 0.35s ${EASE}`,
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
          transition: `border-color 0.35s ${EASE}`,
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
        transition: `color 0.35s ${EASE}`,
      }}>
        {children}
      </span>
    </label>
  )
}
