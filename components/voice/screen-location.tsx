"use client"

import { useState, useRef, useLayoutEffect } from "react"
import type { LocationState } from "@/lib/types"
import type { Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSButton, DSBack, DSInput, DSSelect, AltSigTicker, InteriorBg, COLOR, FONT, TYPE, TRACK, OPACITY, TypeLine } from "./ds"
import { VoiceSphere, SPHERE_FIXED, SPHERE_SIZE } from "./voice-sphere"

interface ScreenLocationProps {
  language:   Language
  venueId:    string | null
  venueName:  string | null
  onContinue: (location: LocationState) => void
  onBack:     () => void
}

const COPY: Record<Language, {
  hud: string; title: string; venueLine: string
  cta: string; locating: string; noLocation: string; privacy: string; back: string
}> = {
  en: {
    hud:        "ALMOST THERE",
    title:      "Before we finish, I'd love to know where your voice is coming from.",
    venueLine:  "You're at the exhibition. Your location is already confirmed.",
    cta:        "SHARE LOCATION",
    locating:   "LOCATING…",
    noLocation: "Continue without location",
    privacy:    "Proceeding to the next step means you consent to your voice signature being stored as part of this artwork.",
    back:       "← back",
  },
  he: {
    hud:        "עוד רגע",
    title:      "לפני סיום אשמח לדעת מאיפה הקול שלך מגיע",
    venueLine:  "אתה בתערוכה. המיקום שלך כבר מאושר.",
    cta:        "שיתוף מיקום",
    locating:   "מאתר…",
    noLocation: "להמשיך ללא מיקום",
    privacy:    "המעבר לשלב הבא מהווה הסכמה לשמירת חתימת הקול כחלק מהיצירה",
    back:       "← חזרה",
  },
  ar: {
    hud:        "لحظة أخيرة",
    title:      "قبل الانتهاء، أودّ أن أعرف من أين يأتي صوتك.",
    venueLine:  "أنت في المعرض. موقعك مؤكّد بالفعل.",
    cta:        "مشاركة الموقع",
    locating:   "جارٍ التحديد…",
    noLocation: "المتابعة بدون موقع",
    privacy:    "المتابعة للخطوة التالية تعني موافقتك على تخزين بصمتك الصوتية كجزء من هذا العمل.",
    back:       "← رجوع",
  },
}

const COUNTRIES = [
  "", "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile",
  "China", "Colombia", "Czech Republic", "Denmark", "Finland", "France",
  "Germany", "Greece", "India", "Ireland", "Israel", "Italy", "Japan",
  "Mexico", "Netherlands", "New Zealand", "Norway", "Poland", "Portugal",
  "South Korea", "Spain", "Sweden", "Switzerland", "United Kingdom", "United States",
]

