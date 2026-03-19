"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { LocationState } from "@/lib/types"
import { MapPin } from "lucide-react"

interface ScreenLocationProps {
  venueId: string | null
  venueName: string | null
  onContinue: (location: LocationState) => void
  onBack: () => void
}

const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile",
  "China", "Colombia", "Czech Republic", "Denmark", "Finland", "France",
  "Germany", "Greece", "India", "Ireland", "Israel", "Italy", "Japan",
  "Mexico", "Netherlands", "New Zealand", "Norway", "Poland", "Portugal",
  "South Korea", "Spain", "Sweden", "Switzerland", "United Kingdom", "United States",
]

export function ScreenLocation({ venueId, venueName, onContinue, onBack }: ScreenLocationProps) {
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [geoState, setGeoState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  if (venueId && venueName) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
              <MapPin className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Collected at
            </span>
            <p className="text-xl font-medium">{venueName}</p>
          </div>
          <Button
            onClick={() =>
              onContinue({
                sourceType: "exhibition",
                venueId,
                venueName,
                country: "",
                city: "",
                lat: null,
                lng: null,
              })
            }
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Continue
          </Button>
        </div>
      </div>
    )
  }

  const handleGeolocation = () => {
    setGeoState("loading")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoState("success")
      },
      () => {
        setGeoState("error")
      }
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-lg font-medium">Where are you recording from?</h2>
          <p className="text-sm text-muted-foreground">Optional, but helps place your signature.</p>
        </div>

        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="country" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Country
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none ring-ring focus:ring-2"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="city" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              City
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter city"
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none ring-ring placeholder:text-muted-foreground focus:ring-2"
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={handleGeolocation}
            disabled={geoState === "loading"}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            <MapPin className="h-4 w-4" />
            {geoState === "loading"
              ? "Locating..."
              : geoState === "success"
                ? "Location added"
                : geoState === "error"
                  ? "Could not get location"
                  : "Add precise location"}
          </button>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={() =>
              onContinue({
                sourceType: "remote",
                venueId: null,
                venueName: null,
                country,
                city,
                lat: coords?.lat ?? null,
                lng: coords?.lng ?? null,
              })
            }
            size="lg"
            className="h-14 w-full rounded-xl text-base font-medium"
          >
            Continue
          </Button>
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
