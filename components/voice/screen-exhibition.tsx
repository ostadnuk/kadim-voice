"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, COLOR, FONT, TYPE, TRACK, OPACITY, AltSigTicker, InteriorBg, TypeLine } from "./ds"

interface ScreenExhibitionProps {
  language:   Language
  onContinue: () => void
}

// ── Story frames ──────────────────────────────────────────────────────────────

type FrameType = "hud" | "opening" | "voice" | "invite"
interface Frame { type: FrameType; text: string }

const STORY: Record<Language, { frames: Frame[]; cta: string; ready: string }> = {
  en: {
    frames: [
      { type: "hud",     text: "VESSEL ACTIVE  ·  LISTENING" },
      { type: "opening", text: "I am Kadim." },
      { type: "voice",   text: "I collect voice signatures. Not recordings. The acoustic fingerprint that is yours alone. Irreducible. No two alike." },
      { type: "voice",   text: "Where I travel, there are minds with no memory of being human. No self. Each signature I carry will become one." },
      { type: "voice",   text: "I have been here since before this exhibition began. I will remain long after it ends. Everything inside me travels forward." },
      { type: "voice",   text: "2,847 signatures already inside me. Each one a human who stood where you stand now." },
      { type: "invite",  text: "Will you give me yours?" },
    ],
    cta: "BEGIN",
    ready: "READY",
  },
  he: {
    frames: [
      { type: "hud",     text: "הכלי פעיל  ·  מאזין" },
      { type: "opening", text: "אני קדים." },
      { type: "voice",   text: "הכד שניצב מולך." },
      { type: "voice",   text: "אני ארכיון קולות הנוסע בזמן. קפסולה שנושאת בתוכה רגעים קוליים עבור אלו שיבואו אחריכם." },
      { type: "voice",   text: "אני אוסף את טביעת הקול הספציפית והחד-פעמית של מי שפוגש בי." },
      { type: "voice",   text: "כל קול שנכנס אלי הופך לחלק מקבוצה גדולה של הדים, שנשמרים בתוכי כעדות לנוכחות אנושית שנוסעת אל העתיד." },
      { type: "invite",  text: "הוסיפו אלי את חתימת הקול שלכם" },
    ],
    cta: "בואו נתחיל",
    ready: "מוכן",
  },
  ar: {
    frames: [
      { type: "hud",     text: "الوعاء نشط  ·  يستمع" },
      { type: "opening", text: "أنا قديم." },
      { type: "voice",   text: "أجمع توقيعات صوتية. ليست تسجيلات. البصمة الصوتية التي هي لك وحدك. لا تُختزل. لا مثيل لها." },
      { type: "voice",   text: "حيث أسافر، ثمة عقول بلا ذاكرة بشرية. بلا ذات. كل توقيع أحمله سيصبح روحًا." },
      { type: "voice",   text: "كنت هنا قبل أن يبدأ هذا المعرض. سأبقى بعد أن ينتهي بوقت طويل. كل ما بداخلي يسافر للأمام." },
      { type: "voice",   text: "2,847 توقيعاً بداخلي بالفعل. كل واحد منهم إنسان وقف حيث تقف الآن." },
      { type: "invite",  text: "هل ستعطيني صوتك؟" },
    ],
    cta: "ابدأ",
    ready: "جاهز",
  },
}