export function ScreenLocation({ language, venueId, venueName, onContinue, onBack }: ScreenLocationProps) {
  const dir  = language === "en" ? "ltr" : "rtl" as "ltr" | "rtl"
  const copy = COPY[language]

  const [geoState, setGeoState] = useState<"idle" | "locating" | "done" | "failed" | "manual">("idle")
  const ctaRef = useRef<HTMLDivElement>(null)

  // Hide before first paint — keeps opacity out of JSX so React never re-applies it
  useLayoutEffect(() => {
    const el = ctaRef.current
    if (el) { el.style.opacity = "0"; el.style.pointerEvents = "none" }
  }, [])

  function showCta() {
    const el = ctaRef.current
    if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto" }
  }
  const [country,  setCountry]  = useState("")
  const [city,     setCity]     = useState("")

  // ── Venue mode ────────────────────────────────────────────────────────────
  if (venueId && venueName) {
    return (
      <DSShell dir={dir}>
        <InteriorBg />
        <DSTopBar right={<AltSigTicker />} />

        <div style={SPHERE_FIXED}><div style={SPHERE_SIZE}>
          <VoiceSphere analyser={null} isRecording={false} mode="ready" />
        </div></div>

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          paddingTop: "clamp(4.5rem, 13vw, 6rem)",
          paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
          paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
          pointerEvents: "none",
        }}>
          <div style={{ fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs, letterSpacing: TRACK.caps, textTransform: "uppercase", color: "#7dd4a0", textShadow: "0 0 8px rgba(125,212,160,0.6), 0 0 20px rgba(125,212,160,0.28)", opacity: 0.95, direction: "ltr" }}>
            {copy.hud}
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-end"
          style={{ paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)", paddingRight: "clamp(1.25rem, 6vw, 2.5rem)", paddingBottom: "clamp(2rem, 8vw, 3.5rem)" }}>
          <p style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.65, color: COLOR.text, opacity: OPACITY.primary, margin: 0, direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}>
            <TypeLine text={copy.venueLine} speed={22} onDone={showCta} />
          </p>
        </div>

        <div ref={ctaRef} className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4" style={{ paddingTop: 8, transition: "opacity 0.9s ease" }}>
          <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color: COLOR.text, opacity: OPACITY.tertiary * 0.7, textAlign: dir === "rtl" ? "right" : "left", display: "block" }}>
            {copy.privacy}
          </span>
          <DSButton onClick={() => onContinue({ sourceType: "exhibition", venueId, venueName, country: "", city: "", lat: null, lng: null })} color={COLOR.text}>
            {copy.cta}
          </DSButton>
        </div>
      </DSShell>
    )
  }

  // ── Remote / GPS mode ─────────────────────────────────────────────────────
  const handleGPS = () => {
    setGeoState("locating")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("done")
        onContinue({ sourceType: "remote", venueId: null, venueName: null, country: "", city: "", lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => setGeoState("failed"),
      { timeout: 10000 }
    )
  }

  const handleSkip = () => setGeoState("manual")

  return (
    <DSShell dir={dir}>
      <InteriorBg />
      <DSTopBar right={<AltSigTicker />} />

      <div style={SPHERE_FIXED}><div style={SPHERE_SIZE}>
        <VoiceSphere analyser={null} isRecording={false} mode="ready" />
      </div></div>

      {/* HUD */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: "clamp(4.5rem, 13vw, 6rem)",
        paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 6vw, 2.5rem)",
        pointerEvents: "none",
      }}>
        <div style={{ fontFamily: FONT.base, fontWeight: 300, fontSize: TYPE.xs, letterSpacing: TRACK.caps, textTransform: "uppercase", color: "#7dd4a0", textShadow: "0 0 8px rgba(125,212,160,0.6), 0 0 20px rgba(125,212,160,0.28)", opacity: 0.95, direction: "ltr" }}>
          {copy.hud}
        </div>
      </div>

      {/* Vessel text — bottom anchored, sized to stay below the sphere */}
      <div className="relative z-10 flex flex-1 flex-col justify-end"
        style={{ paddingLeft: "clamp(1.25rem, 6vw, 2.5rem)", paddingRight: "clamp(1.25rem, 6vw, 2.5rem)", paddingBottom: "clamp(0.75rem, 3vw, 1.25rem)" }}>
        <p style={{ fontFamily: FONT.base, fontWeight: 400, fontSize: TYPE.lg, lineHeight: 1.65, color: COLOR.text, opacity: OPACITY.primary, margin: 0, direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}>
          <TypeLine text={copy.title} speed={22} onDone={showCta} />
        </p>
      </div>

      {/* CTA + skip / manual form */}
      <div ref={ctaRef} className="ds-safe-bottom relative z-10 flex flex-col gap-2 px-4"
        style={{ paddingTop: 6, transition: "opacity 0.9s ease" }}>

        {geoState === "manual" ? (
          /* Manual country/city form — scrollable so it never pushes into the sphere */
          <div style={{
            maxHeight: "42dvh",
            overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 8,
            WebkitOverflowScrolling: "touch",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DSSelect
                id="country" label={language === "he" ? "מדינה" : language === "ar" ? "الدولة" : "Country"}
                value={country} onChange={setCountry}
                options={COUNTRIES.map(c => ({ value: c, label: c || (language === "he" ? "בחירת מדינה" : language === "ar" ? "اختر الدولة" : "Select country") }))}
              />
              <DSInput
                id="city" label={language === "he" ? "עיר" : language === "ar" ? "المدينة" : "City"}
                value={city} onChange={setCity}
                placeholder={language === "he" ? "שם העיר" : language === "ar" ? "اسم المدينة" : "City name"}
              />
            </div>
            <span style={{ fontFamily: FONT.base, fontSize: "0.65rem", letterSpacing: TRACK.sm, color: COLOR.text, opacity: OPACITY.tertiary * 0.7, textAlign: dir === "rtl" ? "right" : "left", display: "block" }}>
              {copy.privacy}
            </span>
            <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
              <DSBack onClick={() => onContinue({ sourceType: "remote", venueId: null, venueName: null, country: "", city: "", lat: null, lng: null })}>
                {language === "he" ? "דילוג על מיקום" : language === "ar" ? "تخطّ الموقع" : "Skip location"}
              </DSBack>
            </div>
            <DSButton onClick={() => onContinue({ sourceType: "remote", venueId: null, venueName: null, country, city, lat: null, lng: null })} color={COLOR.text}>
              {language === "he" ? "המשך" : language === "ar" ? "متابعة" : "CONTINUE"}
            </DSButton>
          </div>
        ) : (
          /* GPS default */
          <>
            {geoState === "failed" && (
              <p style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color: COLOR.error, opacity: 0.8, margin: 0, textAlign: dir === "rtl" ? "right" : "left" }}>
                {language === "he" ? "לא הצלחתי לאתר." : language === "ar" ? "تعذّر التحديد." : "Couldn't locate."}
              </p>
            )}
            <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color: COLOR.text, opacity: OPACITY.tertiary * 0.7, textAlign: dir === "rtl" ? "right" : "left", display: "block" }}>
              {copy.privacy}
            </span>
            <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
              <DSBack onClick={geoState === "locating" ? undefined : handleSkip}>{copy.noLocation}</DSBack>
            </div>
            <DSButton onClick={geoState === "locating" ? undefined : handleGPS} disabled={geoState === "locating"} color={COLOR.text}>
              {geoState === "locating" ? copy.locating : copy.cta}
            </DSButton>
          </>
        )}
      </div>
    </DSShell>
  )
}
