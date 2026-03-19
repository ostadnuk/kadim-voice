"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF, Environment, Stars } from "@react-three/drei"
import * as THREE from "three"

interface ScreenWelcomeProps {
  onContinue: () => void
}

const TITLES: { lang: Language; title: string; sub: string; cta: string; dir: string; color: string; glow: string; font: string; weight: number }[] = [
  { lang: "en", title: "KADIM", sub: "VOICE SIGNATURES ARCHIVE", cta: "ENTER ARCHIVE",    dir: "ltr", color: "#C36981", glow: "rgba(195,105,129,0.55)", font: "'narkiss-yair-variable'", weight: 900 },
  { lang: "he", title: "קדים",  sub: "ארכיון חתימות קול",         cta: "כניסה לארכיון",  dir: "rtl", color: "#A53D1E", glow: "rgba(165,61,30,0.55)",   font: "'narkiss-yair-variable'",  weight: 700 },
  { lang: "ar", title: "قديم",  sub: "أرشيف توقيعات الصوت",       cta: "ادخل الأرشيف",   dir: "rtl", color: "#324238", glow: "rgba(50,66,56,0.55)",    font: "'narkiss-yair-variable'",  weight: 900 },
]

const SCRAMBLE_CHARS = "░▒▓▄▀◆◇▪□▸⊗⊕01!><∷⋯"

function useScramble(text: string, trigger: number) {
  const [display, setDisplay] = useState(text)
  useEffect(() => {
    const duration = 700
    const start    = Date.now()
    const lockAt   = text.split("").map((_, i) =>
      (i / Math.max(text.length - 1, 1)) * duration * 0.65 + Math.random() * duration * 0.35
    )
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed >= duration) { setDisplay(text); clearInterval(id); return }
      setDisplay(text.split("").map((char, i) => {
        if (char === " " || char === "·") return char
        if (elapsed >= lockAt[i]) return char
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
      }).join(""))
    }, 38)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
  return display
}

