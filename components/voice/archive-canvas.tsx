"use client"

/**
 * ArchiveCanvas — collective Chladni point-cloud.
 *
 * Arrival story: particles start scattered (echoing the wonder/transmitting phase)
 * and slowly condense into the collective formation over ~7 seconds — your voice
 * finding its place inside the vessel.
 */

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { buildChladniPositions } from "@/lib/chladni"

const BG = new THREE.Color("#0d1120")
const N  = 20_000

// How long (seconds) the settling animation runs
const SETTLE_DURATION = 7.0
// How long the gentle fade-in of opacity takes
const FADE_DURATION   = 2.5

function CollectiveScene({ signaturePoints }: { signaturePoints: number[] }) {
  const pointsRef = useRef<THREE.Points>(null!)
  const startRef  = useRef<number | null>(null)

  const { geometry, material } = useMemo(() => {
    const pos    = buildChladniPositions(signaturePoints, N)
    const sizes  = new Float32Array(N)
    const phases = new Float32Array(N)
    // Per-particle scatter offset — starts displaced, converges to zero
    const offsets = new Float32Array(N * 3)

    for (let i = 0; i < N; i++) {
      sizes[i]  = Math.random() < 0.10
        ? 0.022 + Math.random() * 0.016
        : 0.005 + Math.random() * 0.010
      phases[i] = Math.random() * Math.PI * 2

      // Random scatter in x/y/z — particles arrive "from outside"
      const angle  = Math.random() * Math.PI * 2
      const radius = 1.5 + Math.random() * 2.5   // 1.5–4 units away
      offsets[i * 3 + 0] = Math.cos(angle) * radius
      offsets[i * 3 + 1] = Math.sin(angle) * radius
      offsets[i * 3 + 2] = (Math.random() - 0.5) * 3.0  // depth scatter
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aPhase",   new THREE.BufferAttribute(phases, 1))
    geo.setAttribute("aOffset",  new THREE.BufferAttribute(offsets, 3))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.0 },
        uTime:    { value: 0.0 },
        uSettle:  { value: 0.0 },   // 0 = scattered, 1 = in formation
        uColor:   { value: new THREE.Color("#edf4ff") },
      },
      vertexShader: `
        attribute float size;
        attribute float aPhase;
        attribute vec3  aOffset;
        uniform float   uOpacity;
        uniform float   uTime;
        uniform float   uSettle;
        varying float   vAlpha;

        // Smooth ease-out curve
        float easeOut(float t) {
          return 1.0 - pow(1.0 - t, 3.0);
        }

        void main() {
          float settled = easeOut(uSettle);

          // Particles drift from scattered offset to their true formation position
          vec3 pos = position + aOffset * (1.0 - settled);

          // Subtle per-particle breathing only once mostly settled
          float breathAmt = 0.12 * settled;
          float breath = 1.0 + breathAmt * sin(uTime * 0.72 + aPhase);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * breath * (500.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;

          float depth = clamp((-mv.z - 1.0) / 12.0, 0.0, 1.0);
          vAlpha = uOpacity * (0.52 + (1.0 - depth) * 0.48);
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        varying float vAlpha;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.22, 0.5, dist)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    return { geometry: geo, material: mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePoints])

  useFrame(({ clock, gl }) => {
    if (!pointsRef.current) return
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    // Opacity fades in early, reaching max around FADE_DURATION
    material.uniforms.uOpacity.value = Math.min(elapsed / FADE_DURATION, 0.9)

    // Settle drives the scatter→formation convergence
    material.uniforms.uSettle.value  = Math.min(elapsed / SETTLE_DURATION, 1.0)
    material.uniforms.uTime.value    = clock.getElapsedTime()

    // Rotation: slightly more active while particles are arriving, slows as they settle
    const settleProgress = Math.min(elapsed / SETTLE_DURATION, 1.0)
    const rotationScale  = 1.0 + (1.0 - settleProgress) * 1.2  // faster during scatter

    pointsRef.current.rotation.x = Math.sin(elapsed * 0.011 * rotationScale) * 0.10
    pointsRef.current.rotation.y = elapsed * 0.006 * rotationScale + Math.sin(elapsed * 0.017) * 0.04
    pointsRef.current.rotation.z = Math.cos(elapsed * 0.008 * rotationScale) * 0.06
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

export function ArchiveCanvas({
  signaturePoints,
}: {
  signaturePoints: number[]
}) {
  const key = signaturePoints.slice(0, 4).map(v => v.toFixed(3)).join(",")

  return (
    <Canvas
      key={key}
      camera={{ fov: 55, position: [0, 0, 6.5] }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onCreated={({ gl }) => gl.setClearColor(BG, 1)}
    >
      <CollectiveScene signaturePoints={signaturePoints} />
    </Canvas>
  )
}
