"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, COLOR, FONT, TYPE, TRACK, OPACITY, AltSigTicker, InteriorBg } from "./ds"

interface ScreenIntentProps {
  language:   Language
  onContinue: () => void
}

// ── Story frames ──────────────────────────────────────────────────────────────

type FrameType = "hud" | "voice" | "invite"
interface Frame { type: FrameType; text: string }

const STORY: Record<Language, { frames: Frame[]; cta: string }> = {
  en: {
    frames: [
      { type: "hud",    text: "VESSEL READY  ·  30 SECONDS" },
      { type: "voice",  text: "During the recording, I will ask you three questions." },
      { type: "voice",  text: "Speak naturally. There are no right answers." },
      { type: "invite", text: "Only your voice matters." },
    ],
    cta: "START RECORDING",
  },
  he: {
    frames: [
      { type: "hud",    text: "הכלי מוכן  ·  30 שניות" },
      { type: "voice",  text: "במהלך ההקלטה אשאל אתכם שלוש שאלות." },
      { type: "voice",  text: "דברו בטבעיות. אין תשובות נכונות." },
      { type: "invite", text: "רק הקול שלכם חשוב." },
    ],
    cta: "להקליט",
  },
  ar: {
    frames: [
      { type: "hud",    text: "الوعاء جاهز  ·  30 ثانية" },
      { type: "voice",  text: "خلال التسجيل سأطرح عليكم ثلاثة أسئلة." },
      { type: "voice",  text: "تحدّثوا بشكل طبيعي. لا توجد إجابات صحيحة." },
      { type: "invite", text: "صوتكم وحده هو ما يهم." },
    ],
    cta: "ابدأ التسجيل",
  },
}

const TYPE_SPEED: Record<FrameType, number> = {
  hud: 10, voice: 14, invite: 22,
}
const FRAME_PAUSE: Record<FrameType, number> = {
  hud: 500, voice: 700, invite: 700,
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const HUD_COLOR = "#7dd4a0"
const HUD_GLOW  = "0 0 8px rgba(125,212,160,0.7), 0 0 20px rgba(125,212,160,0.35)"

// ── Smooth typewriter — rAF-driven, no parent re-renders per character ─────────

function TypeLine({ text, speed, onDone, cursorOpacity = 0.6 }: {
  text: string; speed: number; onDone: () => void; cursorOpacity?: number
}) {
  const spanRef   = useRef<HTMLSpanElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const el = spanRef.current as HTMLSpanElement | null
    if (!el) return
    if (!text) { onDoneRef.current(); return }
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
          onDoneRef.current()
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

// ── Frame state ───────────────────────────────────────────────────────────────

interface VisibleFrame { frame: Frame; isTyping: boolean }

// ── Screen ────────────────────────────────────────────────────────────────────

export function ScreenIntent({ language, onContinue }: ScreenIntentProps) {
  const dir   = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const story = STORY[language]

  const [visibleFrames, setVisibleFrames] = useState<VisibleFrame[]>([])
  const [storyGone,     setStoryGone]     = useState(false)
  const [ctaVisible,    setCtaVisible]    = useState(false)

  const resolveRef = useRef<(() => void) | null>(null)
  const notifyDone = useCallback(() => {
    resolveRef.current?.()
    resolveRef.current = null
  }, [])
  function waitTyping() {
    return new Promise<void>(resolve => { resolveRef.current = resolve })
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      for (const frame of story.frames) {
        if (cancelled) return

        if (frame.type === "hud") {
          setVisibleFrames(prev => [...prev, { frame, isTyping: false }])
          await sleep(FRAME_PAUSE.hud)
        } else {
          setVisibleFrames(prev => [...prev, { frame, isTyping: true }])
          await waitTyping()
          if (cancelled) return
          setVisibleFrames(prev => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], isTyping: false }
            return next
          })
          await sleep(FRAME_PAUSE[frame.type])
        }
      }

      if (cancelled) return
      await sleep(300)
      setStoryGone(true)
      await sleep(400)
      if (!cancelled) setCtaVisible(true)
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hudFrames   = visibleFrames.filter(vf => vf.frame.type === "hud")
  const storyFrames = visibleFrames.filter(vf => vf.frame.type !== "hud")

  return (
    <DSShell dir={dir}>

      <InteriorBg />
      <DSTopBar right={<AltSigTicker />} />

      {/* HUD */}
      <div style={{
        position:      "absolute",
        top:           0, left: 0, right: 0,
        zIndex:        5,
        paddingTop:    "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        display:       "flex",
        flexDirection: "column",
        gap:           "0.4rem",
        pointerEvents: "none",
        opacity:       storyGone ? 0 : 1,
        transition:    "opacity 0.55s ease",
      }}>
        {hudFrames.map((vf, i) => (
          <div key={i} style={{
            fontFamily:    FONT.base,
            fontWeight:    300,
            fontSize:      TYPE.xs,
            letterSpacing: TRACK.caps,
            textTransform: "uppercase",
            color:         HUD_COLOR,
            textShadow:    HUD_GLOW,
            opacity:       0.95,
          }}>
            {vf.frame.text}
          </div>
        ))}
      </div>

      {/* Story zone — invite types last, stays put when rest fades */}
      <div style={{
        flex:          1,
        position:      "relative",
        zIndex:        5,
        display:       "flex",
        flexDirection: "column",
        justifyContent:"flex-end",
        overflow:      "hidden",
        paddingTop:    "clamp(8rem, 22vw, 12rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        paddingBottom: "clamp(5rem, 13vw, 7rem)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          {storyFrames.map((vf, i, arr) => {
            const isLast   = i === arr.length - 1
            const isInvite = vf.frame.type === "invite"

            const opacity = isInvite
              ? OPACITY.primary
              : storyGone
                ? 0
                : isLast ? OPACITY.primary : 0.28

            return (
              <p key={i} style={{
                fontFamily:    FONT.base,
                fontWeight:    400,
                fontSize:      TYPE.lg,
                lineHeight:    1.65,
                color:         isInvite ? "#b8c8d8" : COLOR.text,
                opacity,
                margin:        0,
                letterSpacing: language === "en" ? TRACK.en : TRACK.body,
                textAlign:     dir === "rtl" ? "right" : "left",
                transition:    storyGone && !isInvite
                                 ? "opacity 0.5s ease"
                                 : "opacity 1.2s ease",
              }}>
                {vf.isTyping
                  ? <TypeLine
                      text={vf.frame.text}
                      speed={TYPE_SPEED[vf.frame.type]}
                      onDone={notifyDone}
                      cursorOpacity={isInvite ? 0.7 : 0.6}
                    />
                  : vf.frame.text
                }
              </p>
            )
          })}
        </div>
      </div>

      {/* Button — fixed bottom, fades in after story fades */}
      <div
        className="ds-safe-bottom px-4"
        style={{
          position:      "fixed",
          bottom:        0, left: 0, right: 0,
          zIndex:        20,
          paddingTop:    12,
          opacity:       ctaVisible ? 1 : 0,
          transform:     ctaVisible ? "translateY(0)" : "translateY(10px)",
          transition:    "opacity 0.8s ease, transform 0.8s ease",
          pointerEvents: ctaVisible ? "auto" : "none",
        }}
      >
        <DSButton onClick={onContinue} color={COLOR.text}>{story.cta}</DSButton>
      </div>

    </DSShell>
  )
}
