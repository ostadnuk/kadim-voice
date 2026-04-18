"use client"

import { useRef, useEffect } from "react"

export type SphereMode = "still" | "ready" | "active"

// ── Shared layout constants ───────────────────────────────────────────────────

export const SPHERE_SIZE: React.CSSProperties = {
  width:    "min(82vw, 46vh)",
  height:   "min(82vw, 46vh)",
  position: "relative",
}

/** Invisible placeholder in the flex flow — same size as sphere so content pushes correctly */
export const SPHERE_PLACEHOLDER: React.CSSProperties = {
  width:     "min(82vw, 46vh)",
  height:    "min(82vw, 46vh)",
  flexShrink: 0,
}

/** Fixed-position centering wrapper — sphere always at true screen center */
export const SPHERE_FIXED: React.CSSProperties = {
  position:      "fixed",
  inset:         0,
  display:       "flex",
  justifyContent: "center",
  alignItems:    "center",
  paddingBottom: "20vh",   // shifts apparent center ~10% upward
  pointerEvents: "none",
  zIndex:        5,
}

// ── VoiceSphere canvas component ──────────────────────────────────────────────
// Colors: #324238 teal · #A53D1E amber · #C36981 rose
// Modes:
//   "still"  — single static frame, nothing moves (denied / review screen)
//   "ready"  — only small dashed ring orbits slowly, gradients dim & fixed (permission screen)
//   "active" — full animation: audio-reactive gradients, breathing rings, tether (recording)