export function ScreenWelcome({ onContinue }: ScreenWelcomeProps) {
  const [visible,  setVisible]  = useState(false)
  const [langIdx,  setLangIdx]  = useState(0)
  const [locked,   setLocked]   = useState(false)
  const [scramble, setScramble] = useState(0)

  const isDragging  = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const dragDelta   = useRef({ x: 0, y: 0 })

  // Cinematic entry refs
  const cameraZRef    = useRef(5.5)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const titleBlockRef = useRef<HTMLDivElement>(null)
  const blackRef      = useRef<HTMLDivElement>(null)
  const entering      = useRef(false)

  const handleEnter = () => {
    if (entering.current) return
    entering.current = true

    let raf: number
    const animate = () => {
      const z = cameraZRef.current

      // Canvas flips above HUD as vessel crosses title plane
      if (canvasWrapRef.current) {
        canvasWrapRef.current.style.zIndex = z < 2.8 ? "20" : "0"
      }
      // HUD fades out as vessel passes through
      if (titleBlockRef.current) {
        const opacity = Math.max(0, Math.min(1, (z - 1.0) / (2.8 - 1.0)))
        titleBlockRef.current.style.opacity = opacity.toFixed(3)
      }
      // Black overlay rises as camera enters the pipe
      if (blackRef.current) {
        const black = Math.max(0, Math.min(1, (1.4 - z) / (1.4 - 0.3)))
        blackRef.current.style.opacity = black.toFixed(3)
        if (black >= 0.98) {
          cancelAnimationFrame(raf)
          onContinue()
          return
        }
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
  }

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (locked) return
    const id = setInterval(() => {
      setLangIdx(i => (i + 1) % TITLES.length)
      setScramble(n => n + 1)
    }, 3400)
    return () => clearInterval(id)
  }, [locked])

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    dragDelta.current.x += (e.clientX - lastPointer.current.x) * 0.012
    dragDelta.current.y += (e.clientY - lastPointer.current.y) * 0.009
    lastPointer.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => { isDragging.current = false }

  const current      = TITLES[langIdx]
  const titleDisplay = useScramble(current.title, scramble)
  const subDisplay   = useScramble(current.sub,   scramble)

  return (
    <div
      className="relative flex min-h-[100dvh] select-none flex-col overflow-hidden"
      style={{ background: "#0d0b0e" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="ds-grain" />
      <div className="ds-scanlines" />

      {/* ── 3D canvas — full-screen background ── */}
      <div ref={canvasWrapRef} className="absolute inset-0" style={{ zIndex: 0, pointerEvents: "none" }}>
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 55, near: 0.2, far: 300 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={["#0d0b0e"]} />
          <fog   attach="fog"        args={["#0d0b0e", 20, 80]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 5, 3]}  intensity={1.5} color="#ffe8c0" />
          <directionalLight position={[-3,1,-2]}   intensity={0.4} color="#c0a880" />
          <pointLight       position={[0, 0, 3]}   intensity={0.7} color="#ffb060" distance={12} />
          <Stars radius={90} depth={60} count={5000} factor={3} saturation={0} fade speed={0.2} />
          <Suspense fallback={null}>
            <VesselModel isDragging={isDragging} dragDelta={dragDelta} />
            <Environment preset="sunset" />
          </Suspense>
          <CameraJourney cameraZRef={cameraZRef} entering={entering} />
        </Canvas>
      </div>

      {/* ── HUD overlay ── */}
      <div
        className="relative z-10 flex min-h-[100dvh] flex-col"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 1s ease" }}
      >

        {/* TOP ROW — corner info */}
        <div className="ds-safe-top flex items-start justify-between px-4">
          {/* top-left: signal */}
          <div style={{ fontFamily: "'narkiss-yair-variable'", fontSize: 11, letterSpacing: "0.15em", color: current.color, opacity: 0.7, transition: "color .6s", lineHeight: 1.6 }}>
            <SignalBar color={current.color} />
          </div>
          {/* top-right: lang selector — tap to lock */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", paddingTop: 2 }}>
            {TITLES.map((t, i) => {
              const isActive = i === langIdx
              return (
                <button
                  key={i}
                  onClick={() => {
                    setLangIdx(i)
                    setScramble(n => n + 1)
                    setLocked(true)
                  }}
                  style={{
                    background: isActive ? t.color : "transparent",
                    border: `1px solid ${isActive ? t.color : "#2a2030"}`,
                    padding: "3px 8px",
                    cursor: "pointer",
                    fontFamily: "'narkiss-yair-variable'",
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    color: isActive ? "#0d0b0e" : "#6a5a70",
                    transition: "all .3s",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {["EN","HE","AR"][i]}
                </button>
              )
            })}
          </div>
        </div>

        {/* MIDDLE — hero title block (opacity driven by RAF depth loop) */}
        <div ref={titleBlockRef} className="flex flex-1 flex-col items-center justify-center px-4">

          {/* bracket top edge */}
          <BracketEdge color={current.color} position="top" />

          <div className="flex flex-col items-center gap-2 py-4" dir={current.dir}>

            {/* tiny label above */}
            <span style={{
              fontFamily: "'narkiss-yair-variable'", fontSize: 12,
              letterSpacing: "0.4em", textTransform: "uppercase",
              color: current.color, opacity: 0.65, transition: "color .6s",
            }}>
              — WELCOME TO —
            </span>

            {/* MAIN TITLE — glitched */}
            <div style={{ position: "relative", lineHeight: 0.88 }}>
              {/* rust glitch layer — bright version for visibility */}
              <span className="glitch-r" style={{
                position: "absolute", inset: 0,
                fontFamily: current.font, fontWeight: current.weight,
                fontSize: "clamp(4rem, 22vw, 9rem)",
                letterSpacing: "0.06em", color: "#E8623A",
                whiteSpace: "nowrap",
              }}>
                {titleDisplay}
              </span>
              {/* teal glitch layer — bright version for visibility */}
              <span className="glitch-b" style={{
                position: "absolute", inset: 0,
                fontFamily: current.font, fontWeight: current.weight,
                fontSize: "clamp(4rem, 22vw, 9rem)",
                letterSpacing: "0.06em", color: "#5BAF8A",
                whiteSpace: "nowrap",
              }}>
                {titleDisplay}
              </span>
              {/* real text */}
              <span style={{
                position: "relative",
                fontFamily: current.font, fontWeight: current.weight,
                fontSize: "clamp(4rem, 22vw, 9rem)",
                letterSpacing: "0.06em",
                color: "#fff",
                textShadow: `0 0 8px rgba(255,255,255,0.9), 0 0 20px ${current.glow}, 0 0 60px ${current.glow}, 0 0 120px ${current.glow.replace(".55","0.25")}`,
                transition: "text-shadow .6s",
                whiteSpace: "nowrap",
                display: "block",
              }}>
                {titleDisplay}
              </span>
            </div>

            {/* divider line */}
            <div style={{ width: "100%", height: 1, background: current.color, opacity: 0.25, transition: "background .6s" }} />

            {/* subtitle */}
            <span style={{
              fontFamily: "'narkiss-yair-variable'", fontWeight: 400,
              fontSize: "clamp(10px, 2.8vw, 13px)",
              letterSpacing: "0.3em", textTransform: "uppercase",
              color: "#fff", opacity: 0.75,
              textShadow: `0 0 12px ${current.glow}`,
              transition: "text-shadow .6s",
            }}>
              {subDisplay}
            </span>
          </div>

          {/* bracket bottom edge */}
          <BracketEdge color={current.color} position="bottom" />
        </div>

        {/* BOTTOM — coords row + full-width CTA */}
        <div className="ds-safe-bottom flex flex-col gap-2 px-4">
          {/* mini info row */}
          <div className="flex items-end justify-between">
            <CoordsTicker color={current.color} />
            <span style={{
              fontFamily: "'narkiss-yair-variable'", fontSize: 11,
              letterSpacing: "0.2em", color: current.color,
              opacity: 0.55, transition: "color .6s",
            }}>
              drag to explore
            </span>
          </div>

          {/* full-width enter button — text updates with selected language */}
          <button
            onClick={handleEnter}
            style={{
              width: "100%",
              fontFamily: current.font, fontSize: "clamp(13px, 3.5vw, 17px)",
              letterSpacing: current.lang === "en" ? "0.3em" : "0.08em",
              textTransform: current.lang === "en" ? "uppercase" : "none",
              color: "#0d0b0e",
              background: current.color,
              border: "none",
              padding: "14px 0",
              minHeight: 52,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background .6s",
              WebkitTapHighlightColor: "transparent",
              fontWeight: current.weight,
              direction: current.dir as "ltr" | "rtl",
            }}
          >
            <span>{current.cta}</span>
            <span className="ds-cursor" style={{ color: "#07060488" }}>▋</span>
          </button>
        </div>
      </div>

      {/* Full-screen black for pipe-entry fade */}
      <div
        ref={blackRef}
        style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "#000", opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

// ── Corner bracket edges ──────────────────────────────────────────────────────
function BracketEdge({ color, position }: { color: string; position: "top" | "bottom" }) {
  const isTop = position === "top"
  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, transition: "color .6s" }}>
      {/* left bracket arm */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
        {isTop
          ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}`, opacity: .6 }} />
          : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}`, opacity: .6 }} />
        }
      </div>
      {/* line */}
      <div style={{ flex: 1, height: 1, background: color, opacity: .12 }} />
      {/* right bracket arm */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
        {isTop
          ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: .6 }} />
          : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: .6 }} />
        }
      </div>
    </div>
  )
}

