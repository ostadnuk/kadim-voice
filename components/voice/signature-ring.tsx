"use client"

import { useEffect, useRef } from "react"

interface SignatureRingProps {
  points: number[]
  size?: number
  strokeColor?: string
  strokeWidth?: number
  className?: string
  animated?: boolean
}

export function SignatureRing({
  points,
  size = 200,
  strokeColor = "hsl(0 0% 8%)",
  strokeWidth = 1.5,
  className = "",
  animated = false,
}: SignatureRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const progressRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const baseRadius = size * 0.3
    const maxAmplitude = size * 0.15

    function draw(progress: number) {
      if (!ctx) return
      ctx.clearRect(0, 0, size, size)
      ctx.beginPath()

      const count = points.length
      const visibleCount = animated ? Math.floor(count * progress) : count

      for (let i = 0; i <= visibleCount; i++) {
        const idx = i % count
        const angle = (idx / count) * Math.PI * 2 - Math.PI / 2
        const amplitude = points[idx] * maxAmplitude
        const r = baseRadius + amplitude

        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          const prevIdx = (idx - 1 + count) % count
          const prevAngle = (prevIdx / count) * Math.PI * 2 - Math.PI / 2
          const prevR = baseRadius + points[prevIdx] * maxAmplitude
          const prevX = cx + Math.cos(prevAngle) * prevR
          const prevY = cy + Math.sin(prevAngle) * prevR

          const cpx = (prevX + x) / 2
          const cpy = (prevY + y) / 2
          ctx.quadraticCurveTo(prevX, prevY, cpx, cpy)
        }
      }

      if (!animated || progress >= 1) {
        ctx.closePath()
      }

      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.lineJoin = "round"
      ctx.stroke()
    }

    if (animated) {
      progressRef.current = 0
      const animate = () => {
        progressRef.current += 0.015
        draw(Math.min(progressRef.current, 1))
        if (progressRef.current < 1) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      animationRef.current = requestAnimationFrame(animate)
    } else {
      draw(1)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [points, size, strokeColor, strokeWidth, animated])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
      aria-label="Voice signature visualization"
      role="img"
    />
  )
}
