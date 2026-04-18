"use client"

/**
 * VoiceCanvasUnified — one persistent Three.js canvas that morphs through three phases:
 *   Phase 1 (wonder / reading): calm dim cloud, barely drifting — user reads the analysis text
 *   Phase 2 (wonder / active):  cloud brightens and morphs random → voice-shaped form
 *   Phase 3 (transmitting):     cloud holds voice shape, slow drift
 *   Phase 4 (imprint):          cloud → Chladni nodal-line pattern
 *
 * Color scheme: particles are tinted by their spectral band
 *   Low freq  → warm amber  #e8a87c
 *   Mid freq  → teal        #7dd4c0
 *   High freq → soft violet #c4a8e8
 * All three crystallise to cool blue-white as the imprint morph completes.
 */

import { useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

// ── Constants ─────────────────────────────────────────────────────────────────

const BG     = new THREE.Color("#0d1120")
const N      = 20_000
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export type CanvasPhase = "wonder" | "transmitting" | "imprint"

/** Seconds from canvas mount at which the calm reading phase ends and morphA begins */
export const READING_END    = 5.5
/** Duration of the random→voice morph */
const MORPH_A_DUR  = 3.5
/** Seconds from mount at which morphA is complete — imprint can safely be triggered after this */
export const MORPH_A_DONE_AT = READING_END + MORPH_A_DUR   // 9.0 s
/** Duration of the voice→imprint morph */
const MORPH_B_DUR  = 4.5

// Band colors
const C_AMP     = new THREE.Color("#e8a87c")  // warm amber  — amplitude / low
const C_PITCH   = new THREE.Color("#7dd4c0")  // teal        — pitch / mid
const C_TIMBRE  = new THREE.Color("#c4a8e8")  // soft violet — timbre / high
const C_IMPRINT = new THREE.Color("#dde6ff")  // cool blue-white — crystallised

// ── Position builders ─────────────────────────────────────────────────────────

function buildRandom(): Float32Array {
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random(), u4 = Math.random()
    const g1 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2)
    const g2 = Math.sqrt(-2 * Math.log(u3 + 1e-9)) * Math.cos(2 * Math.PI * u4)
    const g3 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.sin(2 * Math.PI * u2)
    pos[i * 3]     = g1 * 2.4
    pos[i * 3 + 1] = g2 * 2.4
    pos[i * 3 + 2] = g3 * 2.4
  }
  return pos
}

function buildVoice(data: number[]): Float32Array {
  const n   = Math.max(data.length, 1)
  const pos = new Float32Array(N * 3)
  const axes: THREE.Vector3[] = []
  for (let k = 0; k < n; k++) {
    const phi = GOLDEN * k
    const y   = 1 - (k / Math.max(n - 1, 1)) * 2
    const rxy = Math.sqrt(Math.max(0, 1 - y * y))
    axes.push(new THREE.Vector3(Math.cos(phi) * rxy, y, Math.sin(phi) * rxy))
  }
  for (let i = 0; i < N; i++) {
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random(), u4 = Math.random()
    const g1 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2)
    const g2 = Math.sqrt(-2 * Math.log(u3 + 1e-9)) * Math.cos(2 * Math.PI * u4)
    const g3 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.sin(2 * Math.PI * u2)
    const dir  = axes[i % n]
    const sig  = data[i % n] ?? 0.3
    const push = (sig - 0.3) * 1.8
    pos[i * 3]     = g1 * 2.4 + dir.x * push
    pos[i * 3 + 1] = g2 * 2.4 + dir.y * push
    pos[i * 3 + 2] = g3 * 2.4 + dir.z * push
  }
  return pos
}

const NUM_MODES = 10

function makeRng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