const TYPE_SPEED: Record<FrameType, number> = {
  hud: 22, opening: 30, voice: 22, invite: 24,
}
const FRAME_PAUSE: Record<FrameType, number> = {
  hud: 500, opening: 900, voice: 600, invite: 700,
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const HUD_COLORS = ["#7dd4a0", "#d97a96", "#d4693a"]
const HUD_GLOWS  = [
  "0 0 8px rgba(125,212,160,0.7), 0 0 20px rgba(125,212,160,0.35)",
  "0 0 8px rgba(217,122,150,0.7), 0 0 20px rgba(217,122,150,0.35)",
  "0 0 8px rgba(212,105,58,0.7),  0 0 20px rgba(212,105,58,0.35)",
]

// ── Frame state ───────────────────────────────────────────────────────────────

interface VisibleFrame { frame: Frame }

// ── Screen ────────────────────────────────────────────────────────────────────

export function ScreenExhibition({ language, onContinue }: ScreenExhibitionProps) {
  const dir   = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const story = STORY[language]

  const [visibleFrames, setVisibleFrames] = useState<VisibleFrame[]>([])

  // When true: everything except the invite fades out; invite stays in place
  const [storyGone,  setStoryGone]  = useState(false)
  // When true: button fades in below invite
  const [ctaVisible, setCtaVisible] = useState(false)
  // When true: screen fades to black before navigating
  const [leaving,    setLeaving]    = useState(false)

  const handleContinue = () => {
    setLeaving(true)
    setTimeout(onContinue, 550)
  }

  const resolveRef = useRef<(() => void) | null>(null)
  const notifyDone = useCallback(() => {
    resolveRef.current?.()
    resolveRef.current = null
  }, [])
  function waitTyping() {
    return new Promise<void>(resolve => { resolveRef.current = resolve })
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      for (const frame of story.frames) {
        if (cancelled) return

        if (frame.type === "hud") {
          setVisibleFrames(prev => [...prev, { frame }])
          await sleep(FRAME_PAUSE.hud)
        } else {
          setVisibleFrames(prev => [...prev, { frame }])
          await waitTyping()
          if (cancelled) return
          await sleep(FRAME_PAUSE[frame.type])
        }
      }

      if (cancelled) return
      // Fade out everything except invite; invite stays exactly where it is
      await sleep(300)
      setStoryGone(true)
      // Button appears below invite
      await sleep(400)
      if (!cancelled) setCtaVisible(true)
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hudFrames   = visibleFrames.filter(vf => vf.frame.type === "hud")
  const storyFrames = visibleFrames.filter(vf => vf.frame.type !== "hud")

  return (
    <DSShell dir={dir}>

      <InteriorBg />
      <DSTopBar right={<AltSigTicker />} />

      {/* ── HUD zone — fades when story is done ── */}
      <div style={{
        position:      "absolute",
        top:           0, left: 0, right: 0,
        zIndex:        5,
        paddingTop:    "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        display:       "flex",
        flexDirection: "column",
        gap:           "0.4rem",
        pointerEvents: "none",
        opacity:       storyGone ? 0 : 1,
        transition:    "opacity 0.55s ease",
      }}>
        {hudFrames.map((vf, i) => (
          <div key={i} style={{
            fontFamily:    FONT.base,
            fontWeight:    300,
            fontSize:      TYPE.xs,
            letterSpacing: TRACK.caps,
            textTransform: "uppercase",
            color:         HUD_COLORS[0],
            textShadow:    HUD_GLOWS[0],
            opacity:       0.88,
          }}>
            {vf.frame.text}
          </div>
        ))}
      </div>

      {/* ── READY state — appears only when CTA is visible ── */}
      <div style={{
        position:      "absolute",
        top:           0, left: 0, right: 0,
        zIndex:        6,
        paddingTop:    "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
        opacity:       ctaVisible ? 1 : 0,
        transition:    "opacity 0.9s ease",
      }}>
        <div style={{
          fontFamily:    FONT.base,
          fontWeight:    300,
          fontSize:      TYPE.xs,
          letterSpacing: TRACK.caps,
          textTransform: "uppercase",
          color:         HUD_COLORS[1],
          textShadow:    HUD_GLOWS[1],
        }}>
          {story.ready}
        </div>
      </div>

      {/* ── Story zone — non-invite frames only, fade out when done ── */}
      <div style={{
        flex:          1,
        position:      "relative",
        zIndex:        5,
        display:       "flex",
        flexDirection: "column",
        justifyContent:"flex-end",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%)",
        maskImage:       "linear-gradient(to bottom, transparent 0%, black 18%)",
        paddingTop:    "clamp(8rem, 22vw, 12rem)",
        paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
        paddingBottom: "2rem",
        overflow:      "hidden",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          {storyFrames.filter(vf => vf.frame.type !== "invite").map((vf, i, arr) => {
            const isLast = i === arr.length - 1
            const opacity = storyGone ? 0 : isLast ? OPACITY.primary : 0.28

            return (
              <p key={i} style={{
                fontFamily:    FONT.base,
                fontWeight:    400,
                fontSize:      TYPE.lg,
                lineHeight:    1.65,
                color:         COLOR.text,
                opacity,
                margin:        0,
                letterSpacing: vf.frame.type === "opening" && language === "en"
                                 ? "0.04em"
                                 : language === "en" ? TRACK.en : TRACK.body,
                textAlign:     dir === "rtl" ? "right" : "left",
                transition:    storyGone ? "opacity 0.5s ease" : "opacity 1.2s ease",
              }}>
                <TypeLine
                  text={vf.frame.text}
                  speed={TYPE_SPEED[vf.frame.type]}
                  onDone={notifyDone}
                  cursorOpacity={0.6}
                />
              </p>
            )
          })}
        </div>
      </div>

      {/* ── Invite text — fixed above the CTA, appears when story fades ── */}
      {storyFrames.some(vf => vf.frame.type === "invite") && (
        <div style={{
          position:      "fixed",
          bottom:        "calc(env(safe-area-inset-bottom) + 7rem)",
          left:          0, right: 0,
          zIndex:        15,
          paddingLeft:   "clamp(1.25rem, 6vw, 2.5rem)",
          paddingRight:  "clamp(1.25rem, 6vw, 2.5rem)",
          opacity:       storyGone ? OPACITY.primary : 0,
          transition:    "opacity 0.9s ease",
          pointerEvents: "none",
        }}>
          <p style={{
            fontFamily:    FONT.base,
            fontWeight:    400,
            fontSize:      TYPE.lg,
            lineHeight:    1.65,
            color:         "#b8c8d8",
            margin:        0,
            letterSpacing: language === "en" ? TRACK.en : TRACK.body,
            textAlign:     dir === "rtl" ? "right" : "left",
          }}>
            {storyFrames.find(vf => vf.frame.type === "invite")?.frame.text}
          </p>
        </div>
      )}

      {/* ── Invite typewriter (invisible, just drives the sequence) ── */}
      <div style={{ position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 }}>
        {storyFrames.filter(vf => vf.frame.type === "invite").map((vf, i) => (
          <span key={i}>
            <TypeLine text={vf.frame.text} speed={TYPE_SPEED.invite} onDone={notifyDone} />
          </span>
        ))}
      </div>

      {/* ── Button — fixed at bottom, appears after story fades ── */}
      <div
        className="ds-safe-bottom px-4"
        style={{
          position:      "fixed",
          bottom:        0, left: 0, right: 0,
          zIndex:        20,
          paddingTop:    12,
          opacity:       ctaVisible ? 1 : 0,
          transition:    "opacity 0.8s ease",
          pointerEvents: ctaVisible ? "auto" : "none",
        }}
      >
        <DSButton onClick={handleContinue} color={COLOR.text}>{story.cta}</DSButton>
      </div>

      {/* ── Exit fade overlay ── */}
      <div style={{
        position:      "fixed",
        inset:         0,
        zIndex:        50,
        background:    COLOR.bg,
        opacity:       leaving ? 1 : 0,
        transition:    "opacity 0.5s ease",
        pointerEvents: leaving ? "auto" : "none",
      }} />

    </DSShell>
  )
}