// ── Signal bar ────────────────────────────────────────────────────────────────
function SignalBar({ color }: { color: string }) {
  const [sig, setSig] = useState(7)
  useEffect(() => {
    const id = setInterval(() => {
      setSig(Math.round(4 + Math.sin(Date.now() / 1000 * 0.08) * 3))
    }, 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ fontFamily: "'narkiss-yair-variable'", fontSize: 11, letterSpacing: "0.18em", color, opacity: 0.7, transition: "color .6s" }}>
      SIG [{("█".repeat(sig) + "░".repeat(10 - sig))}]
    </div>
  )
}

// ── Live coordinates ──────────────────────────────────────────────────────────
function CoordsTicker({ color }: { color: string }) {
  const [vals, setVals] = useState({ a: "0000.000", b: "0000.000" })
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now() / 1000
      setVals({
        a: (Math.abs(Math.sin(t * 0.031) * 9999.999)).toFixed(3).padStart(8, "0"),
        b: (Math.abs(Math.cos(t * 0.047) * 9999.999)).toFixed(3).padStart(8, "0"),
      })
    }, 120)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{
      fontFamily: "'narkiss-yair-variable'", fontSize: 11,
      letterSpacing: "0.12em", color, opacity: 0.55,
      lineHeight: 1.7, transition: "color .6s",
    }}>
      <div>TX {vals.a}</div>
      <div>RX {vals.b}</div>
    </div>
  )
}

