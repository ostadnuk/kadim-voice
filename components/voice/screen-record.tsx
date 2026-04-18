"use client"

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react" // useCallback kept for stopAll
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

// Text the user reads aloud during recording — appears at reading pace
const INSTR: Record<Language, string[]> = {
  en: [
    "I was here.",
    "My voice was here.",
    "No other voice can say it this way.",
  ],
  he: [
    "הייתי כאן.",
    "קולי היה כאן.",
    "שום קול אחר לא יכול לומר את זה כך.",
  ],
  ar: [
    "كنت هنا.",
    "صوتي كان هنا.",
    "لا صوت آخر يستطيع قوله بهذه الطريقة.",
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
    <div style={{ position: "relative", width: 72, height: 72 }}>
      {/* Pulsing ring — only visible while recording */}
      {isRecording && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `1.5px solid ${COLOR.text}`,
          animation: "rec-ring 1.6s ease-out infinite",
          pointerEvents: "none",
        }} />
      )}
      <button onClick={onClick} style={{
        position: "absolute", inset: 0,
        borderRadius: "50%",
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
    </div>
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
  const [showRecordBtn, setShowRecordBtn] = useState(false)
  const [isRecording,   setIsRecording]   = useState(false)
  // Reading text — only visible during recording, typed at reading pace
  const [readingLine,   setReadingLine]   = useState(-1)
  const [readingChars,  setReadingChars]  = useState(0)
  const [elapsed,       setElapsed]       = useState(0)
  const [analyser,      setAnalyser]      = useState<AnalyserNode | null>(null)
  const [freqs,         setFreqs]         = useState({ bassHz: 0, midHz: 0, highHz: 0 })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef  = useRef<AudioContext | null>(null)
  const startTimeRef     = useRef<number>(0)

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

  // Show record button shortly after permission granted
  useEffect(() => {
    if (permState !== "granted") return
    const t = setTimeout(() => setShowRecordBtn(true), 500)
    return () => clearTimeout(t)
  }, [permState])

  // Reading sequence: starts when recording begins, types each line at reading pace
  useEffect(() => {
    if (!isRecording) {
      setReadingLine(-1)
      setReadingChars(0)
      return
    }
    const lines = INSTR[language]
    const timers: ReturnType<typeof setTimeout>[] = []
    let cancelled = false

    function typeChar(lineIdx: number, charIdx: number) {
      if (cancelled || lineIdx >= lines.length) return
      if (charIdx === 0) { setReadingLine(lineIdx); setReadingChars(0) }
      if (charIdx < lines[lineIdx].length) {
        setReadingChars(charIdx + 1)
        timers.push(setTimeout(() => typeChar(lineIdx, charIdx + 1), 72))
      } else {
        // Line complete — pause then start next
        timers.push(setTimeout(() => typeChar(lineIdx + 1, 0), 1100))
      }
    }

    timers.push(setTimeout(() => typeChar(0, 0), 600))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, language])

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

  const STYLE = `
    @keyframes rec-dot   { 0%,100%{opacity:1} 50%{opacity:0.2} }
    @keyframes rec-ring  { 0%{transform:scale(1);   opacity:0.55}
                           70%{transform:scale(1.9); opacity:0}
                           100%{transform:scale(1.9);opacity:0} }
  `

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

      {/* ── Permission / blocked text — bottom anchored, fades out after grant ── */}
      <div style={{
        position: "fixed", bottom: "clamp(9rem, 22vw, 12rem)",
        left: 0, right: 0, zIndex: 6,
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        opacity: permState === "granted" ? 0 : 1,
        transition: "opacity 0.5s ease",
        pointerEvents: permState === "granted" ? "none" : "auto",
      }}>
        {/* Mic permission text */}
        <div style={{
          opacity: permState === "idle" || permState === "requesting" ? 1 : 0,
          transition: "opacity 0.5s ease",
          position: permState === "denied" ? "absolute" : "relative",
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
          position: permState !== "denied" ? "absolute" : "relative",
        }}>
          <p style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.65, color: COLOR.error ?? "#e57373", opacity: OPACITY.primary, margin: 0, direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}>
            {copy.blockedTitle}
          </p>
        </div>
      </div>

      {/* ── Reading text — appears ONLY during recording, anchored above the button ── */}
      <div style={{
        position: "fixed",
        // Sit just above the record button (72px) + bottom inset + generous breathing room
        bottom: "calc(max(1.5rem, env(safe-area-inset-bottom)) + 72px + 2.2rem)",
        left: 0, right: 0,
        zIndex: 6, pointerEvents: "none",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        display: "flex", flexDirection: "column",
        gap: "clamp(0.75rem, 2.5vw, 1.1rem)",
      }}>
        {INSTR[language].map((line, i) => {
          const isActive  = i === readingLine
          // Show only the previous line (faded) and current — 2 lines max visible
          const isPrev    = i === readingLine - 1
          if (!isActive && !isPrev) return null
          return (
            <p key={i} style={{
              fontFamily: FONT.base, fontWeight: isPrev ? 400 : 500,
              fontSize: TYPE.lg, lineHeight: 1.55,
              color: COLOR.text,
              opacity: isPrev ? 0.25 : OPACITY.primary,
              margin: 0, direction: dir,
              textAlign: dir === "rtl" ? "right" : "left",
              transition: "opacity 0.8s ease",
            }}>
              {isPrev ? line : line.slice(0, readingChars)}
              {isActive && readingChars < line.length && (
                <span className="ds-cursor" style={{ opacity: 0.7 }}>▌</span>
              )}
            </p>
          )
        })}
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
