"use client"

import { useEffect, useRef } from "react"

interface WaveformProps {
  peaks: number[]
  progress?: number
  height?: number
  className?: string
  barColor?: string
  activeColor?: string
}

export function Waveform({
  peaks,
  progress = 0,
  height = 64,
  className = "",
  barColor = "hsl(0 0% 82%)",
  activeColor = "hsl(0 0% 8%)",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const barWidth = 2
    const gap = 2
    const totalBarWidth = barWidth + gap
    const barsCount = Math.floor(width / totalBarWidth)
    const step = peaks.length / barsCount
    const activeBar = Math.floor(barsCount * progress)

    for (let i = 0; i < barsCount; i++) {
      const peakIndex = Math.min(Math.floor(i * step), peaks.length - 1)
      const peakValue = peaks[peakIndex]
      const barHeight = Math.max(2, peakValue * (height - 4))
      const x = i * totalBarWidth
      const y = (height - barHeight) / 2

      ctx.fillStyle = i <= activeBar && progress > 0 ? activeColor : barColor
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 1)
      ctx.fill()
    }
  }, [peaks, progress, height, barColor, activeColor])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className}`}
      style={{ height }}
      aria-label="Audio waveform"
      role="img"
    />
  )
}