// ── Camera drifts through space ───────────────────────────────────────────────
function CameraJourney({
  cameraZRef,
  entering,
}: {
  cameraZRef: React.MutableRefObject<number>
  entering:   React.MutableRefObject<boolean>
}) {
  const { camera } = useThree()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    if (entering.current) {
      // Rush toward the vessel — aim slightly off-center to suggest a pipe opening
      camera.position.x = THREE.MathUtils.lerp(camera.position.x,  0.15, 0.04)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y,  0.08, 0.04)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z,  0.15, 0.028)
      camera.lookAt(0.15, 0.08, 0)
    } else {
      // Normal ambient drift
      camera.position.z = 5.5 + Math.sin(t * 0.10) * 4.5   // 1.0 → 10.0
      camera.position.x = Math.sin(t * 0.07) * 0.35
      camera.position.y = Math.cos(t * 0.05) * 0.2
      camera.lookAt(0, 0, 0)
    }

    cameraZRef.current = camera.position.z
  })
  return null
}

// ── Vessel ────────────────────────────────────────────────────────────────────
interface VesselModelProps {
  isDragging: React.MutableRefObject<boolean>
  dragDelta:  React.MutableRefObject<{ x: number; y: number }>
}

// Initial tilt to reveal the interesting geometry (pipes/top) rather than just the base
const TILT_X =  0.55   // lean back — shows top/pipes
const TILT_Z = -0.18   // slight roll for off-axis dynamism

function VesselModel({ isDragging, dragDelta }: VesselModelProps) {
  const { scene } = useGLTF("/vessel.glb")
  const ref     = useRef<THREE.Group>(null)
  const userRot = useRef({ x: TILT_X, y: 0 })  // start already tilted

  useEffect(() => {
    if (!ref.current) return
    const box    = new THREE.Box3().setFromObject(ref.current)
    const center = box.getCenter(new THREE.Vector3())
    const size   = box.getSize(new THREE.Vector3())
    const scale  = 4.5 / Math.max(size.x, size.y, size.z)
    ref.current.scale.setScalar(scale)
    ref.current.position.sub(center.multiplyScalar(scale))
    ref.current.rotation.z = TILT_Z   // permanent Z roll
  }, [scene])

  useFrame(({ clock }) => {
    if (!ref.current) return
    if (isDragging.current) {
      userRot.current.y += dragDelta.current.x
      userRot.current.x += dragDelta.current.y
      dragDelta.current  = { x: 0, y: 0 }
    } else {
      userRot.current.y += 0.0025
    }
    // Allow wider X range so user can still explore freely
    userRot.current.x      = Math.max(-1.2, Math.min(1.2, userRot.current.x))
    ref.current.rotation.y = userRot.current.y
    ref.current.rotation.x = userRot.current.x
    ref.current.position.y += (Math.sin(clock.elapsedTime * 0.5) * 0.06 - ref.current.position.y) * 0.02
  })

  return <primitive ref={ref} object={scene} />
}

useGLTF.preload("/vessel.glb")
