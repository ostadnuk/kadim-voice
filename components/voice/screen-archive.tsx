"use client"

import { useEffect, useState, useCallback } from "react"
import { SignatureRing } from "./signature-ring"
import { Waveform } from "./waveform"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { fetchArchive, VENUES } from "@/lib/mock-api"
import type { ArchiveEntry } from "@/lib/types"
import { Play, Pause } from "lucide-react"
import {
  DSShell, DSTopBar, DSBack, DSDivider, DSStatusLine,
  SignalBar, COLOR, FONT,
} from "./ds"
import { Globe3D } from "./globe-3d"
import type { Language } from "@/lib/i18n"

interface ScreenArchiveProps {
  language?: Language
  onBack: () => void
}

const LANG_COLOR: Record<Language, string> = {
  en: "#c8a048",
  he: "#c07848",
  ar: "#50b09a",
}

const LANG_FONT: Record<Language, string> = {
  en: "'narkiss-yair-variable', sans-serif",
  he: "'narkiss-yair-variable', sans-serif",
  ar: "'narkiss-yair-variable', sans-serif",
}

const T: Record<Language, {
  title: string; voices: (n: number) => string; acrossTime: string
  worldDist: string; grid: string; globe: string
  allSources: string; exhibition: string; remote: string; allVenues: string
  loading: string; noEntries: string; prev: string; next: string
  sigLabel: string; timestamp: string; location: string; duration: string; source: string
}> = {
  en: {
    title: "Signatures Archive",
    voices: (n) => `${n} ${n === 1 ? "voice" : "voices"}`,
    acrossTime: "across time",
    worldDist: "WORLD DISTRIBUTION",
    grid: "GRID", globe: "GLOBE",
    allSources: "ALL SOURCES", exhibition: "EXHIBITION", remote: "REMOTE", allVenues: "ALL VENUES",
    loading: "LOADING...", noEntries: "NO ENTRIES FOUND",
    prev: "← PREV", next: "NEXT →",
    sigLabel: "VOICE SIGNATURE",
    timestamp: "Timestamp", location: "Location", duration: "Duration", source: "Source",
  },
  he: {
    title: "ארכיון חתימות",
    voices: (n) => `${n} קולות`,
    acrossTime: "דרך הזמן",
    worldDist: "פיזור עולמי",
    grid: "רשת", globe: "גלובוס",
    allSources: "כל המקורות", exhibition: "תערוכה", remote: "מרחוק", allVenues: "כל המקומות",
    loading: "טוען...", noEntries: "לא נמצאו רשומות",
    prev: "← הקודם", next: "הבא →",
    sigLabel: "חתימת קול",
    timestamp: "חותמת זמן", location: "מיקום", duration: "משך", source: "מקור",
  },
  ar: {
    title: "أرشيف التوقيعات",
    voices: (n) => `${n} أصوات`,
    acrossTime: "عبر الزمن",
    worldDist: "التوزيع العالمي",
    grid: "شبكة", globe: "كرة أرضية",
    allSources: "كل المصادر", exhibition: "معرض", remote: "عن بُعد", allVenues: "كل الأماكن",
    loading: "جارٍ التحميل...", noEntries: "لا توجد نتائج",
    prev: "← السابق", next: "التالي →",
    sigLabel: "توقيع صوتي",
    timestamp: "الطابع الزمني", location: "الموقع", duration: "المدة", source: "المصدر",
  },
}

function WorldClock({ color }: { color: string }) {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const utc  = time.toISOString().replace("T", " ").slice(0, 19)
  const unix = Math.floor(time.getTime() / 1000)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.15em", color, opacity: 0.6 }}>UTC  {utc}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.12em", color, opacity: 0.38 }}>UNIX {unix}</div>
    </div>
  )
}

