"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { LiveWaveform } from "./live-waveform"
import type { RecordingState } from "@/lib/types"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, SignalBar, COLOR, FONT } from "./ds"

interface ScreenRecordProps {
  language:   Language
  onComplete: (recording: RecordingState) => void
  onBack:     () => void
}

const MAX_DURATION = 30

const LANG_COLOR: Record<Language, string> = {
  en: "#C36981",
  he: "#A53D1E",
  ar: "#324238",
}

const LANG_FONT: Record<Language, string> = {
  en: "'narkiss-yair-variable', sans-serif",
  he: "'narkiss-yair-variable', sans-serif",
  ar: "'narkiss-yair-variable', sans-serif",
}

const MIC_TEXT: Record<Language, { title: string; body: string; allow: string; requesting: string }> = {
  en: {
    title:      "I need your microphone.",
    body:       "To receive your voice signature, access to your microphone is required.",
    allow:      "ALLOW ACCESS",
    requesting: "REQUESTING...",
  },
  he: {
    title:      "אני צריך את המיקרופון שלך.",
    body:       "כדי לקלוט את חתימת הקול שלך, נדרשת גישה למיקרופון.",
    allow:      "אפשר גישה",
    requesting: "מבקש...",
  },
  ar: {
    title:      "أحتاج إلى ميكروفونك.",
    body:       "لاستقبال توقيع صوتك، يلزم الوصول إلى الميكروفون.",
    allow:      "السماح بالوصول",
    requesting: "جارٍ الطلب...",
  },
}

const BLOCKED_TEXT: Record<Language, { title: string; body: string; retry: string }> = {
  en: {
    title: "Microphone blocked.",
    body:  "Your device is blocking microphone access. Enable it in your browser settings to continue.",
    retry: "TRY AGAIN",
  },
  he: {
    title: "המיקרופון חסום.",
    body:  "המכשיר שלך חוסם את הגישה למיקרופון. אפשר אותה בהגדרות הדפדפן.",
    retry: "נסה שוב",
  },
  ar: {
    title: "الميكروفون محظور.",
    body:  "جهازك يحظر الوصول إلى الميكروفون. فعّله في إعدادات المتصفح للمتابعة.",
    retry: "حاول مجدداً",
  },
}

const STATUS_TEXT: Record<Language, { ready: string; rec: string; back: string }> = {
  en: { ready: "READY TO RECEIVE", rec: "RECEIVING SIGNAL", back: "← back" },
  he: { ready: "מוכן לקלוט",       rec: "קולט אות",        back: "← חזרה" },
  ar: { ready: "جاهز للاستقبال",   rec: "يستقبل الإشارة",  back: "← رجوع" },
}

