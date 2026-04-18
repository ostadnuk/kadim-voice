"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import type { Language } from "@/lib/i18n"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF, Environment, Stars } from "@react-three/drei"
import * as THREE from "three"
import { COLOR, FONT, TYPE, TRACK, OPACITY, DSStepBar, StepProvider, RADecTicker } from "./ds"

interface ScreenWelcomeProps {
  onContinue: () => void
}

const TITLES: { lang: Language; title: string; sub: string; cta: string; welcome: string; drag: string; titleSize: string; dir: string; color: string; glow: string; font: string; weight: number }[] = [
  { lang: "en", title: "KADIM", sub: "VOICE SIGNATURES ARCHIVE", cta: "ENTER",   welcome: "— WELCOME TO —",  drag: "drag to explore",   titleSize: "clamp(3.5rem, 19vw, 8rem)",  dir: "ltr", color: "#f0ece4", glow: "rgba(240,236,228,0.45)", font: "'narkiss-yair-variable'", weight: 700 },
  { lang: "he", title: "קדים",  sub: "ארכיון חתימות קול",        cta: "כניסה",   welcome: "— ברוכים הבאים —", drag: "גרור לחקירה",        titleSize: "clamp(4.5rem, 24vw, 10rem)", dir: "rtl", color: "#f0ece4", glow: "rgba(240,236,228,0.45)", font: "'narkiss-yair-variable'", weight: 700 },
  { lang: "ar", title: "قديم",  sub: "أرشيف توقيعات الصوت",      cta: "دخول",    welcome: "— مرحباً بك —",    drag: "اسحب للاستكشاف",    titleSize: "clamp(3.8rem, 21vw, 8.5rem)", dir: "rtl", color: "#f0ece4", glow: "rgba(240,236,228,0.45)", font: "'narkiss-yair-variable'", weight: 700 },
]

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ אבגדהוזחטיכלמנסעפצ قدمأبتثجح0123456789"

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
      style={{ background: "#14111a" }}
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
          <color attach="background" args={["#14111a"]} />
          <fog   attach="fog"        args={["#14111a", 20, 80]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 3]}  intensity={1.6} color="#ffffff" />
          <directionalLight position={[-3,1,-2]}   intensity={0.3} color="#d0ccc8" />
          <pointLight       position={[0, 0, 3]}   intensity={0.5} color="#ffffff" distance={12} />
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

        {/* TOP ROW — step (fixed) + lang */}
        <div style={{ position: "fixed", top: 0, left: 0, zIndex: 100, padding: "max(1.25rem, calc(env(safe-area-inset-top) + 0.5rem)) 0 0 1rem" }}>
          <StepProvider step={0}><DSStepBar color={current.color} /></StepProvider>
        </div>
        <div className="ds-safe-top flex items-center justify-end px-4">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {TITLES.map((t, i) => {
              const isActive = i === langIdx
              return (
                <button
                  key={i}
                  onClick={() => { setLangIdx(i); setScramble(n => n + 1); setLocked(true) }}
                  aria-pressed={isActive}
                  style={{
                    background: "none", border: "none", padding: "0",
                    minHeight: "auto", minWidth: "auto", cursor: "pointer",
                    fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps,
                    color: current.color,
                    opacity: isActive ? OPACITY.secondary : OPACITY.ghost,
                    transition: "opacity 0.3s",
                    WebkitTapHighlightColor: "transparent",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {["EN","HE","AR"][i]}
                </button>
              )
            })}
          </div>
        </div>

        {/* CENTER — title block, vertically centered */}
        <div ref={titleBlockRef} className="flex flex-1 flex-col items-center justify-center px-4">

          <BracketEdge color={current.color} position="top" />

          <div className="flex flex-col items-center gap-2 py-4" dir={current.dir} style={{ minHeight: "clamp(12rem, 38vw, 18rem)", justifyContent: "center" }}>

            <span style={{
              fontFamily: FONT.base, fontSize: TYPE.xs,
              letterSpacing: TRACK.caps, textTransform: "uppercase",
              color: current.color, opacity: OPACITY.secondary,
              transition: 'color 0.6s cubic-bezier(0.625,0.05,0,1)',
            }}>
              {current.welcome}
            </span>

            {/* MAIN TITLE — prismatic chromatic aberration */}
            <style>{`
              @keyframes prism {
                0%, 85%, 100% { transform: translateX(0); opacity: 0; }
                86%  { transform: translateX(var(--px)); opacity: 0.55; }
                87%  { transform: translateX(0);         opacity: 0;    }
                88%  { transform: translateX(var(--px)); opacity: 0.35; }
                89%  { opacity: 0; }
              }
              .prism-c { animation: prism 7s steps(1, end) infinite;        --px: -4px; }
              .prism-r { animation: prism 7s steps(1, end) infinite 0.05s;  --px:  4px; }
            `}</style>
            <div style={{ position: "relative", lineHeight: 0.88 }}>
              <span className="prism-c" style={{
                position: "absolute", inset: 0,
                fontFamily: current.font, fontWeight: current.weight,
                fontSize: current.titleSize,
                letterSpacing: "0.02em", color: "#7ecfea",
                mixBlendMode: "screen", whiteSpace: "nowrap",
                pointerEvents: "none",
              }}>{titleDisplay}</span>
              <span className="prism-r" style={{
                position: "absolute", inset: 0,
                fontFamily: current.font, fontWeight: current.weight,
                fontSize: current.titleSize,
                letterSpacing: "0.02em", color: "#c8960c",
                mixBlendMode: "screen", whiteSpace: "nowrap",
                pointerEvents: "none",
              }}>{titleDisplay}</span>
              <span style={{
                position: "relative",
                fontFamily: current.font, fontWeight: current.weight,
                fontSize: current.titleSize,
                letterSpacing: "0.02em",
                color: "#ffffff",
                whiteSpace: "nowrap",
                display: "block",
              }}>{titleDisplay}</span>
            </div>

            <span style={{
              fontFamily: FONT.base, fontWeight: 400,
              fontSize: TYPE.sm,
              letterSpacing: TRACK.caps, textTransform: "uppercase",
              color: COLOR.text, opacity: OPACITY.secondary,
            }}>
              {subDisplay}
            </span>
          </div>

          <BracketEdge color={current.color} position="bottom" />
        </div>

        {/* BOTTOM PANEL — RA/DEC + CTA */}
        <div className="ds-safe-bottom flex flex-col px-4 pt-2" style={{ gap: 12 }}>
          <RADecTicker color={current.color} />

          {/* CTA */}
          <button
            onClick={handleEnter}
            style={{
              width: "100%",
              fontFamily: current.font, fontSize: TYPE.base,
              letterSpacing: current.lang === "en" ? TRACK.caps : TRACK.sm,
              textTransform: current.lang === "en" ? "uppercase" : "none",
              color: COLOR.bg,
              background: current.color,
              border: "none",
              padding: "0 24px",
              minHeight: 56,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: 'background 0.6s cubic-bezier(0.625,0.05,0,1)',
              WebkitTapHighlightColor: "transparent",
              fontWeight: current.weight,
              direction: current.dir as "ltr" | "rtl",
            }}
          >
            {current.cta}
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
    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", transition: 'color 0.6s cubic-bezier(0.625,0.05,0,1)' }}>
      {isTop
        ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}`, opacity: .6 }} />
        : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}`, opacity: .6 }} />
      }
      {isTop
        ? <div style={{ width: 14, height: 14, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: .6 }} />
        : <div style={{ width: 14, height: 14, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}`, opacity: .6 }} />
      }
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
