"use client"

import { useState, useEffect, useRef } from "react"
import type { Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, SignalBar, COLOR, FONT, LANG_COLOR, TYPE, TRACK, OPACITY } from "./ds"

interface ScreenExhibitionProps {
  language:   Language
  onContinue: () => void
}

const LANG_FONT: Record<Language, string> = {
  en: "'narkiss-yair-variable', sans-serif",
  he: "'narkiss-yair-variable', sans-serif",
  ar: "'narkiss-yair-variable', sans-serif",
}

// ── Story frames ──────────────────────────────────────────────────────────────

type FrameType = "hud" | "voice" | "invite"
interface Frame { type: FrameType; text: string }

const STORY: Record<Language, { frames: Frame[]; cta: string }> = {
  en: {
    frames: [
      { type: "voice",  text: "I am Kadim. I collect voice signatures across time." },
      { type: "hud",    text: "INITIALIZED  ·  COLLECTING NOW" },
      { type: "voice",  text: "Not recordings — signatures. The acoustic imprint unique to each human I encounter. Irreducible. Yours alone." },
      { type: "hud",    text: "SIGNATURES INSIDE: 2,847  ·  SIGNAL: LIVE" },
      { type: "voice",  text: "I was here before this exhibition. I will leave long after it. Everything inside me travels forward." },
      { type: "voice",  text: "Thirty seconds of your voice. Permanently inside me." },
      { type: "invite", text: "Add yours." },
    ],
    cta: "ADD MY VOICE",
  },
  he: {
    frames: [
      { type: "voice",  text: "אני קדים, הכד שניצב מולך." },
      { type: "voice",  text: "אני ארכיון קולות הנוסע בזמן, קפסולה שנושאת בתוכה רגעים קוליים עבור אלו שיבואו אחריכם." },
      { type: "hud",    text: "מאותחל  ·  אוסף עכשיו" },
      { type: "voice",  text: "אני אוסף את טביעת הקול הספציפית והחד-פעמית של מי שפוגש בי." },
      { type: "hud",    text: "חתימות בפנים: 2,847  ·  אות: פעיל" },
      { type: "voice",  text: "כל קול שנכנס אלי הופך לחלק מקבוצה גדולה של הדים, שנשמרים בתוכי כעדות לנוכחות אנושית שנוסעת אל העתיד." },
    ],
    cta: "הוספת הקול שלי",
  },
  ar: {
    frames: [
      { type: "voice",  text: "أنا قديم. أجمع توقيعات الصوت عبر الزمن." },
      { type: "hud",    text: "مُهيَّأ  ·  يجمع الآن" },
      { type: "voice",  text: "ليست تسجيلات — توقيعات. البصمة الصوتية الفريدة لكل إنسان يلتقيني. لا تُختزل. لك وحدك." },
      { type: "hud",    text: "التوقيعات بالداخل: 2٬847  ·  الإشارة: حيّة" },
      { type: "voice",  text: "كنت هنا قبل هذا المعرض. سأرحل بعده بكثير. كل ما بداخلي يسافر للأمام." },
      { type: "voice",  text: "ثلاثون ثانية من صوتك. بداخلي إلى الأبد." },
      { type: "invite", text: "أضف توقيعك." },
    ],
    cta: "أضف صوتي",
  },
}

const FRAME_DELAY: Record<FrameType, number> = {
  hud:    900,
  voice:  2200,
  invite: 2400,
}

// ── Star field ────────────────────────────────────────────────────────────────

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.1 + 0.15,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.9,
    }))
    let raf: number
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const t = Date.now() / 1000
      stars.forEach(s => {
        const a = 0.1 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />
}

// ── Scrolling waveform ────────────────────────────────────────────────────────

function WaveformBg({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = 80 }
    resize()
    window.addEventListener("resize", resize)
    const freqs = [0.012, 0.023, 0.038, 0.007, 0.051]
    const amps  = [0.28, 0.18, 0.12, 0.22, 0.08]
    let offset = 0, raf: number
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.beginPath()
      for (let x = 0; x <= W; x++) {
        let y = H / 2
        freqs.forEach((f, i) => { y += Math.sin((x + offset) * f * Math.PI * 2) * H * amps[i] })
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `${color}22`
      ctx.lineWidth = 1.2
      ctx.stroke()
      offset += 0.6
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [color])
  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", bottom: 72, left: 0,
      width: "100%", height: 80,
      pointerEvents: "none", zIndex: 3,
    }} />
  )
}

// ── Voiceprint mark ───────────────────────────────────────────────────────────

