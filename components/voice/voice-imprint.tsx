"use client"

/**
 * VoiceImprint — cymatics-inspired "sand on a vibrating plate" pattern.
 *
 * Sand settles on the NODAL LINES of standing waves — the places where
 * destructive interference keeps the surface still. Two voices produce
 * two completely different patterns because their frequency compositions
 * create different interference geometries.
 *
 * Algorithm:
 *   1. Derive 10 standing-wave modes from the voice's signaturePoints.
 *   2. For each candidate point (x, y) on a circular plate, evaluate the
 *      total displacement E(x,y) = Σ sin(fx·x + φ) · sin(fy·y + ψ).
 *   3. Keep points where |E| is near zero — those are the nodal lines.
 *   4. Render as a still, softly lit Three.js point cloud.
 */

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

const BG = new THREE.Color("#0d1120")

// ── Seeded LCG RNG — ensures same voice → same pattern every time ─────────────
function makeRng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

// ── Chladni pattern generation ────────────────────────────────────────────────

const NUM_MODES  = 10   // standing-wave modes
const MAX_PTS    = 20_000
const CANDIDATES = 280_000
const RADIUS     = 2.3  // scene units — fills ~70% of screen at fov60, z=7

function buildImprint(sig: number[]): Float32Array {
  const n   = sig.length || 1
  const rng = makeRng(sig.reduce((a, v, i) => a + v * (i + 1), 0))

  // ── Derive wave modes from the voice signature ────────────────────────────
  // Each mode: two perpendicular standing waves whose frequencies are driven
  // by different spectral bands.  We spread the bins evenly across the spectrum.
  const modes: Array<{ fx: number; fy: number; px: number; py: number; amp: number }> = []
  for (let k = 0; k < NUM_MODES; k++) {
    const binA = Math.floor((k / NUM_MODES) * n)
    const binB = Math.floor(((k + NUM_MODES * 0.5) / NUM_MODES) * n) % n
    const sA   = sig[binA] ?? 0.4
    const sB   = sig[binB] ?? 0.4

    // Scale to a range that produces visible patterns on the plate.
    // Lower modes (small k) → low frequencies → broad shapes.
    // Higher modes → fine detail.
    const fBase = 1.8 + k * 0.9
    modes.push({
      fx:  fBase * (0.55 + sA * 0.9),
      fy:  fBase * (0.55 + sB * 0.9),
      px:  sA * Math.PI * 2,
      py:  sB * Math.PI * 2,
      amp: 0.6 + sA * 0.4,
    })
  }

  // Total amplitude sum — for normalisation
  const ampSum = modes.reduce((a, m) => a + m.amp, 0)

  // ── Adaptive threshold ────────────────────────────────────────────────────
  // A tighter threshold → finer lines; looser → thicker bands.
  const THRESHOLD = 0.11

  // ── Rejection-sample the nodal lines ──────────────────────────────────────
  const pts: number[] = []

  for (let i = 0; i < CANDIDATES; i++) {
    if (pts.length >= MAX_PTS * 3) break

    // Uniform sample inside bounding box
    const x = (rng() * 2 - 1) * RADIUS
    const y = (rng() * 2 - 1) * RADIUS

    // Clip to circular plate
    if (x * x + y * y > RADIUS * RADIUS) continue

    // Evaluate standing-wave superposition
    let E = 0
    for (const m of modes) {
      E += m.amp * Math.sin(m.fx * x + m.px) * Math.sin(m.fy * y + m.py)
    }
    E /= ampSum

    if (Math.abs(E) < THRESHOLD) {
      // Very slight Z scatter so points have depth without looking 3-D
      const z = (rng() - 0.5) * 0.06
      pts.push(x, y, z)
    }
  }

  return new Float32Array(pts)
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function ImprintScene({ sig }: { sig: number[] }) {
  const pointsRef = useRef<THREE.Points>(null!)
  const startRef  = useRef<number | null>(null)
  const opRef     = useRef(0)

  const { geometry, material } = useMemo(() => {
    const positions = buildImprint(sig)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0 },
        uColor:   { value: new THREE.Color(0xdde6ff) },   // cool white, slightly blue
      },
      vertexShader: `
        uniform float uOpacity;
        varying  float vAlpha;
        void main() {
          gl_PointSize = 1.8;
          gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vAlpha = uOpacity;
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        varying float vAlpha;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float a = (1.0 - smoothstep(0.2, 0.5, dist)) * vAlpha;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    })

    return { geometry: geo, material: mat }
  }, [sig])

  useFrame(({ clock, gl }) => {
    if (!pointsRef.current) return
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    // Slow fade-in — sand settling takes time
    const target = Math.min(elapsed / 4.0, 1.0) * 0.78
    opRef.current += (target - opRef.current) * 0.04
    material.uniforms.uOpacity.value = opRef.current

    // The plate breathes: barely perceptible slow tilt, no spinning
    pointsRef.current.rotation.x = Math.sin(elapsed * 0.012) * 0.05
    pointsRef.current.rotation.y = Math.cos(elapsed * 0.008) * 0.04
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

// ── Canvas export ─────────────────────────────────────────────────────────────

export function VoiceImprint({ signaturePoints }: { signaturePoints: number[] }) {
  return (
    <Canvas
      camera={{ fov: 60, position: [0, 0, 7] }}
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        3,
        pointerEvents: "none",
        background:    "#0d1120",
      }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onCreated={({ gl }) => gl.setClearColor(BG, 1)}
    >
      <ImprintScene sig={signaturePoints} />
    </Canvas>
  )
}
