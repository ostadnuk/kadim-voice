"use client"

import { useRef } from "react"
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber"
import * as THREE from "three"

extend({ Line_: THREE.Line })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineEl = THREE.Line

declare module "@react-three/fiber" {
  interface ThreeElements {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    line_: any
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOB_CENTERS = [
  new THREE.Vector3(-0.28, -0.22, 0),
  new THREE.Vector3( 0.30,  0.25, 0),
  new THREE.Vector3( 0.06, -0.04, 0),
]
const BLOB_RADII  = [0.72, 0.62, 0.52]
const BLOB_COLORS = [
  new THREE.Color(52 / 255, 105 / 255, 72 / 255),
  new THREE.Color(190 / 255, 72 / 255, 26 / 255),
  new THREE.Color(185 / 255, 100 / 255, 135 / 255),
]
const BLOB_ALPHAS = [0.90, 0.78, 0.60]

const TRAIL_COLORS_HEX = ["#7dd4a0", "#d4964f", "#d97a96"]
const RING_SPEEDS       = [Math.PI / 5, (Math.PI / 5) * 2, (Math.PI / 5) * 3]
const PHASE1_END        = 1.5
const ROT_DUR           = 2.8
const WAVE_HISTORY      = 6

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ── Atmosphere + grain shader (lives on the sphere surface) ───────────────────

const atmVert = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const atmFrag = `
  varying vec3 vPos;
  uniform float uSR;
  uniform float uTime;
  uniform vec3  uC0; uniform float uR0; uniform float uA0;
  uniform vec3  uC1; uniform float uR1; uniform float uA1;
  uniform vec3  uC2; uniform float uR2; uniform float uA2;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Base dark color
    vec3 col = vec3(0.031, 0.024, 0.055);

    // Radial blob glows — screen-blend style (additive on dark)
    float d0 = length(vPos - uC0 * uSR) / (uR0 * uSR);
    float d1 = length(vPos - uC1 * uSR) / (uR1 * uSR);
    float d2 = length(vPos - uC2 * uSR) / (uR2 * uSR);

    col = min(vec3(1.0), col + uC0 * uA0 * max(0.0, 1.0 - d0 * d0));
    col = min(vec3(1.0), col + uC1 * uA1 * max(0.0, 1.0 - d1 * d1));
    col = min(vec3(1.0), col + uC2 * uA2 * max(0.0, 1.0 - d2 * d2));

    // Film grain
    float g = rand(vPos.xy * 800.0 + fract(uTime * 0.04)) * 0.03;
    col += vec3(g);

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Ellipse point helpers ─────────────────────────────────────────────────────

function buildEllipsePoints(rx: number, ry: number, segments = 128): Float32Array {
  const pts = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts[i * 3]     = Math.cos(a) * rx
    pts[i * 3 + 1] = Math.sin(a) * ry
    pts[i * 3 + 2] = 0
  }
  return pts
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function WonderScene({ energies }: { energies: [number, number, number] }) {
  const { viewport } = useThree()

  const groupRef    = useRef<THREE.Group>(null!)
  const atmUniforms = useRef({
    uSR:  { value: 1 },
    uTime:{ value: 0 },
    uC0:  { value: BLOB_COLORS[0] }, uR0: { value: BLOB_RADII[0] }, uA0: { value: BLOB_ALPHAS[0] },
    uC1:  { value: BLOB_COLORS[1] }, uR1: { value: BLOB_RADII[1] }, uA1: { value: BLOB_ALPHAS[1] },
    uC2:  { value: BLOB_COLORS[2] }, uR2: { value: BLOB_RADII[2] }, uA2: { value: BLOB_ALPHAS[2] },
  })

  // Ring lines
  const ringLineRefs  = [useRef<LineEl>(null!), useRef<LineEl>(null!), useRef<LineEl>(null!)]
  // Orbital dot meshes
  const dotRefs       = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)]
  // Traveling ring
  const travelGroupRef = useRef<THREE.Group>(null!)
  const travelLineRef  = useRef<LineEl>(null!)
  // Outer ring
  const outerLineRef   = useRef<LineEl>(null!)
  // Wave trail lines (world-space)
  const trailLineRefs  = [useRef<LineEl>(null!), useRef<LineEl>(null!), useRef<LineEl>(null!)]

  // Animation state
  const anglesRef  = useRef([Math.PI * 0.3, Math.PI * 0.9, Math.PI * 1.6])
  const travelRef  = useRef(0)
  const historyRef = useRef<Array<Array<{ t: number; y: number }>>>([[], [], []])
  const prevTRef   = useRef<number | null>(null)
  const wpVec      = useRef(new THREE.Vector3())
  const startRef   = useRef<number | null>(null)

  // Derived sizing
  const SR = Math.min(viewport.width, viewport.height) * 0.32
  atmUniforms.current.uSR.value = SR

  const [bassE, midE, highE] = energies
  const innerRadii = [
    SR * (0.27 + bassE * 0.28),
    SR * (0.50 + midE  * 0.22),
    SR * (0.72 + highE * 0.14),
  ]
  const R_outer = SR * 0.91

  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current
    const dt = prevTRef.current !== null
      ? Math.min(elapsed - prevTRef.current, 0.05)
      : 0.016
    prevTRef.current = elapsed

    // Rotation
    const rotRaw      = elapsed < PHASE1_END ? 0 : Math.min((elapsed - PHASE1_END) / ROT_DUR, 1)
    const rotProgress = easeInOutCubic(rotRaw)
    const cosRot      = Math.cos(rotProgress * Math.PI * 0.5)

    if (groupRef.current) {
      groupRef.current.rotation.y = rotProgress * Math.PI * 0.5
      groupRef.current.position.x = SR * 0.46 * rotProgress
    }

    atmUniforms.current.uTime.value = elapsed

    // Advance angles
    for (let i = 0; i < 3; i++) anglesRef.current[i] += RING_SPEEDS[i] * dt
    travelRef.current += dt * 0.65

    // Flatten inner rings as sphere rotates (local X axis squishes with cosRot)
    for (let i = 0; i < 3; i++) {
      const line = ringLineRefs[i].current
      if (line?.geometry) {
        const pts = buildEllipsePoints(
          Math.max(innerRadii[i] * cosRot, 0.001),
          innerRadii[i],
          96
        )
        line.geometry.setAttribute("position", new THREE.BufferAttribute(pts, 3))
        line.geometry.attributes.position.needsUpdate = true
      }

      // Move orbital dot in local space
      const dot = dotRefs[i].current
      if (dot) {
        dot.position.set(
          innerRadii[i] * Math.cos(anglesRef.current[i]),
          innerRadii[i] * Math.sin(anglesRef.current[i]),
          0
        )
        // Fade in as sphere hits side view
        const mat = dot.material as THREE.MeshBasicMaterial
        mat.opacity = Math.max(0, 1 - cosRot / 0.28) * 0.90

        // Record world-space Y for wave trail
        dot.getWorldPosition(wpVec.current)
        if (elapsed > PHASE1_END * 0.4) {
          historyRef.current[i].push({ t: elapsed, y: wpVec.current.y })
          const cutoff = elapsed - WAVE_HISTORY - 0.5
          while (historyRef.current[i].length > 0 && historyRef.current[i][0].t < cutoff)
            historyRef.current[i].shift()
        }
      }
    }

    // Flatten traveling ring
    const tg = travelGroupRef.current
    const tl = travelLineRef.current
    if (tg && tl?.geometry) {
      const trR = SR * 0.36
      tg.position.set(
        trR * Math.cos(travelRef.current) * cosRot,
        trR * Math.sin(travelRef.current) * 0.28,
        0
      )
      const pts = buildEllipsePoints(
        Math.max(trR * 0.5 * cosRot, 0.001),
        trR * 0.5,
        64
      )
      tl.geometry.setAttribute("position", new THREE.BufferAttribute(pts, 3))
      tl.geometry.attributes.position.needsUpdate = true
    }

    // Wave trails (world-space)
    const sphereX  = groupRef.current ? groupRef.current.position.x : 0
    const waveRight = sphereX - R_outer - SR * 0.07
    const waveLeft  = -(viewport.width / 2) * 0.88
    const waveW     = Math.max(waveRight - waveLeft, 0.001)
    const waveSpeed = waveW / WAVE_HISTORY
    const trailFade = Math.min(rotProgress * 1.8, 1)

    for (let i = 0; i < 3; i++) {
      const trl = trailLineRefs[i].current
      if (!trl?.geometry) continue
      const hist = historyRef.current[i]
      if (hist.length < 2) continue

      const pts: number[] = []
      for (const pt of hist) {
        const x = waveRight - (elapsed - pt.t) * waveSpeed
        if (x < waveLeft - 0.1) continue
        pts.push(Math.max(x, waveLeft), pt.y, 0)
      }
      if (pts.length >= 6) {
        trl.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3))
        trl.geometry.attributes.position.needsUpdate = true
      }
      const mat = trl.material as THREE.LineBasicMaterial
      mat.opacity = trailFade * [0.68, 0.78, 0.88][i]
    }
  })

  // Initial geometries
  const outerPts = buildEllipsePoints(R_outer, R_outer, 256)

  return (
    <>
      {/* ── Rotating sphere group ───────────────────────────────────────── */}
      <group ref={groupRef}>

        {/* Atmosphere + grain — single sphere mesh with custom shader */}
        <mesh renderOrder={0}>
          <sphereGeometry args={[SR, 64, 64]} />
          <shaderMaterial
            vertexShader={atmVert}
            fragmentShader={atmFrag}
            uniforms={atmUniforms.current}
          />
        </mesh>

        {/* Outer dotted ring — depthTest off so it always shows */}
        <line_ ref={outerLineRef} renderOrder={2}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[outerPts, 3]} />
          </bufferGeometry>
          <lineDashedMaterial color="#f0ece4" opacity={0.22} transparent depthTest={false}
            dashSize={R_outer * 0.04} gapSize={R_outer * 0.15} linewidth={1} />
        </line_>

        {/* Inner rings */}
        {[0, 1, 2].map((i) => (
          <line_ key={i} ref={ringLineRefs[i]} renderOrder={2}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position"
                args={[buildEllipsePoints(innerRadii[i], innerRadii[i], 96), 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#f0ece4" opacity={0.28 - i * 0.05}
              transparent depthTest={false} linewidth={1} />
          </line_>
        ))}

        {/* Orbital dots (fade in at side view) */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} ref={dotRefs[i]} position={[innerRadii[i], 0, 0]} renderOrder={3}>
            <sphereGeometry args={[SR * 0.028, 8, 8]} />
            <meshBasicMaterial color={TRAIL_COLORS_HEX[i]}
              transparent opacity={0} depthTest={false}
              blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}

        {/* Traveling dotted ring */}
        <group ref={travelGroupRef} renderOrder={2}>
          <line_ ref={travelLineRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position"
                args={[buildEllipsePoints(SR * 0.18, SR * 0.18, 64), 3]} />
            </bufferGeometry>
            <lineDashedMaterial color="#f0ece4" opacity={0.14} transparent depthTest={false}
              dashSize={SR * 0.03} gapSize={SR * 0.07} linewidth={1} />
          </line_>
        </group>

      </group>

      {/* ── Wave trails — world-space, outside rotating group ──────────── */}
      {[0, 1, 2].map((i) => (
        <line_ key={i} ref={trailLineRefs[i]} renderOrder={4}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(6), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={TRAIL_COLORS_HEX[i]}
            transparent opacity={0} depthTest={false}
            blending={THREE.AdditiveBlending} depthWrite={false} linewidth={1.5} />
        </line_>
      ))}
    </>
  )
}

// ── Canvas export ─────────────────────────────────────────────────────────────

export function WonderSphereCanvas({ energies }: { energies: [number, number, number] }) {
  return (
    <Canvas
      camera={{ fov: 50, position: [0, 0, 5] }}
      style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <WonderScene energies={energies} />
    </Canvas>
  )
}