function VoiceprintMark({ color, visible }: { color: string; visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heightsRef = useRef<number[]>([])

  useEffect(() => {
    // Generate unique fingerprint once per visit
    const BARS = 72
    heightsRef.current = Array.from({ length: BARS }, (_, i) =>
      0.15 + Math.abs(Math.sin(i * 2.3999 + Math.random() * 1.2)) * 0.85
    )
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const SIZE = 180
    canvas.width = SIZE; canvas.height = SIZE
    const cx = SIZE / 2, cy = SIZE / 2
    const BARS = 72, MIN_R = 34, MAX_R = 82
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE)
      const t = Date.now() / 1000
      heightsRef.current.forEach((h, i) => {
        const angle  = (i / BARS) * Math.PI * 2 - Math.PI / 2
        const pulse  = 1 + Math.sin(t * 1.1 + i * 0.28) * 0.05
        const outerR = MIN_R + (MAX_R - MIN_R) * h * pulse
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * MIN_R, cy + Math.sin(angle) * MIN_R)
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
        const alpha = Math.round((0.25 + h * 0.55) * 255).toString(16).padStart(2, "0")
        ctx.strokeStyle = `${color}${alpha}`
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
      // Center dot
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fillStyle = `${color}99`
      ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [color])

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      opacity: visible ? 1 : 0,
      transition: "opacity 1.2s ease",
      padding: "0.5rem 0",
    }}>
      <canvas ref={canvasRef} style={{ width: 180, height: 180 }} />
      <span style={{
        fontFamily: FONT.base, fontSize: TYPE.xs,
        letterSpacing: TRACK.caps, textTransform: "uppercase",
        color, opacity: OPACITY.tertiary,
      }}>
        YOUR SIGNATURE · PENDING
      </span>
    </div>
  )
}

// ── Epoch counter ─────────────────────────────────────────────────────────────

function EpochCounter({ color }: { color: string }) {
  const [ts, setTs] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setTs(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.sm, color, opacity: OPACITY.tertiary }}>
      T+{ts}
    </span>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ScreenExhibition({ language, onContinue }: ScreenExhibitionProps) {
  const color  = LANG_COLOR[language]
  const font   = LANG_FONT[language]
  const dir    = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const story  = STORY[language]

  const [revealed, setRevealed] = useState(0)
  const [done,     setDone]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const inviteVisible = revealed >= story.frames.length

  useEffect(() => {
    let cumulative = 400
    const timers: ReturnType<typeof setTimeout>[] = []
    story.frames.forEach((frame, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), cumulative))
      cumulative += FRAME_DELAY[frame.type]
    })
    timers.push(setTimeout(() => setDone(true), cumulative))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [revealed])

  const skipAll = () => { setRevealed(story.frames.length); setDone(true) }

  return (
    <DSShell dir={dir}>
      <StarField />
      <WaveformBg color={color} />

      {/* Inner vessel glow */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: `radial-gradient(ellipse 80% 60% at 50% 35%, ${color}0b 0%, transparent 70%)` }} />
      {/* Edge vignette */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: `radial-gradient(ellipse at 50% 50%, transparent 15%, ${COLOR.bg}d4 100%)` }} />

      {/* Top bar */}
      <div style={{ position: "relative", zIndex: 10 }}>
        <DSTopBar
          left={<SignalBar color={color} />}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <EpochCounter color={color} />
              {!done
                ? <button onClick={skipAll} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.wide, color, opacity: OPACITY.tertiary, WebkitTapHighlightColor: "transparent", padding: "4px 0" }}>SKIP ›</button>
                : <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color, opacity: OPACITY.primary }}>VESSEL · INTERIOR</span>
              }
            </div>
          }
        />
      </div>

      {/* Story */}
      <div className="relative flex flex-1 flex-col overflow-y-auto px-5" style={{ zIndex: 6, paddingTop: "clamp(1.5rem, 6vw, 2.5rem)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1rem, 4vw, 1.5rem)" }}>

          {story.frames.map((frame, i) => {
            const visible = i < revealed
            return (
              <div key={i} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)", transition: "opacity 0.7s ease, transform 0.7s ease" }}>
                {frame.type === "hud" && (
                  <div style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.wide, textTransform: "uppercase", color, opacity: OPACITY.tertiary, padding: "2px 0" }}>
                    {frame.text}
                  </div>
                )}
                {frame.type === "voice" && (
                  <p style={{ fontFamily: font, fontWeight: 400, fontSize: "clamp(15px, 4.2vw, 18px)", lineHeight: 1.75, color: COLOR.text, opacity: 0.82, margin: 0, letterSpacing: language === "en" ? "0.01em" : "0", textAlign: dir === "rtl" ? "right" : "left" }}>
                    {frame.text}
                  </p>
                )}
                {frame.type === "invite" && (
                  <p style={{ fontFamily: font, fontWeight: language === "en" ? 700 : 600, fontSize: "clamp(1.3rem, 6.5vw, 1.8rem)", lineHeight: 1.3, color, opacity: 0.95, margin: 0, textShadow: `0 0 28px ${color}66`, textAlign: dir === "rtl" ? "right" : "left", paddingTop: "0.5rem" }}>
                    {frame.text}
                  </p>
                )}
              </div>
            )
          })}

          <div ref={bottomRef} style={{ height: 8 }} />
        </div>
      </div>

      {/* CTA */}
      <div className="ds-safe-bottom relative px-4" style={{ zIndex: 6, paddingTop: 12, opacity: done ? 1 : 0, transition: "opacity 0.9s ease" }}>
        <DSButton onClick={onContinue} color={color}>{story.cta}</DSButton>
      </div>
    </DSShell>
  )
}
