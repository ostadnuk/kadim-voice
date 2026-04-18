"use client"

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react"
import type { RecordingState } from "@/lib/types"
import type { Language } from "@/lib/i18n"
import { DSShell, DSTopBar, AltSigTicker, InteriorBg, COLOR, FONT, TYPE, TRACK, OPACITY, DSButton, DSBack } from "./ds"
import { VoiceSphere, SPHERE_FIXED, SPHERE_SIZE } from "./voice-sphere"

interface ScreenRecordProps {
  language:   Language
  onComplete: (recording: RecordingState) => void
  onBack:     () => void
}

const COPY: Record<Language, {
  micTitle: string; allow: string; requesting: string
  blockedTitle: string; retry: string; back: string
  ready: string; rec: string; stop: string
}> = {
  en: {
    micTitle:     "To collect your voice signature, I'll ask you to read aloud a text that will appear on screen. For this I need access to your microphone.",
    allow:        "ALLOW ACCESS",
    requesting:   "REQUESTING...",
    blockedTitle: "Microphone blocked. Tap the button to grant access and continue.",
    retry:        "ALLOW ACCESS",
    back:         "← back",
    ready:        "VESSEL READY",
    rec:          "RECEIVING SIGNAL",
    stop:         "stop recording",
  },
  he: {
    micTitle:     "כדי לאסוף את חתימת הקול, תתבקשו לקרוא בקול רם טקסט שיופיע על המסך. נדרשת גישה למיקרופון.",
    allow:        "לאפשר גישה",
    requesting:   "מבקש...",
    blockedTitle: "המיקרופון חסום. לחיצה על הכפתור תאפשר לאשר את הגישה ולהמשיך בהקלטה.",
    retry:        "לאפשר גישה",
    back:         "← חזרה",
    ready:        "הכלי מוכן",
    rec:          "קולט אות",
    stop:         "סיום הקלטה",
  },
  ar: {
    micTitle:     "لجمع توقيعك الصوتي، سأطلب منك قراءة نص يظهر على الشاشة بصوت عالٍ. أحتاج إلى الوصول إلى الميكروفون.",
    allow:        "السماح بالوصول",
    requesting:   "جارٍ الطلب...",
    blockedTitle: "الميكروفون محظور. اضغط الزر للسماح بالوصول والمتابعة.",
    retry:        "السماح بالوصول",
    back:         "← رجوع",
    ready:        "الوعاء جاهز",
    rec:          "يستقبل الإشارة",
    stop:         "إنهاء التسجيل",
  },
}

const INSTR: Record<Language, string[]> = {
  en: [
    "I am here. My voice is here.",
    "No other voice can say these words this way.",
    "I carry what only I can carry.",
    "I leave what only I can leave.",
  ],
  he: [
    "אני כאן. קולי כאן.",
    "שום קול אחר לא יכול לומר את המילים האלה כך.",
    "אני נושא מה שרק אני יכול לשאת.",
    "אני משאיר מה שרק אני יכול להשאיר.",
  ],
  ar: [
    "أنا هنا. صوتي هنا.",
    "لا صوت آخر يستطيع قول هذه الكلمات بهذه الطريقة.",
    "أحمل ما لا يستطيع حمله سواي.",
    "أترك ما لا يستطيع تركه سواي.",
  ],
}

// ── Smooth typewriter ─────────────────────────────────────────────────────────

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

// ── Record icon button ────────────────────────────────────────────────────────