export function VoiceSphere({
  analyser,
  isRecording,
  mode = "active",
  onFrequencies,
}: {
  analyser:       AnalyserNode | null
  isRecording:    boolean
  mode?:          SphereMode
  onFrequencies?: (bassHz: number, midLowHz: number, midHighHz: number) => void
}) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const angleRef       = useRef(-Math.PI / 2)   // starts at 12 o'clock
  const grainsRef      = useRef<HTMLCanvasElement[]>([])
  const frameRef       = useRef(0)
  const onFreqRef      = useRef(onFrequencies)
  const lastFreqsRef   = useRef({ bassHz: 0, midHz: 0, highHz: 0 })
  // Refs so draw loop reads current values without being in the effect deps
  const isRecordingRef = useRef(isRecording)
  const smoothAmpRef   = useRef(0)              // lerped amplitude — never snaps

  useEffect(() => { onFreqRef.current = onFrequencies }, [onFrequencies])
  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctxOrNull = canvas.getContext("2d")
    if (!ctxOrNull) return
    const ctx: CanvasRenderingContext2D = ctxOrNull
    const W = canvas.width, H = canvas.height

    // ── Pre-generate 4 grain canvases ────────────────────────────────────
    grainsRef.current = Array.from({ length: 4 }, () => {
      const gc = document.createElement("canvas")
      gc.width = W; gc.height = H
      const gx = gc.getContext("2d")!
      const gd = gx.createImageData(W, H)
      for (let i = 0; i < gd.data.length; i += 4) {
        const v = Math.random() * 255
        gd.data[i] = v; gd.data[i + 1] = v; gd.data[i + 2] = v
        gd.data[i + 3] = Math.floor(Math.random() * 55)
      }
      gx.putImageData(gd, 0, 0)
      return gc
    })

    const bufLen = analyser ? analyser.frequencyBinCount : 128
    const data   = new Uint8Array(bufLen)
    let raf: number

    // Draw text curved along a circular arc
    function drawArcText(text: string, rcx: number, rcy: number, r: number, startAngle: number, op: number, fontSize: number) {
      ctx.save()
      ctx.font = `300 ${fontSize}px system-ui, sans-serif`
      ctx.fillStyle = `rgba(240, 236, 228, ${op})`
      ctx.textAlign  = "center"
      ctx.textBaseline = "middle"
      const totalWidth = ctx.measureText(text).width
      const totalAngle = totalWidth / r
      let a = startAngle - totalAngle / 2
      for (const char of text) {
        const cw = ctx.measureText(char).width
        const ca = cw / r
        const ax = rcx + r * Math.cos(a + ca / 2)
        const ay = rcy + r * Math.sin(a + ca / 2)
        ctx.save()
        ctx.translate(ax, ay)
        ctx.rotate(a + ca / 2 + Math.PI / 2)
        ctx.fillText(char, 0, 0)
        ctx.restore()
        a += ca
      }
      ctx.restore()
    }

    const draw = () => {
      frameRef.current++
      const cx = W / 2, cy = H / 2
      const sR = Math.min(W, H) * 0.45

      ctx.clearRect(0, 0, W, H)

      // ── Frequency analysis — only in active mode with live audio ─────────
      const rec = isRecordingRef.current
      let bass = 0, midLow = 0, midHigh = 0
      let bassHz = 0, midLowHz = 0, midHighHz = 0
      if (mode === "active" && analyser && rec) {
        analyser.getByteFrequencyData(data)
        const sampleRate = analyser.context.sampleRate
        const binHz      = sampleRate / (bufLen * 2)
        const bEnd  = Math.floor(bufLen * 0.08)
        const mlEnd = Math.floor(bufLen * 0.30)
        const mhEnd = Math.floor(bufLen * 0.65)
        let peakBass = 0, peakMl = bEnd, peakMh = mlEnd
        for (let i = 0;     i < bEnd;  i++) { bass    += data[i] / 255; if (data[i] > data[peakBass])  peakBass = i }
        for (let i = bEnd;  i < mlEnd; i++) { midLow  += data[i] / 255; if (data[i] > data[peakMl])    peakMl   = i }
        for (let i = mlEnd; i < mhEnd; i++) { midHigh += data[i] / 255; if (data[i] > data[peakMh])    peakMh   = i }
        bass    /= bEnd
        midLow  /= (mlEnd - bEnd)
        midHigh /= (mhEnd - mlEnd)
        bassHz    = Math.round(peakBass * binHz)
        midLowHz  = Math.round(peakMl   * binHz)
        midHighHz = Math.round(peakMh   * binHz)

        if (frameRef.current % 4 === 0 && onFreqRef.current) {
          onFreqRef.current(bassHz, midLowHz, midHighHz)
        }
        if (bassHz > 0)    lastFreqsRef.current.bassHz = bassHz
        if (midLowHz > 0)  lastFreqsRef.current.midHz  = midLowHz
        if (midHighHz > 0) lastFreqsRef.current.highHz  = midHighHz
      }

      // Lerped amplitude — never snaps, decays naturally when recording stops
      const rawAmp = (bass * 2.5 + midLow * 1.6 + midHigh * 1.0) / 2.8
      smoothAmpRef.current = smoothAmpRef.current * 0.88 + rawAmp * 0.12
      const amp = smoothAmpRef.current

      const t      = Date.now() / 1000
      // Breath always oscillates — swell during recording, gentle pulse at rest
      const breath = mode === "active"
        ? Math.sin(t * 0.48) * 0.5 * 0.022 + amp * 0.08
        : mode === "ready"
          ? Math.sin(t * 0.52) * 0.016
          : 0

      // ── Ring angle ───────────────────────────────────────────────────────
      const R_outer = sR * (mode === "active" ? 0.91 + amp * 0.06 : 0.91)
      if (mode === "active") angleRef.current += rec ? 0.009 + amp * 0.065 : 0.0025
      const θ  = angleRef.current
      const px = cx + R_outer * Math.cos(θ)
      const py = cy + R_outer * Math.sin(θ)
      const pull = mode === "active" ? 0.22 + amp * 0.32 : 0

      // ── Opacity factors by mode ──────────────────────────────────────────
      const go = 1.0   // gradients: full opacity on all screens
      const ro = 1.0   // rings: full opacity on all screens

      // ── Sphere clip ──────────────────────────────────────────────────────
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, R_outer, 0, Math.PI * 2); ctx.clip()

      // Dark base
      const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, R_outer)
      base.addColorStop(0,   "rgba( 8,  6, 14, 1.0)")
      base.addColorStop(0.7, "rgba(12,  9, 18, 0.98)")
      base.addColorStop(1,   "rgba(16, 12, 22, 0.90)")
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H)

      // ── "screen" compositing — colours brighten where they overlap ────────
      // This creates the vivid, mixed colour atmosphere of the reference image.
      // Gradient centres are INSIDE the sphere so colours fill the interior.
      ctx.globalCompositeOperation = "screen"

      const drift = mode === "active"

      // Teal #324238 — upper-left interior, large blob
      const t1bx = cx + sR * (-0.22 + (drift ? Math.sin(t * 0.36) * 0.08 : 0))
      const t1by = cy + sR * (-0.30 + (drift ? Math.cos(t * 0.28) * 0.07 : 0))
      const g1x  = t1bx + pull * (px - t1bx)
      const g1y  = t1by + pull * (py - t1by)
      const g1r  = sR * (0.80 + breath + amp * 0.40)
      const g1   = ctx.createRadialGradient(g1x, g1y, 0, g1x, g1y, g1r)
      g1.addColorStop(0,    `rgba( 52, 105,  72, ${go * (0.85 + amp * 0.40)})`)
      g1.addColorStop(0.35, `rgba( 35,  75,  52, ${go * (0.55 + amp * 0.30)})`)
      g1.addColorStop(0.68, `rgba( 18,  45,  32, ${go *  0.22})`)
      g1.addColorStop(1,    "rgba(  0,   0,   0,  0)")
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)

      // Amber #A53D1E — left / lower-left interior, large blob
      const t2bx = cx + sR * (-0.38 + (drift ? Math.cos(t * 0.31) * 0.10 : 0))
      const t2by = cy + sR * ( 0.14 + (drift ? Math.sin(t * 0.25) * 0.09 : 0))
      const g2x  = t2bx + pull * (px - t2bx)
      const g2y  = t2by + pull * (py - t2by)
      const g2r  = sR * (0.85 + breath + amp * 0.40)
      const g2   = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, g2r)
      g2.addColorStop(0,    `rgba(210,  80,  28, ${go * (0.90 + amp * 0.30)})`)
      g2.addColorStop(0.30, `rgba(165,  55,  20, ${go * (0.60 + amp * 0.28)})`)
      g2.addColorStop(0.62, `rgba( 95,  30,  12, ${go *  0.25})`)
      g2.addColorStop(1,    "rgba(  0,   0,   0,  0)")
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)

      // Rose #C36981 — lower-right interior, large blob
      const t3bx = cx + sR * ( 0.32 + (drift ? Math.sin(t * 0.27) * 0.10 : 0))
      const t3by = cy + sR * ( 0.24 + (drift ? Math.cos(t * 0.22) * 0.09 : 0))
      const g3x  = t3bx + pull * (px - t3bx)
      const g3y  = t3by + pull * (py - t3by)
      const g3r  = sR * (0.78 + breath + amp * 0.38)
      const g3   = ctx.createRadialGradient(g3x, g3y, 0, g3x, g3y, g3r)
      g3.addColorStop(0,    `rgba(200, 110, 148, ${go * (0.88 + amp * 0.38)})`)
      g3.addColorStop(0.32, `rgba(162,  80, 118, ${go * (0.58 + amp * 0.30)})`)
      g3.addColorStop(0.65, `rgba(100,  46,  74, ${go *  0.24})`)
      g3.addColorStop(1,    "rgba(  0,   0,   0,  0)")
      ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H)

      // Restore to normal compositing before grain
      ctx.globalCompositeOperation = "source-over"

      // ── Film grain — all modes ────────────────────────────────────────────
      const grains = grainsRef.current
      if (grains.length) {
        const gi = mode === "still" ? 0 : Math.floor(frameRef.current / 2) % grains.length
        ctx.globalAlpha = mode === "still" ? 0.55 : 0.72
        ctx.drawImage(grains[gi], 0, 0)
        ctx.globalAlpha = 1
      }

      ctx.restore()   // end sphere clip

      // ── Inner rings ──────────────────────────────────────────────────────
      const ri1 = sR * (0.27 + bass    * 0.52 + breath)
      const ri2 = sR * (0.50 + midLow  * 0.42 + breath)
      const ri3 = sR * (0.72 + midHigh * 0.28 + breath)
      // After recording: use stored Hz values (dimmer) to show captured signature
      const captured = lastFreqsRef.current
      const displayBassHz = rec ? bassHz    : captured.bassHz
      const displayMidHz  = rec ? midLowHz  : captured.midHz
      const displayHighHz = rec ? midHighHz : captured.highHz
      const hzOpMul       = rec ? 1.0 : 0.55   // dimmer after recording

      const ringDefs = [
        { r: ri1, op: ro * (0.32 + bass    * 0.90), hz: displayBassHz, freq: bass    },
        { r: ri2, op: ro * (0.22 + midLow  * 0.80), hz: displayMidHz,  freq: midLow  },
        { r: ri3, op: ro * (0.16 + midHigh * 0.70), hz: displayHighHz, freq: midHigh },
      ]
      const showHz = mode === "active" && (rec || captured.bassHz > 0)

      ringDefs.forEach(({ r, op, hz, freq }) => {
        const rcx    = cx + (R_outer - r) * Math.cos(θ)
        const rcy    = cy + (R_outer - r) * Math.sin(θ)
        const ringOp = Math.max(op, mode === "still" ? 0.12 : 0.10)

        if (showHz && hz > 0) {
          // Draw ring with a gap at the bottom where the Hz label sits
          const fontSize = Math.max(9, Math.round(sR * 0.058))
          ctx.font = `300 ${fontSize}px system-ui, sans-serif`
          const label     = `${hz} Hz`
          const labelW    = ctx.measureText(label).width
          const gapAngle  = (labelW / 2 + 6) / r   // half-gap in radians + padding
          const bottomAng = Math.PI / 2              // 6 o'clock relative to ring center
          // Arc from gap-end to gap-start (long way around, skipping bottom)
          ctx.beginPath()
          ctx.arc(rcx, rcy, r, bottomAng + gapAngle, bottomAng - gapAngle + Math.PI * 2)
          ctx.strokeStyle = `rgba(240, 236, 228, ${ringOp})`
          ctx.lineWidth   = 1.2
          ctx.stroke()
          // Hz label on the line at bottom
          const textOp = (0.50 + freq * 0.45) * hzOpMul
          ctx.textAlign    = "center"
          ctx.textBaseline = "middle"
          ctx.fillStyle    = `rgba(240, 236, 228, ${textOp})`
          ctx.fillText(label, rcx, rcy + r)
        } else {
          // Full ring, no label
          ctx.beginPath(); ctx.arc(rcx, rcy, r, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(240, 236, 228, ${ringOp})`
          ctx.lineWidth   = 1.2
          ctx.stroke()
        }
      })

      // Outer dashed track ring
      ctx.save()
      ctx.setLineDash([2, 9])
      ctx.lineWidth   = 1.0
      ctx.strokeStyle = `rgba(240, 236, 228, ${ro * 0.55})`
      ctx.beginPath(); ctx.arc(cx, cy, R_outer, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // Small dashed ring at connection point
      const smallRingOp = mode === "still" ? 0.45 : mode === "ready" ? 0.55 : 0.75 + amp * 0.25
      // ready: pulse radius only, constant opacity; active: orbits with tether
      const smallRingR  = mode === "ready"
        ? sR * (0.085 + Math.sin(t * 1.6) * 0.018)
        : sR * 0.085
      ctx.save()
      ctx.setLineDash([2, 5])
      ctx.lineWidth   = 1.2
      ctx.strokeStyle = `rgba(240, 236, 228, ${smallRingOp})`
      ctx.beginPath(); ctx.arc(px, py, smallRingR, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      if (mode !== "still") raf = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(raf)
  // isRecording intentionally excluded — accessed via isRecordingRef to prevent effect re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyser, mode])

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={700}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  )
}
