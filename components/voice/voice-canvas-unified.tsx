"use client"

/**
 * VoiceCanvasUnified — one persistent Three.js canvas that morphs through three phases:
 *   Phase 1 (wonder / reading): calm dim cloud, barely drifting — user reads the analysis text
 *   Phase 2 (wonder / active):  cloud brightens and morphs random → voice-shaped form
 *   Phase 3 (transmitting):     cloud holds voice shape, slow drift
 *   Phase 4 (imprint):          cloud → Chladni nodal-line pattern
 *
 * Interaction:
 *   Gyroscope  → smooth additive tilt of the cloud (iOS permission requested on first touch)
 *   Touch/drag → per-particle repulsion in world-space; particles flee the finger
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

// Particle colors — warm silver in cloud, crystalline blue-white at imprint
const C_BASE    = new THREE.Color("#c8d8ee")  // warm silver — cloud phase
const C_IMPRINT = new THREE.Color("#edf4ff")  // cool crystal — imprint phase

// ── Interaction state (per-canvas, passed via refs) ───────────────────────────

interface GyroState  { beta: number; gamma: number; active: boolean }
interface TouchState { ndcX: number; ndcY: number; active: boolean }

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
  gyroRef:         React.RefObject<GyroState>
  touchRef:        React.RefObject<TouchState>
}

function UnifiedScene({ waveformPeaks, signaturePoints, phase, gyroRef, touchRef }: UnifiedSceneProps) {
  const pointsRef       = useRef<THREE.Points>(null!)
  const startRef        = useRef<number | null>(null)
  const phaseRef        = useRef(phase)
  phaseRef.current      = phase
  const morphARef       = useRef(0)
  const morphBRef       = useRef(0)
  const morphBStartRef  = useRef<number | null>(null)
  const imprintReadyRef = useRef(false)

  // Smoothed interaction state
  const tiltXRef        = useRef(0)
  const tiltYRef        = useRef(0)
  const repulseActiveRef = useRef(0)

  const { geometry, material } = useMemo(() => {
    const randomPos = buildRandom()
    const voicePos  = buildVoice(waveformPeaks)

    const sizes  = new Float32Array(N)
    const phases = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      sizes[i]  = Math.random() < 0.12
        ? 0.026 + Math.random() * 0.018
        : 0.006 + Math.random() * 0.012
      phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position",    new THREE.BufferAttribute(randomPos.slice(), 3))
    geo.setAttribute("aRandomPos",  new THREE.BufferAttribute(randomPos, 3))
    geo.setAttribute("aVoicePos",   new THREE.BufferAttribute(voicePos, 3))
    geo.setAttribute("aImprintPos", new THREE.BufferAttribute(voicePos.slice(), 3))
    geo.setAttribute("size",        new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aPhase",      new THREE.BufferAttribute(phases, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity:        { value: 0.0 },
        uMorphA:         { value: 0.0 },
        uMorphB:         { value: 0.0 },
        uTime:           { value: 0.0 },
        uColorBase:      { value: C_BASE },
        uColorImprint:   { value: C_IMPRINT },
        // Touch repulsion
        uRepulsePos:     { value: new THREE.Vector2(0, 0) },
        uRepulseRadius:  { value: 1.8 },
        uRepulseStrength:{ value: 0.7 },
        uRepulseActive:  { value: 0.0 },
      },
      vertexShader: `
        attribute float size;
        attribute float aPhase;
        attribute vec3  aRandomPos;
        attribute vec3  aVoicePos;
        attribute vec3  aImprintPos;
        uniform float   uOpacity;
        uniform float   uMorphA;
        uniform float   uMorphB;
        uniform float   uTime;
        uniform vec2    uRepulsePos;
        uniform float   uRepulseRadius;
        uniform float   uRepulseStrength;
        uniform float   uRepulseActive;
        varying float   vAlpha;
        varying float   vBreath;

        float hash(float n) { return fract(sin(n) * 43758.5453); }

        void main() {
          // ── Morphed position ──────────────────────────────────────────────
          vec3 voiced = mix(aRandomPos, aVoicePos, uMorphA);
          vec3 pos    = mix(voiced, aImprintPos, uMorphB);

          // ── Organic turbulence — fades out at imprint ─────────────────────
          float turbScale = 1.0 - smoothstep(0.4, 0.9, uMorphB);
          float t1 = uTime * 0.38 + aPhase;
          float t2 = uTime * 0.27 + aPhase * 1.3;
          float t3 = uTime * 0.19 + aPhase * 0.7;
          pos.x += sin(t1) * 0.018 * turbScale;
          pos.y += cos(t2) * 0.018 * turbScale;
          pos.z += sin(t3) * 0.012 * turbScale;

          // ── Touch repulsion — push particles away from finger ────────────
          // uRepulsePos is NDC (-1..1); approximate world-space at z=0 (cam z=7, fov=60)
          // tan(30°)*7 ≈ 4.04 half-height in world units
          vec3 repulseWorld = vec3(uRepulsePos.x * 4.04, uRepulsePos.y * 4.04, 0.0);
          vec3 toParticle   = pos - repulseWorld;
          float repDist     = length(toParticle);
          if (repDist < uRepulseRadius && uRepulseActive > 0.001) {
            float t      = 1.0 - repDist / uRepulseRadius;
            float force  = t * t * uRepulseStrength * uRepulseActive;
            pos += normalize(toParticle + vec3(0.0001)) * force;
          }

          // ── Breathing size ─────────────────────────────────────────────────
          float breathAmt  = mix(0.38, 0.10, smoothstep(0.5, 1.0, uMorphB));
          float breathFreq = mix(1.55, 0.60, smoothstep(0.5, 1.0, uMorphB));
          float breath     = 1.0 + breathAmt * sin(uTime * breathFreq + aPhase);
          vBreath = breath;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * breath * (500.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;

          float depth = clamp((-mv.z - 1.0) / 12.0, 0.0, 1.0);
          vAlpha = uOpacity * (0.52 + (1.0 - depth) * 0.48);
        }
      `,
      fragmentShader: `
        uniform vec3  uColorBase;
        uniform vec3  uColorImprint;
        uniform float uMorphB;
        varying float vAlpha;
        varying float vBreath;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float edge  = mix(0.28, 0.22, smoothstep(0.5, 1.0, uMorphB));
          float alpha = (1.0 - smoothstep(edge, 0.5, dist)) * vAlpha;
          vec3 col = mix(uColorBase, uColorImprint, smoothstep(0.55, 1.0, uMorphB));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })

    return { geometry: geo, material: mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveformPeaks])

  // Async imprint build
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

  useEffect(() => {
    if (phase === "imprint") morphBStartRef.current = null
  }, [phase])

  useFrame(({ clock, gl }) => {
    if (!pointsRef.current) return
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)
    material.uniforms.uTime.value = clock.getElapsedTime()

    // ── Opacity ──────────────────────────────────────────────────────────────
    if (elapsed < READING_END) {
      material.uniforms.uOpacity.value = Math.min(elapsed / 2.0, 0.28)
    } else {
      const t = Math.min((elapsed - READING_END) / 2.0, 1.0)
      material.uniforms.uOpacity.value = 0.28 + t * 0.72
    }

    // ── MorphA: random → voice ────────────────────────────────────────────────
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

    // ── Base rotation ─────────────────────────────────────────────────────────
    const inImprint = morphBRef.current > 0.85
    let baseRX: number, baseRY: number, baseRZ: number

    if (inImprint) {
      baseRX = Math.sin(elapsed * 0.012) * 0.05
      baseRY = Math.cos(elapsed * 0.008) * 0.04
      baseRZ = 0
    } else if (elapsed < READING_END) {
      baseRX = Math.sin(elapsed * 0.005) * 0.03
      baseRY = elapsed * 0.008
      baseRZ = Math.cos(elapsed * 0.004) * 0.01
    } else {
      baseRX = Math.sin(elapsed * 0.020) * 0.12
      baseRY = elapsed * 0.035
      baseRZ = Math.cos(elapsed * 0.015) * 0.05
    }

    // ── Gyroscope tilt — additive, smoothed ──────────────────────────────────
    // beta  = front/back tilt (-90 to 90°), gamma = left/right tilt (-90 to 90°)
    const gyro = gyroRef.current
    const targetTiltX = gyro.active ? gyro.beta  * 0.003 : 0  // ~0.27 rad max
    const targetTiltY = gyro.active ? gyro.gamma * 0.004 : 0  // ~0.36 rad max
    tiltXRef.current = THREE.MathUtils.lerp(tiltXRef.current, targetTiltX, 0.04)
    tiltYRef.current = THREE.MathUtils.lerp(tiltYRef.current, targetTiltY, 0.04)

    pointsRef.current.rotation.x = baseRX + tiltXRef.current
    pointsRef.current.rotation.y = baseRY + tiltYRef.current
    pointsRef.current.rotation.z = baseRZ

    // ── Touch repulsion uniforms ──────────────────────────────────────────────
    const touch = touchRef.current
    repulseActiveRef.current = THREE.MathUtils.lerp(
      repulseActiveRef.current,
      touch.active ? 1.0 : 0.0,
      0.14
    )
    material.uniforms.uRepulsePos.value.set(touch.ndcX, touch.ndcY)
    material.uniforms.uRepulseActive.value = repulseActiveRef.current
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
  const gyroRef  = useRef<GyroState>({ beta: 0, gamma: 0, active: false })
  const touchRef = useRef<TouchState>({ ndcX: 0, ndcY: 0, active: false })
  const gyroPermRef = useRef(false)

  useEffect(() => {
    // ── Gyroscope ─────────────────────────────────────────────────────────────
    function onOrientation(e: DeviceOrientationEvent) {
      gyroRef.current.beta   = e.beta  ?? 0
      gyroRef.current.gamma  = e.gamma ?? 0
      gyroRef.current.active = true
    }

    async function requestGyro() {
      if (gyroPermRef.current) return
      gyroPermRef.current = true
      // iOS 13+ requires explicit permission
      const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DOE.requestPermission === "function") {
        try {
          const perm = await DOE.requestPermission()
          if (perm === "granted") window.addEventListener("deviceorientation", onOrientation)
        } catch { /* permission denied or unavailable */ }
      } else {
        // Android / desktop — no permission needed
        window.addEventListener("deviceorientation", onOrientation)
      }
    }

    // Try adding listener immediately (works on Android / desktop)
    window.addEventListener("deviceorientation", onOrientation)

    // ── Touch repulsion ───────────────────────────────────────────────────────
    function updateTouch(clientX: number, clientY: number) {
      touchRef.current.ndcX = (clientX / window.innerWidth)  * 2 - 1
      touchRef.current.ndcY = -((clientY / window.innerHeight) * 2 - 1)
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      updateTouch(t.clientX, t.clientY)
      touchRef.current.active = true
      requestGyro()  // piggyback iOS permission on first touch gesture
    }
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0]
      updateTouch(t.clientX, t.clientY)
    }
    function onTouchEnd() {
      touchRef.current.active = false
    }

    // Desktop: click-drag to push
    function onMouseDown(e: MouseEvent) {
      updateTouch(e.clientX, e.clientY)
      touchRef.current.active = true
    }
    function onMouseMove(e: MouseEvent) {
      if (!touchRef.current.active) return
      updateTouch(e.clientX, e.clientY)
    }
    function onMouseUp() {
      touchRef.current.active = false
    }

    window.addEventListener("touchstart",  onTouchStart,  { passive: true })
    window.addEventListener("touchmove",   onTouchMove,   { passive: true })
    window.addEventListener("touchend",    onTouchEnd)
    window.addEventListener("mousedown",   onMouseDown)
    window.addEventListener("mousemove",   onMouseMove)
    window.addEventListener("mouseup",     onMouseUp)

    return () => {
      window.removeEventListener("deviceorientation", onOrientation)
      window.removeEventListener("touchstart",  onTouchStart)
      window.removeEventListener("touchmove",   onTouchMove)
      window.removeEventListener("touchend",    onTouchEnd)
      window.removeEventListener("mousedown",   onMouseDown)
      window.removeEventListener("mousemove",   onMouseMove)
      window.removeEventListener("mouseup",     onMouseUp)
    }
  }, [])

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
        gyroRef={gyroRef}
        touchRef={touchRef}
      />
    </Canvas>
  )
}