export function ScreenRecord({ language, onComplete, onBack }: ScreenRecordProps) {
  const t    = translations[language].record
  const dir  = translations[language].direction
  const color = LANG_COLOR[language]
  const font  = LANG_FONT[language]
  const mic   = MIC_TEXT[language]
  const blk   = BLOCKED_TEXT[language]
  const st    = STATUS_TEXT[language]

  const [permissionState, setPermissionState] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed,     setElapsed]     = useState(0)
  const [analyser,    setAnalyser]    = useState<AnalyserNode | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef  = useRef<AudioContext | null>(null)
  const startTimeRef     = useRef<number>(0)

  const stopAll = useCallback(() => {
    if (timerRef.current)        clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
    if (streamRef.current)       streamRef.current.getTracks().forEach(t => t.stop())
    if (audioContextRef.current) audioContextRef.current.close()
  }, [])

  // StrictMode in dev mounts → unmounts → remounts. If we stop the stream on the
  // first cleanup, the button never works. Solution: defer cleanup by one tick so
  // a remount can cancel it. On real unmount there is no remount, so it fires.
  const pendingCleanupRef = useRef(false)
  useEffect(() => {
    pendingCleanupRef.current = false          // cancel any queued cleanup on remount
    return () => {
      pendingCleanupRef.current = true
      setTimeout(() => { if (pendingCleanupRef.current) stopAll() }, 0)
    }
  }, [stopAll])

  const requestPermission = async () => {
    setPermissionState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPermissionState("granted")
      // AudioContext is optional — fails on iOS if outside user-gesture timing
      try {
        const ctx  = new AudioContext()
        audioContextRef.current = ctx
        const src  = ctx.createMediaStreamSource(stream)
        const node = ctx.createAnalyser()
        node.fftSize = 2048
        src.connect(node)
        setAnalyser(node)
      } catch { /* waveform unavailable, recording unaffected */ }
    } catch { setPermissionState("denied") }
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const elapsedRef = { current: 0 }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", ""]
      .find(t => !t || MediaRecorder.isTypeSupported(t)) ?? ""
    let mr: MediaRecorder
    try {
      mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
    } catch { return }
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
      if (sec >= MAX_DURATION) stopRecording()
    }, 250)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`

  const progress = (elapsed / MAX_DURATION) * 100

  // ── Permission screen ───────────────────────────────────────────────────────
  if (permissionState === "idle" || permissionState === "requesting") {
    return (
      <DSShell dir={dir}>
        <style>{`@keyframes ring-pulse { 0%,100%{transform:scale(1);opacity:var(--ro)} 50%{transform:scale(1.06);opacity:calc(var(--ro)*1.7)} }`}</style>
        <DSTopBar
          left={<SignalBar color={color} />}
          right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color, opacity: 0.45 }}>VESSEL · INTERIOR</span>}
        />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6">
          {/* Pulsing mic icon */}
          <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {[100, 72, 44].map((size, i) => (
              <div key={i} style={{
                position: "absolute", width: size, height: size, borderRadius: "50%",
                border: `1px solid ${color}`,
                pointerEvents: "none",
                // @ts-expect-error css var
                "--ro": [0.06, 0.12, 0.25][i],
                animation: `ring-pulse 3.5s ease-in-out ${i * 0.5}s infinite`,
              }} />
            ))}
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, opacity: 0.7 }} />
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: dir === "rtl" ? "right" : "left", width: "100%", maxWidth: 320 }}>
            <p style={{ fontFamily: font, fontWeight: 600, fontSize: "clamp(1.1rem, 5.5vw, 1.4rem)", lineHeight: 1.3, color, opacity: 0.9, margin: 0 }}>
              {mic.title}
            </p>
            <p style={{ fontFamily: FONT.mono, fontSize: "clamp(11px, 3vw, 13px)", lineHeight: 1.8, letterSpacing: "0.05em", color: COLOR.text, opacity: 0.45, margin: 0 }}>
              {mic.body}
            </p>
          </div>
        </div>
        <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
          <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
            <DSBack onClick={onBack}>{st.back}</DSBack>
          </div>
          <DSButton onClick={requestPermission} disabled={permissionState === "requesting"} color={color}>
            {permissionState === "requesting" ? mic.requesting : mic.allow}
          </DSButton>
        </div>
      </DSShell>
    )
  }

  // ── Denied screen ───────────────────────────────────────────────────────────
  if (permissionState === "denied") {
    const errColor = "#c05050"
    return (
      <DSShell dir={dir}>
        <DSTopBar
          left={<SignalBar color={errColor} />}
          right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: errColor, opacity: 0.7 }}>SIGNAL BLOCKED</span>}
        />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6">
          <div style={{ width: 48, height: 48, border: `1px solid ${errColor}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.7 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 22, color: errColor }}>✕</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: dir === "rtl" ? "right" : "left", width: "100%", maxWidth: 320 }}>
            <p style={{ fontFamily: font, fontWeight: 600, fontSize: "clamp(1.1rem, 5.5vw, 1.4rem)", lineHeight: 1.3, color: errColor, opacity: 0.9, margin: 0 }}>
              {blk.title}
            </p>
            <p style={{ fontFamily: FONT.mono, fontSize: "clamp(11px, 3vw, 13px)", lineHeight: 1.8, letterSpacing: "0.05em", color: COLOR.text, opacity: 0.45, margin: 0 }}>
              {blk.body}
            </p>
          </div>
        </div>
        <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
          <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
            <DSBack onClick={onBack}>{st.back}</DSBack>
          </div>
          <DSButton onClick={() => setPermissionState("idle")} color={errColor}>{blk.retry}</DSButton>
        </div>
      </DSShell>
    )
  }

  // ── Recording screen ────────────────────────────────────────────────────────
  return (
    <DSShell dir={dir}>
      <style>{`
        @keyframes rec-ring {
          0%,100% { transform: scale(1);    opacity: var(--ro); }
          50%      { transform: scale(1.08); opacity: calc(var(--ro) * 2); }
        }
        @keyframes rec-dot {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>

      {/* Top bar */}
      <DSTopBar
        left={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isRecording && (
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e05050", display: "inline-block", animation: "rec-dot 1s ease-in-out infinite" }} />
            )}
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color, opacity: isRecording ? 0.9 : 0.5 }}>
              {isRecording ? st.rec : st.ready}
            </span>
          </div>
        }
        right={
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color, opacity: 0.5 }}>
            {elapsed}/{MAX_DURATION}s
          </span>
        }
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-between px-5 py-4">

        {/* Timer */}
        <div style={{ textAlign: "center", paddingTop: "clamp(0.5rem, 3vw, 1.5rem)" }}>
          <span style={{
            fontFamily: FONT.mono,
            fontSize:   "clamp(3.5rem, 20vw, 6rem)",
            letterSpacing: "0.06em",
            color:      isRecording ? color : COLOR.secondary,
            lineHeight: 1,
            transition: "color 0.4s ease",
            textShadow: isRecording ? `0 0 40px ${color}55` : "none",
            display:    "block",
          }}>
            {fmt(elapsed)}
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.3em", color, opacity: 0.3, textTransform: "uppercase", display: "block", marginTop: 6 }}>
            {MAX_DURATION - elapsed}s remaining
          </span>
        </div>

        {/* Record button + rings */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Pulsing rings */}
            {[160, 120, 84].map((size, i) => (
              <div key={i} style={{
                position: "absolute", width: size, height: size, borderRadius: "50%",
                border: `1px solid ${color}`,
                pointerEvents: "none",
                // @ts-expect-error css var
                "--ro": isRecording ? [0.25, 0.18, 0.12][i] : [0.08, 0.05, 0.03][i],
                animation: `rec-ring ${isRecording ? "1.4s" : "3.5s"} ease-in-out ${i * 0.3}s infinite`,
              }} />
            ))}

            {/* The button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              style={{
                width: 64, height: 64,
                borderRadius: "50%",
                background:   isRecording ? color : "transparent",
                border:       `2px solid ${color}`,
                display:      "flex", alignItems: "center", justifyContent: "center",
                cursor:       "pointer",
                transition:   "background 0.3s ease, box-shadow 0.3s ease",
                boxShadow:    isRecording ? `0 0 30px ${color}66` : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {isRecording
                ? <div style={{ width: 18, height: 18, background: COLOR.bg }} />
                : <div style={{ width: 20, height: 20, borderRadius: "50%", background: color }} />
              }
            </button>
          </div>

          {/* Label under button */}
          <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.3em", color, opacity: 0.4, textTransform: "uppercase" }}>
            {isRecording ? (language === "he" ? "הקש לעצור" : language === "ar" ? "اضغط للإيقاف" : "TAP TO STOP") : (language === "he" ? "הקש להתחיל" : language === "ar" ? "اضغط للبدء" : "TAP TO BEGIN")}
          </span>
        </div>

        {/* Waveform */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <LiveWaveform analyser={analyser} isRecording={isRecording} color={color} height={60} />
          {/* Progress bar */}
          <div style={{ width: "100%", height: 2, background: COLOR.veryDim, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progress}%`, background: color, transition: "width 0.25s linear", boxShadow: `0 0 8px ${color}88` }} />
          </div>
        </div>
      </div>

      <div className="ds-safe-bottom relative z-10 px-4" style={{ paddingBottom: 12 }}>
        {!isRecording && <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}><DSBack onClick={onBack}>{st.back}</DSBack></div>}
      </div>
    </DSShell>
  )
}

function generatePeaks(duration: number): number[] {
  const count = Math.max(40, duration * 4)
  return Array.from({ length: count }, (_, i) => {
    const base = Math.sin((i / count) * Math.PI) * 0.6
    return Math.max(0.05, base + (Math.random() - 0.5) * 0.4)
  })
}
