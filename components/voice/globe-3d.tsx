"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Stars } from "@react-three/drei"
import * as THREE from "three"
import type { ArchiveEntry } from "@/lib/types"
import { ACCENT, COLOR } from "./ds"

// Convert lat/lng to unit-sphere XYZ
function latLngToVec3(lat: number, lng: number, r = 1): [number, number, number] {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ]
}

// ── Globe wireframe ───────────────────────────────────────────────────────────
function GlobeGrid({ radius = 1.42 }: { radius?: number }) {
  const lines = useMemo(() => {
    const pts: number[] = []
    const LAT_LINES = 10
    const LNG_LINES = 16
    const SEGS = 64

    // latitude rings
    for (let i = 1; i < LAT_LINES; i++) {
      const lat = -90 + (180 / LAT_LINES) * i
      for (let j = 0; j <= SEGS; j++) {
        const lng = -180 + (360 / SEGS) * j
        const [x, y, z] = latLngToVec3(lat, lng, radius)
        pts.push(x, y, z)
      }
    }
    // longitude meridians
    for (let i = 0; i < LNG_LINES; i++) {
      const lng = -180 + (360 / LNG_LINES) * i
      for (let j = 0; j <= SEGS; j++) {
        const lat = -90 + (180 / SEGS) * j
        const [x, y, z] = latLngToVec3(lat, lng, radius)
        pts.push(x, y, z)
      }
    }
    return new Float32Array(pts)
  }, [radius])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(lines, 3))
    return g
  }, [lines])

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={ACCENT} transparent opacity={0.08} />
    </lineSegments>
  )
}

// ── Signature dots ────────────────────────────────────────────────────────────
function VoiceDots({ entries, radius = 1.44 }: { entries: ArchiveEntry[]; radius?: number }) {
  const located = useMemo(
    () => entries.filter((e) => e.lat != null && e.lng != null),
    [entries]
  )

  const positions = useMemo(() => {
    const arr = new Float32Array(located.length * 3)
    located.forEach((e, i) => {
      const [x, y, z] = latLngToVec3(e.lat!, e.lng!, radius)
      arr[i * 3]     = x
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z
    })
    return arr
  }, [located, radius])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  if (located.length === 0) return null

  return (
    <points geometry={geo}>
      <pointsMaterial color={ACCENT} size={0.04} sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

// ── Halo glow ring ────────────────────────────────────────────────────────────
function HaloRing({ radius = 1.46 }: { radius?: number }) {
  const geo = useMemo(() => new THREE.SphereGeometry(radius, 32, 32), [radius])
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={ACCENT} transparent opacity={0.03} side={THREE.BackSide} />
    </mesh>
  )
}

// ── Rotating scene ────────────────────────────────────────────────────────────
function Scene({ entries }: { entries: ArchiveEntry[] }) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging  = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const velocity    = useRef({ x: 0, y: 0 })
  const userRot     = useRef({ x: 0.3, y: 0 })

  useFrame(() => {
    if (!groupRef.current) return
    if (!isDragging.current) {
      userRot.current.y  += 0.0018
      velocity.current.x *= 0.92
      velocity.current.y *= 0.92
      userRot.current.x  += velocity.current.x
      userRot.current.y  += velocity.current.y
    }
    userRot.current.x = Math.max(-1.2, Math.min(1.2, userRot.current.x))
    groupRef.current.rotation.x = userRot.current.x
    groupRef.current.rotation.y = userRot.current.y
  })

  const onPointerDown = (e: THREE.Event & { clientX?: number; clientY?: number }) => {
    isDragging.current  = true
    const pe = e as unknown as PointerEvent
    lastPointer.current = { x: pe.clientX, y: pe.clientY }
    velocity.current    = { x: 0, y: 0 }
  }
  const onPointerMove = (e: THREE.Event & { clientX?: number; clientY?: number }) => {
    if (!isDragging.current) return
    const pe = e as unknown as PointerEvent
    velocity.current.y  = (pe.clientX - lastPointer.current.x) * 0.006
    velocity.current.x  = (pe.clientY - lastPointer.current.y) * 0.006
    userRot.current.x  += velocity.current.x
    userRot.current.y  += velocity.current.y
    lastPointer.current = { x: pe.clientX, y: pe.clientY }
  }
  const onPointerUp = () => { isDragging.current = false }

  return (
    <group
      ref={groupRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <GlobeGrid />
      <HaloRing />
      <VoiceDots entries={entries} />
    </group>
  )
}

// ── Exported canvas ───────────────────────────────────────────────────────────
interface Globe3DProps {
  entries: ArchiveEntry[]
  height?: number
}

export function Globe3D({ entries, height = 320 }: Globe3DProps) {
  return (
    <div style={{ width: "100%", height, background: COLOR.bg, position: "relative" }}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 42 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[COLOR.bg]} />
        <fog   attach="fog"        args={[COLOR.bg, 6, 20]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[4, 4, 4]} intensity={1.2} color={ACCENT} />
        <Stars radius={60} depth={40} count={2000} factor={2} saturation={0} fade speed={0.15} />
        <Scene entries={entries} />
      </Canvas>

      {/* scanline overlay */}
      <div
        style={{
          pointerEvents: "none", position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)",
        }}
      />

      {/* label overlay */}
      <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
        <span style={{ fontFamily: "'narkiss-yair-variable'", fontSize: 9, letterSpacing: "0.18em", color: ACCENT, opacity: 0.45 }}>
          VOICE DISTRIBUTION
        </span>
        <span style={{ fontFamily: "'narkiss-yair-variable'", fontSize: 9, letterSpacing: "0.15em", color: ACCENT, opacity: 0.3 }}>
          drag to rotate
        </span>
      </div>
    </div>
  )
}
