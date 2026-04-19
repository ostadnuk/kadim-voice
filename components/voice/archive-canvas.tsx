"use client"

/**
 * ArchiveCanvas — inside the vessel.
 *
 * Camera sits just inside the vessel, looking inward.
 * Gyroscope tilts where you're looking (look around inside).
 * Touch/drag also pans the view.
 *
 * Entry animation: particles expand FROM center outward into formation
 * — mirrors the imprint canvas converging TO center on exit.
 * Together they feel like one continuous canvas.
 */

import { useRef, useMemo, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { buildImprintPositions } from "./voice-canvas-unified"

const BG       = new THREE.Color("#070c17")   // matches wonder-flow exit fade
const N        = 18_000
const N_ARRIVE = 600

const SETTLE   = 5.5   // seconds to expand into formation

// ── Interaction state ─────────────────────────────────────────────────────────

interface GyroState  { beta: number;  gamma: number;  active: boolean }
interface DragState  {
  deltaX: number; deltaY: number
  velX:   number; velY:   number    // last-frame velocity for momentum
  isDragging: boolean
}

// ── Inside camera — gyro + full free-look drag + pinch to zoom ────────────────
//
// orbitY = accumulated yaw  (horizontal)
// orbitX = accumulated pitch (vertical, clamped ±70°)
// On drag release: momentum carries the look direction forward, decays smoothly.

function InsideCamera({
  gyroRef,
  dragRef,
  zoomRef,
}: {
  gyroRef: React.RefObject<GyroState>
  dragRef: React.RefObject<DragState>
  zoomRef: React.RefObject<{ z: number }>
}) {
  const { camera } = useThree()
  const orbitX  = useRef(0.15)    // pitch (radians) — slightly upward default
  const orbitY  = useRef(0.0)     // yaw   (radians)
  const zCur    = useRef(1.0)     // smooth camera Z

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 80
    cam.near = 0.05
    cam.updateProjectionMatrix()
  }, [camera])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    // Smooth zoom
    zCur.current = THREE.MathUtils.lerp(zCur.current, zoomRef.current.z, 0.08)

    // Subtle float
    camera.position.x = Math.sin(t * 0.07) * 0.04
    camera.position.y = Math.cos(t * 0.05) * 0.03
    camera.position.z = zCur.current

    if (dragRef.current.isDragging) {
      // Direct drag → accumulate into orbit angles
      orbitY.current += dragRef.current.deltaX * 0.0045
      orbitX.current -= dragRef.current.deltaY * 0.0045   // screen-Y inverted
      // Capture velocity for momentum on release
      dragRef.current.velX = dragRef.current.deltaX
      dragRef.current.velY = dragRef.current.deltaY
      dragRef.current.deltaX = 0
      dragRef.current.deltaY = 0
    } else {
      // Momentum: carry last velocity, decay with friction
      orbitY.current += dragRef.current.velX * 0.0045
      orbitX.current -= dragRef.current.velY * 0.0045
      dragRef.current.velX *= 0.88
      dragRef.current.velY *= 0.88
    }

    // Clamp pitch so you can't flip upside down
    orbitX.current = Math.max(-1.2, Math.min(1.2, orbitX.current))

    // Gyro: additive offset on top of accumulated orbit
    const gyro    = gyroRef.current
    const gyroDX  = gyro.active ? gyro.gamma * 0.006 : 0
    const gyroDY  = gyro.active ? gyro.beta  * 0.005 : 0

    // Gentle idle drift when nobody is touching
    const idleDrift = (Math.abs(dragRef.current.velX) < 0.3 && !dragRef.current.isDragging)
      ? Math.sin(t * 0.04) * 0.025
      : 0

    // Convert spherical (pitch/yaw) to lookAt target
    const LOOK_DIST = 1.8
    const pitch = orbitX.current + gyroDY
    const yaw   = orbitY.current + gyroDX + idleDrift
    camera.lookAt(
      Math.sin(yaw)   * LOOK_DIST,
      Math.sin(pitch) * LOOK_DIST,
      -Math.cos(yaw)  * LOOK_DIST,
    )
  })
  return null
}

