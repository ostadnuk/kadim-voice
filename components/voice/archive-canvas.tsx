"use client"

/**
 * ArchiveCanvas — inside the vessel.
 *
 * Camera is positioned INSIDE the vessel geometry, looking inward.
 * The collective particle cloud fills the interior space.
 * The vessel mesh is rendered semi-transparent so you feel enclosed.
 * A glowing rim at the top suggests the opening you just entered through.
 *
 * If mySignatureId is provided (user just recorded), green particles
 * descend from the rim and dissolve into the collective — your voice
 * visibly joining the vessel's memory.
 */

import { useRef, useMemo, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { buildImprintPositions } from "./voice-canvas-unified"

const BG      = new THREE.Color("#070c17")   // darker — feels enclosed
const N       = 18_000
const N_ARRIVE = 700                          // arrival particles from rim

const SETTLE  = 6.0   // seconds to settle into formation
const FADE    = 2.0   // opacity fade-in duration

// ── Inside camera — slow drift, stays inside ──────────────────────────────────

function InsideCamera() {
  const { camera } = useThree()

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 82
    cam.updateProjectionMatrix()
    cam.position.set(0.08, -0.05, 0.55)
    cam.lookAt(0, 0.25, -0.6)
  }, [camera])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    camera.position.x = 0.08 + Math.sin(t * 0.07) * 0.05
    camera.position.y = -0.05 + Math.cos(t * 0.05) * 0.03
    camera.lookAt(
      Math.sin(t * 0.04) * 0.08,
      0.25 + Math.cos(t * 0.06) * 0.04,
      -0.6
    )
  })
  return null
}

// ── Vessel shell — barely visible, suggests enclosure ────────────────────────

function VesselShell() {
  const { scene } = useGLTF("/vessel.glb")
  const groupRef  = useRef<THREE.Group>(null!)

  // Clone scene so welcome screen's materials are unaffected
  const cloned = useMemo(() => {
    const c = scene.clone(true)

    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        ;(child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
          color:       new THREE.Color("#1a2f55"),
          transparent: true,
          opacity:     0.09,
          side:        THREE.DoubleSide,
          depthWrite:  false,
        })
      }
    })

    const box   = new THREE.Box3().setFromObject(c)
    const size  = box.getSize(new THREE.Vector3())
    const scale = 3.2 / Math.max(size.x, size.y, size.z)
    c.scale.setScalar(scale)
    const center = box.getCenter(new THREE.Vector3())
    c.position.sub(center.multiplyScalar(scale))
    c.rotation.x = 0.55   // same tilt as welcome screen
    c.rotation.z = -0.18
    return c
  }, [scene])

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.0015
  })

  return <primitive ref={groupRef} object={cloned} />
}

// ── Vessel rim — glowing ring suggesting the opening above ────────────────────

function VesselRim() {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.18 + Math.sin(clock.elapsedTime * 0.45) * 0.07
    }
  })
  return (
    <mesh position={[0, 1.45, -0.9]} rotation={[Math.PI * 0.32, 0, 0]}>
      <torusGeometry args={[1.05, 0.014, 8, 80]} />
      <meshBasicMaterial ref={matRef} color="#c8d8ee" transparent opacity={0.18} depthWrite={false} />
    </mesh>
  )
}

// ── Collective particles — volumetric 3D, filling the interior ────────────────

