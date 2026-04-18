/**
 * Chladni nodal-line point generation — shared utility.
 * Used by VoiceCanvasUnified (3D full-res) and ArchiveCanvas (3D collective).
 */

const NUM_MODES = 10

function makeRng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

/**
 * Build a Float32Array of [x,y,z, x,y,z, ...] Chladni nodal-line positions.
 * Points cluster near zero-crossings of a superposition of standing waves
 * derived from the voice signature — producing a unique pattern per voice.
 *
 * @param sig   Voice signature values (typically 64 floats in [0,1])
 * @param N     Number of 3D points to generate (default 20 000)
 */
export function buildChladniPositions(sig: number[], N = 20_000): Float32Array {
  const n    = sig.length || 1
  const rng  = makeRng(sig.reduce((a, v, i) => a + v * (i + 1), 0))
  const R    = 2.3

  const modes: Array<{ fx: number; fy: number; px: number; py: number; amp: number }> = []
  for (let k = 0; k < NUM_MODES; k++) {
    const binA = Math.floor((k / NUM_MODES) * n)
    const binB = Math.floor(((k + NUM_MODES * 0.5) / NUM_MODES) * n) % n
    const sA   = sig[binA] ?? 0.4
    const sB   = sig[binB] ?? 0.4
    const fBase = 1.8 + k * 0.9
    modes.push({
      fx: fBase * (0.55 + sA * 0.9), fy: fBase * (0.55 + sB * 0.9),
      px: sA * Math.PI * 2,          py: sB * Math.PI * 2,
      amp: 0.6 + sA * 0.4,
    })
  }
  const ampSum = modes.reduce((a, m) => a + m.amp, 0)

  const pts: number[] = []
  let threshold = 0.11

  while (pts.length < N * 3 && threshold < 0.8) {
    for (let i = 0; i < 600_000 && pts.length < N * 3; i++) {
      const x = (rng() * 2 - 1) * R
      const y = (rng() * 2 - 1) * R
      if (x * x + y * y > R * R) continue
      let E = 0
      for (const m of modes) E += m.amp * Math.sin(m.fx * x + m.px) * Math.sin(m.fy * y + m.py)
      if (Math.abs(E / ampSum) < threshold) pts.push(x, y, (rng() - 0.5) * 0.06)
    }
    threshold *= 1.4
  }

  while (pts.length < N * 3) pts.push((rng() - 0.5) * R * 2, (rng() - 0.5) * R * 2, 0)

  return new Float32Array(pts.slice(0, N * 3))
}

/**
 * Average multiple voice signature arrays into a single collective signature.
 * The result, when passed to buildChladniPositions, produces the collective pattern.
 */
export function averageSignatures(sigs: number[][]): number[] {
  if (sigs.length === 0) return Array(64).fill(0.5)
  const len = Math.max(...sigs.map(s => s.length))
  const avg = new Array(len).fill(0)
  for (const sig of sigs) {
    for (let i = 0; i < len; i++) avg[i] += (sig[i] ?? 0)
  }
  return avg.map(v => v / sigs.length)
}

/**
 * Evaluate the Chladni energy field on a 2-D raster grid.
 * Returns a flat Float32Array of `gridSize × gridSize` values in [0, 1],
 * where low values = nodal lines (bright), high values = antinodes (dark).
 * Used for fast 2D thumbnail rendering.
 */
export function buildChladniRaster(sig: number[], gridSize: number): Float32Array {
  const n = sig.length || 1
  const modes: Array<{ fx: number; fy: number; px: number; py: number; amp: number }> = []
  for (let k = 0; k < NUM_MODES; k++) {
    const binA = Math.floor((k / NUM_MODES) * n)
    const binB = Math.floor(((k + NUM_MODES * 0.5) / NUM_MODES) * n) % n
    const sA   = sig[binA] ?? 0.4
    const sB   = sig[binB] ?? 0.4
    const fBase = 1.8 + k * 0.9
    modes.push({
      fx: fBase * (0.55 + sA * 0.9), fy: fBase * (0.55 + sB * 0.9),
      px: sA * Math.PI * 2,          py: sB * Math.PI * 2,
      amp: 0.6 + sA * 0.4,
    })
  }
  const ampSum = modes.reduce((a, m) => a + m.amp, 0)
  const R = 2.3

  const out = new Float32Array(gridSize * gridSize)
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const x = ((col / (gridSize - 1)) * 2 - 1) * R
      const y = ((row / (gridSize - 1)) * 2 - 1) * R
      if (x * x + y * y > R * R) { out[row * gridSize + col] = -1; continue }
      let E = 0
      for (const m of modes) E += m.amp * Math.sin(m.fx * x + m.px) * Math.sin(m.fy * y + m.py)
      out[row * gridSize + col] = Math.abs(E / ampSum)
    }
  }
  return out
}
