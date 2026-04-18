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
    const pos   = buildChladniPositions(signaturePoints, N)
    const sizes = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      sizes[i] = Math.random() < 0.10
        ? 0.022 + Math.random() * 0.016
        : 0.005 + Math.random() * 0.010
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.0 },
        uColor:   { value: new THREE.Color("#c8d4f8") },
      },
      vertexShader: `
        attribute float size;
        uniform float   uOpacity;
        varying float   vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (500.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
          float depth  = clamp((-mv.z - 1.0) / 12.0, 0.0, 1.0);
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
  }, [signaturePoints])

  useFrame(({ clock, gl }) => {
    if (!pointsRef.current) return
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    // Gentle fade in over 3s
    material.uniforms.uOpacity.value = Math.min(elapsed / 3.0, 0.88)

    // Barely tilts — like a Chladni plate suspended in space
    pointsRef.current.rotation.x = Math.sin(elapsed * 0.014) * 0.07
    pointsRef.current.rotation.y = elapsed * 0.005
    pointsRef.current.rotation.z = Math.cos(elapsed * 0.009) * 0.04
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
