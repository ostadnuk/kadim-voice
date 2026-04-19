"use client"

/**
 * ChladniThumbnail — point-cloud render of a voice's Chladni nodal pattern.
 *
 * Uses the same buildChladniPositions rejection-sampling algorithm as the
 * imprint canvas, then renders dots with additive blending — so thumbnails
 * look like a miniature version of the actual signature, not a field map.
 */

import { useEffect, useRef } from "react"
import { buildChladniPositions } from "@/lib/chladni"

interface ChladniThumbnailProps {
  signaturePoints: number[]
  size?:           number           // CSS display size in px (default 88)
  gridSize?:       number           // internal raster resolution (default 72)
  /** Highlight color [r, g, b] (default cool blue-white 200,212,248) */
  color?: [number, number, number]
}

// Point counts — small canvas needs fewer points, large dialog needs more
function nForSize(gridSize: number) {
  if (gridSize <= 56)  return 1_800
  if (gridSize <= 100) return 3_500
  return 8_000
}

export function ChladniThumbnail({
  signaturePoints,
  size     = 88,
  gridSize = 72,
  color    = [200, 212, 248],
}: ChladniThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const res = gridSize
    canvas.width  = res
    canvas.height = res

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = "#070c17"
    ctx.fillRect(0, 0, res, res)

    // ── Build point cloud (same algorithm as imprint canvas) ──────────────────
    const N   = nForSize(gridSize)
    const pts = buildChladniPositions(signaturePoints, N)
    const R   = 2.3   // coordinate range used by buildChladniPositions

    const [r, g, b] = color
    const cx  = res / 2
    const cy  = res / 2
    const rad = res / 2  // circle clip radius
    const dotR = Math.max(0.55, res / 52)

    // Additive blending — overlapping dots brighten, just like the 3D canvas
    ctx.globalCompositeOperation = "lighter"

    for (let i = 0; i < N; i++) {
      const px = pts[i * 3]
      const py = pts[i * 3 + 1]

      // Map from Chladni space [-R, R] to canvas pixels [0, res]
      const sx = (px / R + 1) * 0.5 * res
      const sy = (py / R + 1) * 0.5 * res

      // Circular clip — skip points outside the circle
      const dx = sx - cx; const dy = sy - cy
      if (dx * dx + dy * dy > rad * rad) continue

      // Soft falloff: large dots are rarer, small dots fill the field
      const isBright = Math.random() < 0.06
      const dr = isBright ? dotR * 2.2 : dotR

      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, dr)
      grad.addColorStop(0, `rgba(${r},${g},${b},${isBright ? 0.55 : 0.28})`)
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(sx, sy, dr, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Circular mask (clean edges) ───────────────────────────────────────────
    ctx.globalCompositeOperation = "destination-in"
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()

    ctx.globalCompositeOperation = "source-over"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePoints, gridSize])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width:          size,
        height:         size,
        display:        "block",
        imageRendering: "auto",
        borderRadius:   "50%",
      }}
    />
  )
}
