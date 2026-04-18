"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

// ── Deep-navy background ──────────────────────────────────────────────────────
const BG = new THREE.Color("#0d1120")

const N_CORE  = 18_000
const N_SPRAY =  6_000
const GOLDEN  = Math.PI * (3 - Math.sqrt(5))

// ── Build two position buffers: random sphere + voice-shaped ──────────────────
// The vertex shader mixes between them via uMorph uniform (0→1)
// so the GPU handles the interpolation — no per-frame JS loops.
function buildCloud(data: number[]): {
  randomPos: Float32Array
  voicePos:  Float32Array
  sizes:     Float32Array
} {
  const n   = Math.max(data.length, 1)
  const tot = N_CORE + N_SPRAY
  const randomPos = new Float32Array(tot * 3)
  const voicePos  = new Float32Array(tot * 3)
  const sizes     = new Float32Array(tot)

  // Fibonacci sphere axes — one axis per frequency bin
  const axes: THREE.Vector3[] = []
  for (let k = 0; k < n; k++) {
    const phi = GOLDEN * k
    const y   = 1 - (k / (n - 1)) * 2
    const rxy = Math.sqrt(Math.max(0, 1 - y * y))
    axes.push(new THREE.Vector3(Math.cos(phi) * rxy, y, Math.sin(phi) * rxy))
  }

  // ── CORE ──────────────────────────────────────────────────────────────────
  for (let i = 0; i < N_CORE; i++) {
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random(), u4 = Math.random()
    const g1 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2)
    const g2 = Math.sqrt(-2 * Math.log(u3 + 1e-9)) * Math.cos(2 * Math.PI * u4)
    const g3 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.sin(2 * Math.PI * u2)

    const BASE = 2.4

    // Random: pure Gaussian sphere
    randomPos[i * 3]     = g1 * BASE
    randomPos[i * 3 + 1] = g2 * BASE
    randomPos[i * 3 + 2] = g3 * BASE

    // Voice: same base Gaussian + frequency-axis stretch
    const dir  = axes[i % n]
    const sig  = data[i % n] ?? 0.3
    const push = (sig - 0.3) * 1.8
    voicePos[i * 3]     = g1 * BASE + dir.x * push
    voicePos[i * 3 + 1] = g2 * BASE + dir.y * push
    voicePos[i * 3 + 2] = g3 * BASE + dir.z * push

    sizes[i] = Math.random() < 0.15
      ? 0.030 + Math.random() * 0.025
      : 0.008 + Math.random() * 0.014
  }

  // ── SPRAY — same position in both buffers (they don't morph) ──────────────
  for (let i = 0; i < N_SPRAY; i++) {
    const idx = N_CORE + i
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random(), u4 = Math.random()
    const g1 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2)
    const g2 = Math.sqrt(-2 * Math.log(u3 + 1e-9)) * Math.cos(2 * Math.PI * u4)
    const g3 = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.sin(2 * Math.PI * u2)

    randomPos[idx * 3]     = voicePos[idx * 3]     = g1 * 5.5
    randomPos[idx * 3 + 1] = voicePos[idx * 3 + 1] = g2 * 4.5
    randomPos[idx * 3 + 2] = voicePos[idx * 3 + 2] = g3 * 5.5

    sizes[idx] = 0.005 + Math.random() * 0.008
  }

  return { randomPos, voicePos, sizes }
}

// ── Three.js scene ────────────────────────────────────────────────────────────

function CloudScene({ data, mode }: { data: number[]; mode: "forming" | "formed" }) {
  const pointsRef = useRef<THREE.Points>(null!)
  const startRef  = useRef<number | null>(null)

  const { geometry, material } = useMemo(() => {
    const { randomPos, voicePos, sizes } = buildCloud(data)

    const geo = new THREE.BufferGeometry()
    // `position` satisfies Three.js bounding calculations (set to randomPos)
    geo.setAttribute("position",   new THREE.BufferAttribute(randomPos.slice(), 3))
    geo.setAttribute("aRandomPos", new THREE.BufferAttribute(randomPos, 3))
    geo.setAttribute("aVoicePos",  new THREE.BufferAttribute(voicePos,  3))
    geo.setAttribute("size",       new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: mode === "formed" ? 1.0 : 0.0 },
        uMorph:   { value: mode === "formed" ? 1.0 : 0.0 },
        uColor:   { value: new THREE.Color(0xeef2ff) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  aRandomPos;
        attribute vec3  aVoicePos;
        uniform float   uOpacity;
        uniform float   uMorph;
        varying float   vAlpha;
        void main() {
          // GPU-side lerp between random sphere and voice-shaped form
          vec3 pos = mix(aRandomPos, aVoicePos, uMorph);
          vec4 mv  = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (500.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
          float depth = clamp((-mv.z - 1.0) / 12.0, 0.0, 1.0);
          vAlpha = uOpacity * (0.55 + (1.0 - depth) * 0.45);
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        varying float vAlpha;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.25, 0.5, dist)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    return { geometry: geo, material: mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useFrame(({ clock, gl }) => {
    if (!pointsRef.current) return
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    if (mode === "forming") {
      // Fade in over 1.5s
      material.uniforms.uOpacity.value = Math.min(elapsed / 1.5, 1.0)

      // Morph random → voice over 3.5s with ease-in-out quad
      const t = Math.min(elapsed / 3.5, 1.0)
      material.uniforms.uMorph.value = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2
    } else {
      material.uniforms.uOpacity.value = 1.0
      material.uniforms.uMorph.value   = 1.0
    }

    // Slow drift — cloud breathes and rotates
    pointsRef.current.rotation.y =  elapsed * 0.035
    pointsRef.current.rotation.x =  Math.sin(elapsed * 0.020) * 0.12
    pointsRef.current.rotation.z =  Math.cos(elapsed * 0.015) * 0.05
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

// ── Canvas export ─────────────────────────────────────────────────────────────

export function VoicePointCloud({
  data,
  mode = "formed",
}: {
  data:  number[]
  mode?: "forming" | "formed"
}) {
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
      <CloudScene data={data} mode={mode} />
    </Canvas>
  )
}