// ── Vessel shell — barely visible, suggests enclosure ────────────────────────

function VesselShell() {
  const { scene } = useGLTF("/vessel.glb")
  const groupRef  = useRef<THREE.Group>(null!)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        ;(child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
          color:       new THREE.Color("#1a2f55"),
          transparent: true,
          opacity:     0.07,
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
    c.rotation.x = 0.55
    c.rotation.z = -0.18
    return c
  }, [scene])

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.001
  })

  return <primitive ref={groupRef} object={cloned} />
}

// ── Collective particles — expand from center into formation ──────────────────

function CollectiveScene({
  signaturePoints,
  mySignatureId,
  dragRef,
}: {
  signaturePoints: number[]
  mySignatureId?:  string | null
  dragRef: React.RefObject<DragState>
}) {
  const cloudRef  = useRef<THREE.Points>(null!)
  const startRef  = useRef<number | null>(null)

  // Main collective cloud
  const { geo: cloudGeo, mat: cloudMat } = useMemo(() => {
    const flat   = buildImprintPositions(signaturePoints)
    const pos    = new Float32Array(N * 3)
    const sizes  = new Float32Array(N)
    const phase  = new Float32Array(N)
    const jitter = new Float32Array(N * 3)   // small center jitter for entry

    // Max radial extent of Chladni pattern after scaling
    const CHLADNI_R = 1.5 * 1.9   // DISPLAY_R * scale = 2.85

    for (let i = 0; i < N; i++) {
      const xi = flat[i * 3]     * 1.9
      const yi = flat[i * 3 + 1] * 1.9

      // Ellipsoid z-distribution: center has full depth, edges taper to 0
      // — this makes the cloud feel like a 3D vessel shape, not a flat disk
      const r2     = xi * xi + yi * yi
      const zScale = Math.sqrt(Math.max(0, 1 - r2 / (CHLADNI_R * CHLADNI_R))) * 2.4

      pos[i * 3]     = xi
      pos[i * 3 + 1] = yi
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * zScale

      // Larger particles so the cloud reads as a dense glowing mass, not stars
      sizes[i] = Math.random() < 0.10
        ? 0.025 + Math.random() * 0.022   // bright accent dots (10%)
        : 0.009 + Math.random() * 0.014   // base cloud (90%)
      phase[i] = Math.random() * Math.PI * 2

      // Entry: start near center with small jitter, expand to formation
      jitter[i * 3]     = (Math.random() - 0.5) * 0.15
      jitter[i * 3 + 1] = (Math.random() - 0.5) * 0.15
      jitter[i * 3 + 2] = (Math.random() - 0.5) * 0.15
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute("aPhase",   new THREE.BufferAttribute(phase, 1))
    geo.setAttribute("aJitter",  new THREE.BufferAttribute(jitter, 3))

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
        attribute vec3  aJitter;
        uniform float   uOpacity;
        uniform float   uTime;
        uniform float   uSettle;
        varying float   vAlpha;

        float easeOut3(float t) { return 1.0 - pow(1.0 - t, 3.0); }

        void main() {
          float s = easeOut3(uSettle);

          // Entry: expand FROM center (jitter) TO formation position
          // At s=0: near center with tiny jitter
          // At s=1: at full formation position
          vec3 pos = position * s + aJitter * (1.0 - s);

          // Breathing — only once mostly settled
          float breath = 1.0 + 0.06 * s * sin(uTime * 0.5 + aPhase);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          // Clamp denominator so close particles don't blow up
          float dist = max(-mv.z, 0.35);
          gl_PointSize = size * breath * (520.0 / dist);
          gl_Position  = projectionMatrix * mv;

          // Depth-based alpha: nearby particles brighter, far ones dimmer
          float depth = clamp((-mv.z - 0.2) / 5.0, 0.0, 1.0);
          vAlpha = uOpacity * (0.75 + (1.0 - depth) * 0.25);
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        varying float vAlpha;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.15, 0.5, dist)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    return { geo, mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePoints])

  // Arrival particles — your voice descending from the vessel opening
  const { geo: arriveGeo, mat: arriveMat } = useMemo(() => {
    const pos   = new Float32Array(N_ARRIVE * 3)
    const sizes = new Float32Array(N_ARRIVE)
    const speed = new Float32Array(N_ARRIVE)

    for (let i = 0; i < N_ARRIVE; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 0.35
      // Start above, behind camera — near where the vessel opening would be
      pos[i * 3]     = Math.cos(a) * r * 0.5
      pos[i * 3 + 1] = 1.4 + Math.random() * 0.5
      pos[i * 3 + 2] = Math.sin(a) * r * 0.5 + 0.5   // behind camera plane
      sizes[i] = 0.006 + Math.random() * 0.010
      speed[i] = 0.35 + Math.random() * 0.65
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
        uProgress: { value: 0.0 },
        uColor:    { value: new THREE.Color("#7dd4a0") },
      },
      vertexShader: `
        attribute float size;
        attribute float aSpeed;
        uniform float   uProgress;
        varying float   vAlpha;
        void main() {
          float t    = clamp(uProgress * aSpeed, 0.0, 1.0);
          float ease = t * t * (3.0 - 2.0 * t);
          vec3  pos  = position;
          pos.y -= ease * 2.8;
          float spiral = ease * 3.0;
          pos.x += sin(pos.y * 3.5 + spiral) * 0.1 * ease;
          pos.z += cos(pos.y * 3.5 + spiral) * 0.08 * ease;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float dist = max(-mv.z, 0.4);
          gl_PointSize = size * (1.0 - ease * 0.5) * (380.0 / dist);
          gl_Position  = projectionMatrix * mv;
          vAlpha = (1.0 - smoothstep(0.6, 1.0, ease)) * 0.9;
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

  useFrame(({ clock, gl }) => {
    if (startRef.current === null) startRef.current = clock.getElapsedTime()
    const elapsed = clock.getElapsedTime() - startRef.current

    gl.setClearColor(BG, 1)

    cloudMat.uniforms.uOpacity.value = Math.min(elapsed / 1.8, 0.88)
    cloudMat.uniforms.uSettle.value  = Math.min(elapsed / SETTLE, 1.0)
    cloudMat.uniforms.uTime.value    = clock.getElapsedTime()

    if (cloudRef.current) {
      // Slow auto-rotation — pauses gracefully while user is actively exploring
      const autoSpeed = dragRef.current.isDragging ? 0 : 0.035
      cloudRef.current.rotation.y = elapsed * autoSpeed
      cloudRef.current.rotation.x = Math.sin(elapsed * 0.018) * 0.18
    }

    if (mySignatureId) {
      const p = Math.max(0, Math.min((elapsed - 0.5) / 5.0, 1.0))
      arriveMat.uniforms.uProgress.value = p
    }
  })

  return (
    <>
      <points ref={cloudRef}  geometry={cloudGeo} material={cloudMat} />
      {mySignatureId && (
        <points geometry={arriveGeo} material={arriveMat} />
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
  const key         = signaturePoints.slice(0, 4).map(v => v.toFixed(3)).join(",")
  const gyroRef     = useRef<GyroState>({ beta: 0, gamma: 0, active: false })
  const dragRef     = useRef<DragState>({ deltaX: 0, deltaY: 0, velX: 0, velY: 0, isDragging: false })
  const zoomRef     = useRef({ z: 1.0 })   // camera Z: 0.3 (close) → 2.5 (far)
  const gyroPermRef = useRef(false)

  useEffect(() => {
    function onOrientation(e: DeviceOrientationEvent) {
      gyroRef.current.beta   = e.beta  ?? 0
      gyroRef.current.gamma  = e.gamma ?? 0
      gyroRef.current.active = true
    }

    async function requestGyro() {
      if (gyroPermRef.current) return
      gyroPermRef.current = true
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
        try {
          const perm = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission()
          if (perm === "granted") window.addEventListener("deviceorientation", onOrientation)
        } catch { /* denied */ }
      } else {
        window.addEventListener("deviceorientation", onOrientation)
      }
    }

    // Touch / pointer — single finger: free-look in all directions, two fingers: pinch-to-zoom
    let lastX = 0, lastY = 0
    let lastPinchDist = 0

    function getPinchDist(e: TouchEvent) {
      if (e.touches.length < 2) return 0
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function onTouchStart(e: TouchEvent) {
      requestGyro()
      if (e.touches.length === 1) {
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
        dragRef.current.isDragging = true
        dragRef.current.velX = 0
        dragRef.current.velY = 0
      } else if (e.touches.length === 2) {
        dragRef.current.isDragging = false
        lastPinchDist = getPinchDist(e)
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        const dist = getPinchDist(e)
        if (lastPinchDist > 0) {
          const scale = dist / lastPinchDist
          zoomRef.current.z = Math.max(0.25, Math.min(2.5, zoomRef.current.z / scale))
        }
        lastPinchDist = dist
        dragRef.current.isDragging = false
      } else if (e.touches.length === 1 && dragRef.current.isDragging) {
        dragRef.current.deltaX += e.touches[0].clientX - lastX
        dragRef.current.deltaY += e.touches[0].clientY - lastY
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) lastPinchDist = 0
      if (e.touches.length === 0) dragRef.current.isDragging = false
    }

    // Mouse wheel for desktop zoom
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      zoomRef.current.z = Math.max(0.25, Math.min(2.5, zoomRef.current.z + e.deltaY * 0.002))
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "touch") return
      requestGyro()
      lastX = e.clientX
      lastY = e.clientY
      dragRef.current.isDragging = true
      dragRef.current.velX = 0
      dragRef.current.velY = 0
    }
    function onPointerMove(e: PointerEvent) {
      if (e.pointerType === "touch") return
      if (!dragRef.current.isDragging) return
      dragRef.current.deltaX += e.clientX - lastX
      dragRef.current.deltaY += e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
    }
    function onPointerUp(e: PointerEvent) {
      if (e.pointerType !== "touch") dragRef.current.isDragging = false
    }

    window.addEventListener("touchstart",   onTouchStart,  { passive: true })
    window.addEventListener("touchmove",    onTouchMove,   { passive: true })
    window.addEventListener("touchend",     onTouchEnd,    { passive: true })
    window.addEventListener("wheel",        onWheel,       { passive: false })
    window.addEventListener("pointerdown",  onPointerDown)
    window.addEventListener("pointermove",  onPointerMove)
    window.addEventListener("pointerup",    onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    window.addEventListener("deviceorientation", onOrientation)

    return () => {
      window.removeEventListener("touchstart",   onTouchStart)
      window.removeEventListener("touchmove",    onTouchMove)
      window.removeEventListener("touchend",     onTouchEnd)
      window.removeEventListener("wheel",        onWheel)
      window.removeEventListener("deviceorientation", onOrientation)
      window.removeEventListener("pointerdown",  onPointerDown)
      window.removeEventListener("pointermove",  onPointerMove)
      window.removeEventListener("pointerup",    onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [])

  return (
    <Canvas
      key={key}
      camera={{ fov: 80, position: [0, 0, 1.0] }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onCreated={({ gl }) => gl.setClearColor(BG, 1)}
    >
      <InsideCamera gyroRef={gyroRef} dragRef={dragRef} zoomRef={zoomRef} />
      <Suspense fallback={null}>
        <VesselShell />
      </Suspense>
      <CollectiveScene
        signaturePoints={signaturePoints}
        mySignatureId={mySignatureId}
        dragRef={dragRef}
      />
    </Canvas>
  )
}

useGLTF.preload("/vessel.glb")