function RecordBtn({ onClick, isRecording }: { onClick: () => void; isRecording: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: 72, height: 72, borderRadius: "50%",
      border: `1.5px solid ${COLOR.text}`,
      background: isRecording ? COLOR.text : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
      transition: "background 0.35s ease",
      WebkitTapHighlightColor: "transparent",
    }}>
      {isRecording
        ? <div style={{ width: 22, height: 22, background: COLOR.bg, borderRadius: 3 }} />
        : <div style={{ width: 26, height: 26, borderRadius: "50%", background: COLOR.text }} />
      }
    </button>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ScreenRecord({ language, onComplete, onBack }: ScreenRecordProps) {
  const dir  = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const copy = COPY[language]

  // Fade in on mount (arrives from exhibition screen fade-to-black)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])

  type PermState = "idle" | "requesting" | "granted" | "denied"
  const [permState,     setPermState]     = useState<PermState>("idle")
  const micBtnRef = useRef<HTMLDivElement>(null)
  const [instrLines,    setInstrLines]    = useState<string[]>([])
  const [showRecordBtn, setShowRecordBtn] = useState(false)
  const [isRecording,   setIsRecording]   = useState(false)
  const [elapsed,       setElapsed]       = useState(0)
  const [analyser,      setAnalyser]      = useState<AnalyserNode | null>(null)
  const [freqs,         setFreqs]         = useState({ bassHz: 0, midHz: 0, highHz: 0 })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef  = useRef<AudioContext | null>(null)
  const startTimeRef     = useRef<number>(0)

  const resolveRef = useRef<(() => void) | null>(null)
  const notifyDone = useCallback(() => { resolveRef.current?.(); resolveRef.current = null }, [])
  function waitTyping() { return new Promise<void>(r => { resolveRef.current = r }) }

  const stopAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioContextRef.current) audioContextRef.current.close()
  }, [])

  useEffect(() => {
    return () => { setTimeout(stopAll, 0) }
  }, [stopAll])

  // Hide micBtn before first paint — keeps opacity out of JSX so React never re-applies it
  useLayoutEffect(() => {
    const el = micBtnRef.current
    if (el) { el.style.opacity = "0"; el.style.pointerEvents = "none" }
  }, [])

  // Hide mic button when permission is resolved (no React re-render needed)
  useEffect(() => {
    if (permState === "granted" || permState === "denied") {
      const el = micBtnRef.current
      if (el) { el.style.opacity = "0"; el.style.pointerEvents = "none" }
    }
  }, [permState])

  useEffect(() => {
    if (permState !== "granted") return
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    async function run() {
      for (const line of INSTR[language]) {
        if (cancelled) return
        setInstrLines(prev => [...prev, line])
        await waitTyping()
        if (cancelled) return
        await sleep(500)
      }
      if (!cancelled) setShowRecordBtn(true)
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permState])

  const requestPermission = async () => {
    setPermState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPermState("granted")
      try {
        const ctx = new AudioContext()
        audioContextRef.current = ctx
        const src = ctx.createMediaStreamSource(stream)
        const node = ctx.createAnalyser()
        node.fftSize = 2048
        src.connect(node)
        setAnalyser(node)
      } catch { /* waveform unavailable */ }
    } catch { setPermState("denied") }
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const elapsedRef = { current: 0 }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", ""]
      .find(t => !t || MediaRecorder.isTypeSupported(t)) ?? ""
    let mr: MediaRecorder
    try { mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined) }
    catch { return }
    mediaRecorderRef.current = mr
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const type = mr.mimeType || "audio/webm"
      onComplete({ blob: new Blob(chunksRef.current, { type }), duration: elapsedRef.current, waveformPeaks: generatePeaks(elapsedRef.current) })
    }
    mr.start(100)
    setIsRecording(true)
    startTimeRef.current = Date.now()
    setElapsed(0)
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000)
      elapsedRef.current = sec
      setElapsed(sec)
      // no time limit — recording continues until user stops
    }, 250)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`

  // Always "active" once granted — no mode switch on recording start/stop, no effect re-runs
  const sphereMode = permState === "denied" ? "still" : permState === "granted" ? "active" : "ready"

  const STYLE = `@keyframes rec-dot { 0%,100%{opacity:1} 50%{opacity:0.2} }`

  // ── Single render — sphere never unmounts ─────────────────────────────────
  return (
    <div style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.55s ease" }}>
    <DSShell dir={dir}>
      <style>{STYLE}</style>
      <InteriorBg />
      <DSTopBar right={<AltSigTicker />} />

      {/* ── SPHERE — always at the same fixed position, never moves ── */}
      <div style={SPHERE_FIXED}>
        <div style={SPHERE_SIZE}>
          <VoiceSphere
            analyser={analyser}
            isRecording={isRecording}
            mode={sphereMode}
            onFrequencies={(b, m, h) => setFreqs({ bassHz: b, midHz: m, highHz: h })}
          />
        </div>
      </div>

      {/* ── HUD — top ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", gap: "0.35rem",
        opacity: permState === "granted" ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}>
        <div style={{
          fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs,
          letterSpacing: TRACK.caps, textTransform: "uppercase",
          color: isRecording ? "#d97a96" : "#7dd4a0",
          textShadow: isRecording
            ? "0 0 8px rgba(217,122,150,0.75), 0 0 20px rgba(217,122,150,0.35)"
            : "0 0 8px rgba(125,212,160,0.6),  0 0 20px rgba(125,212,160,0.28)",
          opacity: 0.95,
          transition: "color 0.5s ease, text-shadow 0.5s ease",
          display: "flex", alignItems: "center", gap: 8, direction: "ltr",
        }}>
          {isRecording && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: "rec-dot 1s ease-in-out infinite", flexShrink: 0 }} />}
          <span>{isRecording ? copy.rec : copy.ready}</span>
          {isRecording && <span style={{ opacity: 0.55, letterSpacing: TRACK.sm }}>· {fmt(elapsed)}</span>}
        </div>
      </div>

      {/* ── BOTTOM TEXT — all states share this zone ── */}
      <div style={{
        position: "fixed", bottom: "clamp(9rem, 22vw, 12rem)",
        left: 0, right: 0, zIndex: 6,
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
      }}>

        {/* Mic permission text */}
        <div style={{
          opacity: permState === "idle" || permState === "requesting" ? 1 : 0,
          transition: "opacity 0.5s ease",
          pointerEvents: permState === "idle" || permState === "requesting" ? "auto" : "none",
          position: permState === "granted" || permState === "denied" ? "absolute" : "relative",
        }}>
          <p style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.65, color: COLOR.text, opacity: OPACITY.primary, margin: 0, direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}>
            <TypeLine text={copy.micTitle} speed={18} onDone={() => {
              const el = micBtnRef.current
              if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto" }
            }} />
          </p>
        </div>

        {/* Blocked text */}
        <div style={{
          opacity: permState === "denied" ? 1 : 0,
          transition: "opacity 0.5s ease",
          pointerEvents: permState === "denied" ? "auto" : "none",
          position: permState !== "denied" ? "absolute" : "relative",
        }}>
          <p style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.65, color: COLOR.error ?? "#e57373", opacity: OPACITY.primary, margin: 0, direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}>
            {copy.blockedTitle}
          </p>
        </div>

        {/* Mantra lines (after granted — stays visible during recording) */}
        <div style={{
          opacity: permState === "granted" ? 1 : 0,
          transition: "opacity 0.5s ease",
          display: "flex", flexDirection: "column",
          gap: "clamp(0.5rem, 1.5vw, 0.75rem)",
        }}>
          {instrLines.map((line, i, arr) => (
            <p key={i} style={{
              fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.65,
              color: COLOR.text,
              opacity: i === arr.length - 1 ? OPACITY.primary : 0.28,
              margin: 0,
              letterSpacing: language === "en" ? TRACK.en : TRACK.body,
              textAlign: dir === "rtl" ? "right" : "left",
              transition: "opacity 1.2s ease",
            }}>
              <TypeLine text={line} speed={12} onDone={notifyDone} />
            </p>
          ))}
        </div>

      </div>

      {/* ── Permission button — own fixed div, ref-driven opacity ── */}
      <div ref={micBtnRef} style={{
        position: "fixed", bottom: "max(1.5rem, env(safe-area-inset-bottom))",
        left: "1rem", right: "1rem", zIndex: 20,
        transition: "opacity 0.8s ease",
      }}>
        <DSButton onClick={requestPermission} disabled={permState === "requesting"} color={COLOR.text}>
          {permState === "requesting" ? copy.requesting : copy.allow}
        </DSButton>
      </div>

      {/* ── Blocked — back + retry — own fixed div, never clipped ── */}
      <div style={{
        position: "fixed", bottom: "max(1.5rem, env(safe-area-inset-bottom))",
        left: "1rem", right: "1rem", zIndex: 20,
        opacity: permState === "denied" ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: permState === "denied" ? "auto" : "none",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <DSBack onClick={onBack}>{copy.back}</DSBack>
        </div>
        <DSButton
          onClick={() => {
            setPermState("idle")
            // Re-show the allow button (managed via ref, not React state)
            const el = micBtnRef.current
            if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto" }
          }}
          color={COLOR.text}
        >
          {copy.retry}
        </DSButton>
      </div>

      {/* ── Record icon — own fixed div, centred ── */}
      <div style={{
        position: "fixed", bottom: "max(1.5rem, env(safe-area-inset-bottom))",
        left: 0, right: 0, zIndex: 20,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        opacity: showRecordBtn ? 1 : 0,
        transform: showRecordBtn ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
        pointerEvents: showRecordBtn ? "auto" : "none",
      }}>
        <RecordBtn onClick={isRecording ? stopRecording : startRecording} isRecording={isRecording} />
      </div>

    </DSShell>
    </div>
  )
}

function generatePeaks(duration: number): number[] {
  const count = Math.max(40, duration * 4)
  return Array.from({ length: count }, (_, i) => {
    const base = Math.sin((i / count) * Math.PI) * 0.6
    return Math.max(0.05, base + (Math.random() - 0.5) * 0.4)
  })
}