function CollectiveScene({
  signaturePoints,
  mySignatureId,
}: {
  signaturePoints: number[]
  mySignatureId?:  string | null
}) {
  const cloudRef   = useRef<THREE.Points>(null!)
  const arriveRef  = useRef<THREE.Points>(null!)
  const startRef   = useRef<number | null>(null)

  // ── Main collective cloud ─────────────────────────────────────────────────

  const { geo: cloudGeo, mat: cloudMat } = useMemo(() => {
    const flat   = buildImprintPositions(signaturePoints)
    const pos    = new Float32Array(N * 3)
    const sizes  = new Float32Array(N)
    const phase  = new Float32Array(N)
    const offset = new Float32Array(N * 3)   // scatter for arrival animation

    for (let i = 0; i < N; i++) {
      // Chladni x/y scaled up; true volumetric z spread
      pos[i * 3]     = flat[i * 3]     * 2.2
      pos[i * 3 + 1] = flat[i * 3 + 1] * 2.2
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.5   // deep z — fills the interior

      sizes[i] = Math.random() < 0.08
        ? 0.020 + Math.random() * 0.014
        : 0.004 + Math.random() * 0.009
      phase[i] = Math.random() * Math.PI * 2

      // Arrival scatter — particles converge from these scattered positions
      const a = Math.random() * Math.PI * 2
      const r = 1.4 + Math.random() * 2.8
      offset[i * 3]     = Math.cos(a) * r
      offset[i * 3 + 1] = Math.sin(a) * r + 0.8   // start slightly higher
      offset[i * 3 + 2] = (Math.random() - 0.5) * 2.5
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aPhase",   new THREE.BufferAttribute(phase, 1))
    geo.setAttribute("aOffset",  new THREE.BufferAttribute(offset, 3))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.0 },
        uTime:    { value: 0.0 },
        uSettle:  { value: 0.0 },
        uColor:   { value: new THREE.Color("#bdd0f0") },
      },
      vertexShader: `
        attribute float size;
        attribute float aPhase;
        attribute vec3  aOffset;
        uniform float   uOpacity;
        uniform float   uTime;
        uniform float   uSettle;
        varying float   vAlpha;

        float easeOut3(float t) { return 1.0 - pow(1.0 - t, 3.0); }

        void main() {
          float s   = easeOut3(uSettle);
          vec3  pos = position + aOffset * (1.0 - s);

          // Breathing only after mostly settled
          float breath = 1.0 + 0.07 * s * sin(uTime * 0.55 + aPhase);

          vec4  mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * breath * (520.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;

          // Depth-based alpha — closer particles slightly brighter (inside lighting)
          float depth = clamp((-mv.z - 0.3) / 5.0, 0.0, 1.0);
          vAlpha = uOpacity * (0.65 + (1.0 - depth) * 0.35);
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        varying float vAlpha;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.18, 0.5, dist)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    return { geo, mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePoints])

  // ── Arrival particles — descend from rim when user just recorded ──────────

  const { geo: arriveGeo, mat: arriveMat } = useMemo(() => {
    const pos   = new Float32Array(N_ARRIVE * 3)
    const sizes = new Float32Array(N_ARRIVE)
    const speed = new Float32Array(N_ARRIVE)

    for (let i = 0; i < N_ARRIVE; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 0.45
      // Start at rim position (matching VesselRim placement above)
      pos[i * 3]     = Math.cos(a) * r
      pos[i * 3 + 1] = 1.55 + Math.random() * 0.3
      pos[i * 3 + 2] = Math.sin(a) * r - 0.9

      sizes[i] = 0.008 + Math.random() * 0.014
      speed[i] = 0.4 + Math.random() * 0.6   // varied descent speeds
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aSpeed",   new THREE.BufferAttribute(speed, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0.0 },   // 0 = at rim, 1 = dissolved into collective
        uColor:    { value: new THREE.Color("#7dd4a0") },   // user's green
      },
      vertexShader: `
        attribute float size;
        attribute float aSpeed;
        uniform float   uProgress;
        varying float   vAlpha;

        void main() {
          // Each particle descends at its own speed
          float t   = clamp(uProgress * aSpeed, 0.0, 1.0);
          float ease = t * t * (3.0 - 2.0 * t);  // smoothstep

          vec3 pos  = position;
          pos.y    -= ease * 3.2;                  // fall downward into cloud
          // Gentle spiral as they fall
          float spiral = ease * 2.5;
          pos.x += sin(pos.y * 4.0 + spiral) * 0.12 * ease;
          pos.z += cos(pos.y * 4.0 + spiral) * 0.10 * ease;

          vec4 mv  = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (1.0 - ease * 0.6) * (520.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;

          // Fade out as they dissolve into the collective
          vAlpha = (1.0 - smoothstep(0.65, 1.0, ease)) * 0.95;
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        varying float vAlpha;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.12, 0.5, dist)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    return { geo, mat }
  }, [])

  // ── Animation loop ────────────────────────────────────────────────────────

  useFrame(({ clock, gl }) => {
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    // Collective cloud
    cloudMat.uniforms.uOpacity.value = Math.min(elapsed / FADE, 0.88)
    cloudMat.uniforms.uSettle.value  = Math.min(elapsed / SETTLE, 1.0)
    cloudMat.uniforms.uTime.value    = clock.getElapsedTime()

    if (cloudRef.current) {
      const s = Math.min(elapsed / SETTLE, 1.0)
      const speed = 1.0 + (1.0 - s) * 1.4   // more active while settling
      cloudRef.current.rotation.y = elapsed * 0.005 * speed
      cloudRef.current.rotation.x = Math.sin(elapsed * 0.008) * 0.04
    }

    // Arrival particles — start after 0.3s, complete over 5s
    if (mySignatureId) {
      const progress = Math.max(0, Math.min((elapsed - 0.3) / 5.0, 1.0))
      arriveMat.uniforms.uProgress.value = progress
    }
  })

  return (
    <>
      <points ref={cloudRef}  geometry={cloudGeo}  material={cloudMat}  />
      {mySignatureId && (
        <points ref={arriveRef} geometry={arriveGeo} material={arriveMat} />
      )}
    </>
  )
}

// ── Canvas export ─────────────────────────────────────────────────────────────

export function ArchiveCanvas({
  signaturePoints,
  mySignatureId,
}: {
  signaturePoints: number[]
  mySignatureId?:  string | null
}) {
  const key = signaturePoints.slice(0, 4).map(v => v.toFixed(3)).join(",")

  return (
    <Canvas
      key={key}
      camera={{ fov: 82, position: [0.08, -0.05, 0.55] }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onCreated={({ gl }) => gl.setClearColor(BG, 1)}
    >
      <InsideCamera />
      <VesselRim />
      <Suspense fallback={null}>
        <VesselShell />
      </Suspense>
      <CollectiveScene
        signaturePoints={signaturePoints}
        mySignatureId={mySignatureId}
      />
    </Canvas>
  )
}

useGLTF.preload("/vessel.glb")
