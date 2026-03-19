"use client"

import { useState } from "react"
import type { LocationState } from "@/lib/types"
import { MapPin } from "lucide-react"
import { translations, type Language } from "@/lib/i18n"
import { DSShell, DSTopBar, DSBlock, DSLabel, DSButton, DSBack, DSDivider, DSInput, DSSelect, SignalBar, ACCENT, COLOR, FONT } from "./ds"

interface ScreenLocationProps {
  language:  Language
  venueId:   string | null
  venueName: string | null
  onContinue: (location: LocationState) => void
  onBack: () => void
}

const COUNTRIES = [
  "", "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile",
  "China", "Colombia", "Czech Republic", "Denmark", "Finland", "France",
  "Germany", "Greece", "India", "Ireland", "Israel", "Italy", "Japan",
  "Mexico", "Netherlands", "New Zealand", "Norway", "Poland", "Portugal",
  "South Korea", "Spain", "Sweden", "Switzerland", "United Kingdom", "United States",
]

export function ScreenLocation({ language, venueId, venueName, onContinue, onBack }: ScreenLocationProps) {
  const t   = translations[language].location
  const dir = translations[language].direction

  const [country,  setCountry]  = useState("")
  const [city,     setCity]     = useState("")
  const [geoState, setGeoState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [coords,   setCoords]   = useState<{ lat: number; lng: number } | null>(null)

  if (venueId && venueName) {
    return (
      <DSShell dir={dir}>
        <DSTopBar left={<SignalBar />} right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: ACCENT, opacity: 0.55 }}>{t.label}</span>} />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-2">
            <DSBlock>
              <div className="flex flex-col items-center gap-3 text-center">
                <DSLabel spacing="0.4em" opacity={0.65}>{t.collectedAt}</DSLabel>
                <p style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: "clamp(1.4rem, 8vw, 2.2rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: ACCENT, textShadow: `0 0 30px rgba(200,160,72,0.4)` }}>{venueName}</p>
                <DSDivider />
                <DSLabel opacity={0.45}>{t.venueConfirmed}</DSLabel>
              </div>
            </DSBlock>
          </div>
        </div>
        <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
          <DSButton onClick={() => onContinue({ sourceType: "exhibition", venueId, venueName, country: "", city: "", lat: null, lng: null })}>{t.continue}</DSButton>
        </div>
      </DSShell>
    )
  }

  const handleGeo = () => {
    setGeoState("loading")
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState("success") },
      ()    => setGeoState("error")
    )
  }

  const geoLabel  = geoState === "loading" ? t.locating : geoState === "success" ? t.locationAdded : geoState === "error" ? t.couldNotLocate : t.addLocation
  const geoColor  = geoState === "success" ? ACCENT : geoState === "error" ? "#c05050" : COLOR.secondary
  const geoBorder = geoState === "success" ? ACCENT : geoState === "error" ? "#c05050" : COLOR.veryDim

  return (
    <DSShell dir={dir}>
      <DSTopBar left={<SignalBar />} right={<span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: ACCENT, opacity: 0.55 }}>{t.label}</span>} />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <DSLabel spacing="0.4em" opacity={0.65}>{t.heading}</DSLabel>
            <p style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: "clamp(1.2rem, 7vw, 1.8rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: ACCENT }}>{t.title}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <DSSelect id="country" label={t.country} value={country} onChange={setCountry} options={COUNTRIES.map((c) => ({ value: c, label: c || t.selectCountry }))} />
            <DSInput id="city" label={t.city} value={city} onChange={setCity} placeholder={t.enterCity} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: COLOR.veryDim }} />
            <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.2em", color: COLOR.secondary, opacity: 0.6 }}>{t.or}</span>
            <div style={{ flex: 1, height: 1, background: COLOR.veryDim }} />
          </div>

          <button onClick={handleGeo} disabled={geoState === "loading" || geoState === "success"}
            style={{ background: "none", border: `1px solid ${geoBorder}`, color: geoColor, fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: geoState === "loading" || geoState === "success" ? "default" : "pointer", opacity: geoState === "loading" ? 0.6 : 1, width: "100%" }}>
            <MapPin style={{ width: 13, height: 13 }} />
            {geoLabel}
          </button>

          <DSLabel opacity={0.4}>{t.optional}</DSLabel>
        </div>
      </div>

      <div className="ds-safe-bottom relative z-10 flex flex-col gap-3 px-4">
        <div className="flex justify-end px-1 pb-1"><DSBack onClick={onBack}>{t.back}</DSBack></div>
        <DSButton onClick={() => onContinue({ sourceType: "remote", venueId: null, venueName: null, country, city, lat: coords?.lat ?? null, lng: coords?.lng ?? null })}>{t.continue}</DSButton>
      </div>
    </DSShell>
  )
}