export function buildImprintPositions(sig: number[]): Float32Array {
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

  // R=1.5 keeps the pattern comfortably inside portrait viewports (camera fov=60 z=7)
  const DISPLAY_R = 1.5

  const pts: number[] = []
  let threshold = 0.11

  while (pts.length < N * 3 && threshold < 0.8) {
    for (let i = 0; i < 600_000 && pts.length < N * 3; i++) {
      const x = (rng() * 2 - 1) * DISPLAY_R
      const y = (rng() * 2 - 1) * DISPLAY_R
      if (x * x + y * y > DISPLAY_R * DISPLAY_R) continue
      let E = 0
      for (const m of modes) E += m.amp * Math.sin(m.fx * x + m.px) * Math.sin(m.fy * y + m.py)
      if (Math.abs(E / ampSum) < threshold) pts.push(x, y, (rng() - 0.5) * 0.06)
    }
    threshold *= 1.4
  }

  while (pts.length < N * 3) pts.push((rng() - 0.5) * DISPLAY_R * 2, (rng() - 0.5) * DISPLAY_R * 2, 0)

  return new Float32Array(pts.slice(0, N * 3))
}

// ── Three.js scene ────────────────────────────────────────────────────────────

interface UnifiedSceneProps {
  waveformPeaks:   number[]
  signaturePoints: number[] | null
  phase:           CanvasPhase
}

