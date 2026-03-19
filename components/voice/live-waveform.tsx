"use client"

import { useEffect, useRef } from "react"

interface LiveWaveformProps {
  analyser: AnalyserNode | null
  isRecording: boolean
  color?: string
  height?: number
  className?: string
}

export function LiveWaveform({
  analyser,
  isRecording,
  color = "#c8a048",
  height = 80,
  className = "",
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser || !isRecording) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      if (!ctx || !analyser) return
      animationRef.current = requestAnimationFrame(draw)

      analyser.getByteTimeDomainData(dataArray)
      ctx.clearRect(0, 0, width, height)

      ctx.lineWidth = 1.5
      ctx.strokeStyle = color
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.lineTo(width, height / 2)
      ctx.stroke()
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [analyser, isRecording, height])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className}`}
      style={{ height }}
      aria-label="Live audio waveform"
      role="img"
    />
  )
}
