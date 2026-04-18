"use client"

/**
 * ChladniThumbnail — fast 2D raster render of a voice's Chladni nodal-line pattern.
 * Uses a grid evaluation (no rejection sampling) so it's synchronous and cheap.
 * Suitable for rendering dozens of thumbnails in a list.
 */

import { useEffect, useRef } from "react"
import { buildChladniRaster } from "@/lib/chladni"

interface ChladniThumbnailProps {
  signaturePoints: number[]
  size?: number          // CSS display size in px (default 88)
  gridSize?: number      // internal raster resolution (default 72)
  /** Highlight color in r,g,b (default cool blue-white 200,212,248) */
  color?: [number, number, number]
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

    canvas.width  = gridSize
    canvas.height = gridSize

    const field = buildChladniRaster(signaturePoints, gridSize)

    const imageData = ctx.createImageData(gridSize, gridSize)
    const [r, g, b] = color

    for (let i = 0; i < gridSize * gridSize; i++) {
      const v = field[i]
      const idx = i * 4
      if (v < 0) {
        // Outside circle — transparent
        imageData.data[idx + 3] = 0
        continue
      }
      // Low value = nodal line = bright; high value = antinode = dark
      const brightness = Math.max(0, 1 - v * 9)
      imageData.data[idx]     = r
      imageData.data[idx + 1] = g
      imageData.data[idx + 2] = b
      imageData.data[idx + 3] = Math.round(brightness * 200)
    }

    ctx.putImageData(imageData, 0, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePoints, gridSize])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width:           size,
        height:          size,
        display:         "block",
        imageRendering:  "auto",
        borderRadius:    "50%",  // circular crop — mirrors the Chladni circle boundary
      }}
    />
  )
}