function UnifiedScene({ waveformPeaks, signaturePoints, phase }: UnifiedSceneProps) {
  const pointsRef       = useRef<THREE.Points>(null!)
  const startRef        = useRef<number | null>(null)
  const phaseRef        = useRef(phase)
  phaseRef.current      = phase
  const morphARef       = useRef(0)
  const morphBRef       = useRef(0)
  const morphBStartRef  = useRef<number | null>(null)
  const imprintReadyRef = useRef(false)

  const { geometry, material } = useMemo(() => {
    const n = Math.max(waveformPeaks.length, 1)

    // Continuous spectral band: 0.0 (bass/amber) → 1.0 (high/violet)
    const bands = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      bands[i] = (i % n) / Math.max(n - 1, 1)
    }

    const randomPos = buildRandom()
    const voicePos  = buildVoice(waveformPeaks)
    const sizes     = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      sizes[i] = Math.random() < 0.12
        ? 0.028 + Math.random() * 0.020
        : 0.007 + Math.random() * 0.013
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position",    new THREE.BufferAttribute(randomPos.slice(), 3))
    geo.setAttribute("aRandomPos",  new THREE.BufferAttribute(randomPos, 3))
    geo.setAttribute("aVoicePos",   new THREE.BufferAttribute(voicePos, 3))
    geo.setAttribute("aImprintPos", new THREE.BufferAttribute(voicePos.slice(), 3))
    geo.setAttribute("size",        new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aColorBand",  new THREE.BufferAttribute(bands, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity:      { value: 0.0 },
        uMorphA:       { value: 0.0 },
        uMorphB:       { value: 0.0 },
        uColorAmp:     { value: C_AMP },
        uColorPitch:   { value: C_PITCH },
        uColorTimbre:  { value: C_TIMBRE },
        uColorImprint: { value: C_IMPRINT },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  aRandomPos;
        attribute vec3  aVoicePos;
        attribute vec3  aImprintPos;
        attribute float aColorBand;
        uniform float   uOpacity;
        uniform float   uMorphA;
        uniform float   uMorphB;
        varying float   vAlpha;
        varying float   vBand;
        void main() {
          vec3 voiced = mix(aRandomPos, aVoicePos, uMorphA);
          vec3 pos    = mix(voiced, aImprintPos, uMorphB);
          vec4 mv     = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (500.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
          float depth  = clamp((-mv.z - 1.0) / 12.0, 0.0, 1.0);
          vAlpha = uOpacity * (0.55 + (1.0 - depth) * 0.45);
          vBand  = aColorBand;
        }
      `,
      fragmentShader: `
        uniform vec3  uColorAmp;
        uniform vec3  uColorPitch;
        uniform vec3  uColorTimbre;
        uniform vec3  uColorImprint;
        uniform float uMorphB;
        varying float vAlpha;
        varying float vBand;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.25, 0.5, dist)) * vAlpha;
          // Spectral 3-way blend: amber → teal → violet
          vec3 voiceCol = mix(uColorAmp,   uColorPitch,  smoothstep(0.0, 0.5, vBand));
          voiceCol      = mix(voiceCol,    uColorTimbre, smoothstep(0.5, 1.0, vBand));
          // Crystallise to cool blue-white as imprint forms
          vec3 col = mix(voiceCol, uColorImprint, uMorphB);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })

    return { geometry: geo, material: mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveformPeaks])

  // Async imprint build — defer off rAF to avoid frame drops
  useEffect(() => {
    if (!signaturePoints || imprintReadyRef.current) return
    imprintReadyRef.current = true
    setTimeout(() => {
      const imprintPos = buildImprintPositions(signaturePoints)
      const attr = geometry.attributes.aImprintPos as THREE.BufferAttribute
      attr.array.set(imprintPos)
      attr.needsUpdate = true
    }, 0)
  }, [signaturePoints, geometry])

  // Reset morphB start when imprint phase begins
  useEffect(() => {
    if (phase === "imprint") morphBStartRef.current = null
  }, [phase])

  useFrame(({ clock, gl }) => {
    if (!pointsRef.current) return
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    // ── Opacity ──────────────────────────────────────────────────────────────
    // Reading phase (0 → READING_END): fade in softly to 0.28
    // Active phase  (READING_END+):   ramp from 0.28 → 1.0 over 2s
    if (elapsed < READING_END) {
      material.uniforms.uOpacity.value = Math.min(elapsed / 2.0, 0.28)
    } else {
      const t = Math.min((elapsed - READING_END) / 2.0, 1.0)
      material.uniforms.uOpacity.value = 0.28 + t * 0.72
    }

    // ── MorphA: random → voice (starts at READING_END) ───────────────────────
    if (elapsed > READING_END && morphARef.current < 1) {
      const t = Math.min((elapsed - READING_END) / MORPH_A_DUR, 1.0)
      morphARef.current = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      material.uniforms.uMorphA.value = morphARef.current
    }

    // ── MorphB: voice → imprint ───────────────────────────────────────────────
    if (phaseRef.current === "imprint") {
      if (morphBStartRef.current === null) morphBStartRef.current = clock.getElapsedTime()
      const t = Math.min((clock.getElapsedTime() - morphBStartRef.current) / MORPH_B_DUR, 1.0)
      morphBRef.current = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      material.uniforms.uMorphB.value = morphBRef.current
    }

    // ── Rotation ─────────────────────────────────────────────────────────────
    const inImprint = morphBRef.current > 0.85
    if (inImprint) {
      // Chladni plate: barely tilts
      pointsRef.current.rotation.x = Math.sin(elapsed * 0.012) * 0.05
      pointsRef.current.rotation.y = Math.cos(elapsed * 0.008) * 0.04
      pointsRef.current.rotation.z = 0
    } else if (elapsed < READING_END) {
      // Reading phase: very slow meditative drift
      pointsRef.current.rotation.y = elapsed * 0.008
      pointsRef.current.rotation.x = Math.sin(elapsed * 0.005) * 0.03
      pointsRef.current.rotation.z = Math.cos(elapsed * 0.004) * 0.01
    } else {
      // Active phase: cloud comes alive
      pointsRef.current.rotation.y =  elapsed * 0.035
      pointsRef.current.rotation.x =  Math.sin(elapsed * 0.020) * 0.12
      pointsRef.current.rotation.z =  Math.cos(elapsed * 0.015) * 0.05
    }
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

// ── Canvas export ─────────────────────────────────────────────────────────────

export function VoiceCanvasUnified({
  waveformPeaks,
  signaturePoints,
  phase,
}: {
  waveformPeaks:   number[]
  signaturePoints: number[] | null
  phase:           CanvasPhase
}) {
  return (
    <Canvas
      camera={{ fov: 60, position: [0, 0, 7] }}
      style={{ position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none", background: "#0d1120" }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onCreated={({ gl }) => gl.setClearColor(BG, 1)}
    >
      <UnifiedScene
        waveformPeaks={waveformPeaks}
        signaturePoints={signaturePoints}
        phase={phase}
      />
    </Canvas>
  )
}