export function ScreenArchive({ language = "en", onBack }: ScreenArchiveProps) {
  const color = LANG_COLOR[language]
  const font  = LANG_FONT[language]
  const t     = T[language]
  const dir   = language === "en" ? "ltr" : "rtl"

  const [entries,       setEntries]       = useState<ArchiveEntry[]>([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<{ sourceType?: string; venueId?: string }>({})
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null)
  const [playingId,     setPlayingId]     = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const result = await fetchArchive(page, 12, filter)
    setEntries(result.entries)
    setTotal(result.total)
    setLoading(false)
  }, [page, filter])

  useEffect(() => { loadEntries() }, [loadEntries])

  const handleFilterChange = (key: string, value: string) => {
    setPage(1)
    if (key === "sourceType") {
      setFilter((prev) => ({ ...prev, sourceType: value || undefined, venueId: value === "exhibition" ? prev.venueId : undefined }))
    } else {
      setFilter((prev) => ({ ...prev, [key]: value || undefined }))
    }
  }

  const fmtDate  = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const fmtTime  = (s: string) => new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const locLabel = (e: ArchiveEntry) => e.venueName || [e.city, e.country].filter(Boolean).join(", ") || "Remote"
  const totalPages = Math.ceil(total / 12)

  const selectStyle: React.CSSProperties = {
    height: 32, background: "transparent",
    border: `1px solid ${COLOR.veryDim}`, borderRadius: 0,
    color: COLOR.secondary, fontFamily: FONT.mono, fontSize: 10,
    padding: "0 10px", outline: "none", appearance: "none",
    WebkitAppearance: "none", letterSpacing: "0.15em", cursor: "pointer",
  }

  return (
    <DSShell dir={dir}>
      <DSTopBar
        left={<SignalBar color={color} />}
        right={<WorldClock color={color} />}
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-8">

        {/* header */}
        <div style={{ borderBottom: `1px solid ${COLOR.veryDim}`, paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontFamily: font, fontWeight: 700, fontSize: "clamp(1.3rem, 7vw, 2rem)", letterSpacing: "0.04em", color, lineHeight: 1 }}>
                {t.title}
              </h1>
              <p style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", color, opacity: 0.5, marginTop: 4 }}>
                {t.voices(total)} · {t.acrossTime}
              </p>
            </div>
            <DSBack onClick={onBack} />
          </div>
        </div>

        {/* globe */}
        <div style={{ marginBottom: 24 }}>
          <Globe3D entries={entries} height={320} />
        </div>

        {/* filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <select value={filter.sourceType || ""} onChange={(e) => handleFilterChange("sourceType", e.target.value)} style={selectStyle}>
            <option value="" style={{ background: COLOR.bg }}>{t.allSources}</option>
            <option value="exhibition" style={{ background: COLOR.bg }}>{t.exhibition}</option>
            <option value="remote" style={{ background: COLOR.bg }}>{t.remote}</option>
          </select>
          {filter.sourceType === "exhibition" && (
            <select value={filter.venueId || ""} onChange={(e) => handleFilterChange("venueId", e.target.value)} style={selectStyle}>
              <option value="" style={{ background: COLOR.bg }}>{t.allVenues}</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id} style={{ background: COLOR.bg }}>{v.name.toUpperCase()}</option>
              ))}
            </select>
          )}
        </div>

        {/* grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color, opacity: 0.45 }}>{t.loading}</span>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", color: COLOR.secondary }}>{t.noEntries}</span>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: COLOR.veryDim }}>
              {entries.map((entry) => (
                <button key={entry.id} onClick={() => setSelectedEntry(entry)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  background: COLOR.bg, padding: "20px 12px", cursor: "pointer", textAlign: "center",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0d0b07" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = COLOR.bg }}
                >
                  <SignatureRing points={entry.signaturePoints} size={68} strokeWidth={1} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: "0.12em", color, opacity: 0.5 }}>
                      {fmtDate(entry.createdAt)}
                    </span>
                    <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.05em", color: COLOR.text, lineHeight: 1.3 }}>
                      {locLabel(entry)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 24 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ background: "none", border: "none", fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", color, opacity: page === 1 ? 0.2 : 0.6, cursor: page === 1 ? "default" : "pointer" }}>
                  [ {t.prev} ]
                </button>
                <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.1em", color, opacity: 0.4 }}>
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ background: "none", border: "none", fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", color, opacity: page === totalPages ? 0.2 : 0.6, cursor: page === totalPages ? "default" : "pointer" }}>
                  [ {t.next} ]
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* entry detail */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        {selectedEntry && (
          <DialogContent style={{ background: COLOR.bg, border: `1px solid ${COLOR.veryDim}`, borderRadius: 0, color: COLOR.text, fontFamily: FONT.mono }}>
            <DialogHeader>
              <DialogTitle className="sr-only">Voice Signature Detail</DialogTitle>
              <DialogDescription className="sr-only">
                Details for voice signature recorded on {fmtDate(selectedEntry.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.3em", color, opacity: 0.6 }}>{t.sigLabel}</span>
              <SignatureRing points={selectedEntry.signaturePoints} size={140} animated />
              <div style={{ width: "100%" }}>
                <Waveform peaks={selectedEntry.waveformPeaks} height={40} />
                <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                  <button
                    onClick={() => setPlayingId(playingId === selectedEntry.id ? null : selectedEntry.id)}
                    aria-label={playingId === selectedEntry.id ? "Pause" : "Play"}
                    style={{ width: 38, height: 38, background: "transparent", border: `1px solid ${color}`, opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color }}
                  >
                    {playingId === selectedEntry.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <DSDivider color={color} opacity={0.1} />
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: t.timestamp, value: `${fmtDate(selectedEntry.createdAt)}  ${fmtTime(selectedEntry.createdAt)}` },
                  { label: t.location,  value: locLabel(selectedEntry) },
                  { label: t.duration,  value: `${selectedEntry.durationSec}s` },
                  { label: t.source,    value: selectedEntry.sourceType.toUpperCase() },
                ].map((row, i, arr) => (
                  <div key={row.label}>
                    <DSStatusLine label={row.label} value={row.value} />
                    {i < arr.length - 1 && <DSDivider opacity={0.06} />}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </DSShell>
  )
}
