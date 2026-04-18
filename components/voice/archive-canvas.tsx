"use client"

/**
 * ArchiveCanvas — Three.js point-cloud canvas for the collective Chladni pattern.
 * Unlike VoiceCanvasUnified, this has no morphing — it starts directly
 * in the crystallised imprint state and drifts very slowly like a suspended plate.
 */

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { buildChladniPositions } from "@/lib/chladni"

const BG = new THREE.Color("#0d1120")
const N  = 20_000

function CollectiveScene({ signaturePoints }: { signaturePoints: number[] }) {
  const pointsRef = useRef<THREE.Points>(null!)
  const startRef  = useRef<number | null>(null)

  const { geometry, material } = useMemo(() => {
    const pos    = buildChladniPositions(signaturePoints, N)
    const sizes  = new Float32Array(N)
    const phases = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      sizes[i]  = Math.random() < 0.10
        ? 0.022 + Math.random() * 0.016
        : 0.005 + Math.random() * 0.010
      phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aPhase",   new THREE.BufferAttribute(phases, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.0 },
        uTime:    { value: 0.0 },
        uColor:   { value: new THREE.Color("#edf4ff") },
      },
      vertexShader: `
        attribute float size;
        attribute float aPhase;
        uniform float   uOpacity;
        uniform float   uTime;
        varying float   vAlpha;
        void main() {
          // Subtle per-particle breathing — crispness of a settled plate
          float breath = 1.0 + 0.12 * sin(uTime * 0.72 + aPhase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * breath * (500.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
          float depth  = clamp((-mv.z - 1.0) / 12.0, 0.0, 1.0);
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

    material.uniforms.uOpacity.value = Math.min(elapsed / 2.5, 0.9)
    material.uniforms.uTime.value    = clock.getElapsedTime()

    // Slow 3-axis drift — feels like a plate floating in zero gravity
    pointsRef.current.rotation.x = Math.sin(elapsed * 0.011) * 0.10
    pointsRef.current.rotation.y = elapsed * 0.006 + Math.sin(elapsed * 0.017) * 0.04
    pointsRef.current.rotation.z = Math.cos(elapsed * 0.008) * 0.06
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

export function ArchiveCanvas({
  signaturePoints,
}: {
  signaturePoints: number[]
}) {
  // Key on a hash of signaturePoints so Three.js remounts when collective changes
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
