"use client"

import { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { ChladniThumbnail } from "./chladni-thumbnail"
import { Waveform } from "./waveform"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import type { ArchiveResponse, ArchiveEntry } from "@/lib/types"
import { Play, Pause } from "lucide-react"
import {
  DSShell, DSTopBar, DSBack, DSDivider, DSStatusLine,
  COLOR, FONT, TYPE, TRACK, OPACITY, TOUCH_MIN,
} from "./ds"
import type { Language } from "@/lib/i18n"

const ArchiveCanvasDynamic = dynamic(
  () => import("./archive-canvas").then(m => m.ArchiveCanvas),
  { ssr: false }
)

// ── i18n ──────────────────────────────────────────────────────────────────────

const T: Record<Language, {
  title: string
  voices: (n: number) => string
  collective: string
  collectiveSub: string
  individuals: string
  loading: string
  noEntries: string
  prev: string
  next: string
  sigLabel: string
  timestamp: string
  location: string
  duration: string
  source: string
}> = {
  en: {
    title:         "Signatures Archive",
    voices:        (n) => `${n.toLocaleString()} ${n === 1 ? "voice" : "voices"}`,
    collective:    "COLLECTIVE PATTERN",
    collectiveSub: "The sum of every voice recorded into Kadim",
    individuals:   "INDIVIDUAL SIGNATURES",
    loading:       "LOADING...",
    noEntries:     "NO ENTRIES YET",
    prev:          "← PREV",
    next:          "NEXT →",
    sigLabel:      "VOICE SIGNATURE",
    timestamp:     "Timestamp",
    location:      "Location",
    duration:      "Duration",
    source:        "Source",
  },
  he: {
    title:         "ארכיון חתימות",
    voices:        (n) => `${n.toLocaleString()} קולות`,
    collective:    "דפוס קולקטיבי",
    collectiveSub: "סכום כל הקולות שנקלטו בקדים",
    individuals:   "חתימות אישיות",
    loading:       "טוען...",
    noEntries:     "אין רשומות עדיין",
    prev:          "← הקודם",
    next:          "הבא →",
    sigLabel:      "חתימת קול",
    timestamp:     "חותמת זמן",
    location:      "מיקום",
    duration:      "משך",
    source:        "מקור",
  },
  ar: {
    title:         "أرشيف التوقيعات",
    voices:        (n) => `${n.toLocaleString()} أصوات`,
    collective:    "النمط الجماعي",
    collectiveSub: "مجموع كل الأصوات المسجَّلة في قديم",
    individuals:   "التوقيعات الفردية",
    loading:       "جارٍ التحميل...",
    noEntries:     "لا توجد تسجيلات بعد",
    prev:          "← السابق",
    next:          "التالي →",
    sigLabel:      "توقيع صوتي",
    timestamp:     "الطابع الزمني",
    location:      "الموقع",
    duration:      "المدة",
    source:        "المصدر",
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function WorldClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const utc = time.toISOString().replace("T", " ").slice(0, 19)
  return (
    <div style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.caps, color: COLOR.secondary, opacity: 0.5 }}>
      UTC {utc}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

interface ScreenArchiveProps {
  language?: Language
  onBack:    () => void
}

const PAGE_SIZE = 12

export function ScreenArchive({ language = "en", onBack }: ScreenArchiveProps) {
  const t   = T[language]
  const dir = language === "en" ? "ltr" : "rtl"

  // Collective pattern
  const [collectiveSig,   setCollectiveSig]   = useState<number[] | null>(null)
  const [collectiveTotal, setCollectiveTotal] = useState(0)

  // Paginated individual entries
  const [entries,       setEntries]       = useState<ArchiveEntry[]>([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [loading,       setLoading]       = useState(true)

  // Detail dialog
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null)
  const [playingId,     setPlayingId]     = useState<string | null>(null)

  // ── Fetch collective on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/archive/collective")
      .then(r => r.json())
      .then(({ signaturePoints, total: tot }) => {
        setCollectiveSig(signaturePoints)
        setCollectiveTotal(tot)
      })
      .catch(console.error)
  }, [])

  // ── Fetch paginated entries ────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      const res    = await fetch(`/api/archive?${params}`)
      const result: ArchiveResponse = await res.json()
      setEntries(result.entries)
      setTotal(result.total)
    } catch (err) {
      console.error("Archive load error:", err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { loadEntries() }, [loadEntries])

  const fmtDate  = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const fmtTime  = (s: string) => new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const locLabel = (e: ArchiveEntry) => e.venueName || [e.city, e.country].filter(Boolean).join(", ") || "Remote"
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <DSShell dir={dir} className="overflow-y-auto">

      <DSTopBar
        left={<DSBack onClick={onBack} />}
        right={<WorldClock />}
      />

      {/* ── Collective pattern hero ──────────────────────────────────────── */}
      <div style={{
        position:   "relative",
        width:      "100%",
        height:     "clamp(260px, 52vw, 420px)",
        background: COLOR.bg,
        flexShrink: 0,
      }}>
        {collectiveSig ? (
          <ArchiveCanvasDynamic signaturePoints={collectiveSig} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps, color: COLOR.secondary, opacity: 0.4 }}>
              …
            </span>
          </div>
        )}

        {/* Overlay: count + label */}
        <div style={{
          position:  "absolute",
          bottom:    "clamp(1rem, 4vw, 1.75rem)",
          left:      "clamp(1.25rem, 6vw, 2.5rem)",
          right:     "clamp(1.25rem, 6vw, 2.5rem)",
          pointerEvents: "none",
          textAlign: dir === "rtl" ? "right" : "left",
        }}>
          <div style={{
            fontFamily: FONT.base, fontWeight: 600,
            fontSize: "clamp(1.6rem, 6vw, 2.4rem)",
            letterSpacing: "-0.01em",
            color: COLOR.text,
            lineHeight: 1,
          }}>
            {collectiveTotal.toLocaleString()}
          </div>
          <div style={{
            fontFamily: FONT.base, fontWeight: 300,
            fontSize: TYPE.xs, letterSpacing: TRACK.caps,
            color: "#c8d4f8", opacity: 0.7,
            marginTop: 4,
          }}>
            {t.voices(collectiveTotal).toUpperCase()} · {t.collective}
          </div>
          <div style={{
            fontFamily: FONT.base, fontWeight: 300,
            fontSize: TYPE.hud, letterSpacing: TRACK.sm,
            color: COLOR.text, opacity: OPACITY.tertiary * 0.8,
            marginTop: 3,
          }}>
            {t.collectiveSub}
          </div>
        </div>
      </div>

      {/* ── Individual signatures ────────────────────────────────────────── */}
      <div style={{ padding: "clamp(1.25rem, 6vw, 2rem) clamp(1.25rem, 6vw, 2rem) 4rem" }}>

        {/* Section label */}
        <div style={{
          fontFamily: FONT.base, fontWeight: 300,
          fontSize: TYPE.hud, letterSpacing: TRACK.caps,
          color: COLOR.secondary, opacity: 0.5,
          marginBottom: "clamp(0.75rem, 3vw, 1.25rem)",
          textTransform: "uppercase",
        }}>
          {t.individuals}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.sm, color: COLOR.secondary, opacity: 0.4 }}>
              {t.loading}
            </span>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps, color: COLOR.secondary, opacity: 0.4 }}>
              {t.noEntries}
            </span>
          </div>
        ) : (
          <>
            {/* Thumbnail grid — 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "clamp(0.75rem, 3vw, 1.25rem)" }}>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 8, background: "none", border: "none", cursor: "pointer",
                    padding: 0, textAlign: "center",
                  }}
                >
                  {/* Chladni pattern thumbnail */}
                  <div style={{
                    width: "100%", aspectRatio: "1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(200,212,248,0.04)",
                    borderRadius: "50%",
                    overflow: "hidden",
                  }}>
                    <ChladniThumbnail
                      signaturePoints={entry.signaturePoints}
                      size={80}
                      gridSize={72}
                    />
                  </div>

                  {/* Location + date */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
                    <span style={{
                      fontFamily: FONT.base, fontSize: TYPE.hud,
                      letterSpacing: "0.05em",
                      color: COLOR.text, opacity: OPACITY.secondary,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {locLabel(entry)}
                    </span>
                    <span style={{
                      fontFamily: FONT.base, fontSize: "0.6rem",
                      letterSpacing: TRACK.caps,
                      color: COLOR.secondary, opacity: 0.4,
                    }}>
                      {fmtDate(entry.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 32 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    background: "none", border: "none", fontFamily: FONT.base,
                    fontSize: TYPE.hud, letterSpacing: TRACK.caps,
                    color: COLOR.secondary,
                    opacity: page === 1 ? 0.2 : 0.6, cursor: page === 1 ? "default" : "pointer",
                    minHeight: TOUCH_MIN, display: "flex", alignItems: "center",
                  }}>
                  {t.prev}
                </button>
                <span style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: "0.1em", color: COLOR.secondary, opacity: OPACITY.tertiary }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    background: "none", border: "none", fontFamily: FONT.base,
                    fontSize: TYPE.hud, letterSpacing: TRACK.caps,
                    color: COLOR.secondary,
                    opacity: page === totalPages ? 0.2 : 0.6, cursor: page === totalPages ? "default" : "pointer",
                    minHeight: TOUCH_MIN, display: "flex", alignItems: "center",
                  }}>
                  {t.next}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Entry detail dialog ───────────────────────────────────────────── */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        {selectedEntry && (
          <DialogContent style={{
            background: COLOR.bg, border: `1px solid rgba(200,212,248,0.1)`,
            borderRadius: 0, color: COLOR.text, fontFamily: FONT.base,
          }}>
            <DialogHeader>
              <DialogTitle className="sr-only">Voice Signature Detail</DialogTitle>
              <DialogDescription className="sr-only">
                Voice signature recorded on {fmtDate(selectedEntry.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <span style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.caps, color: "#c8d4f8", opacity: 0.6 }}>
                {t.sigLabel}
              </span>

              {/* Large Chladni thumbnail in dialog */}
              <div style={{
                width: 180, height: 180,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(200,212,248,0.04)", borderRadius: "50%",
                overflow: "hidden",
              }}>
                <ChladniThumbnail
                  signaturePoints={selectedEntry.signaturePoints}
                  size={180}
                  gridSize={120}
                />
              </div>

              <div style={{ width: "100%" }}>
                <Waveform peaks={selectedEntry.waveformPeaks} height={40} />
                <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                  <button
                    onClick={() => setPlayingId(playingId === selectedEntry.id ? null : selectedEntry.id)}
                    aria-label={playingId === selectedEntry.id ? "Pause" : "Play"}
                    style={{
                      width: TOUCH_MIN, height: TOUCH_MIN,
                      background: "transparent",
                      border: "1px solid rgba(200,212,248,0.3)",
                      opacity: 0.7, display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer",
                      color: "#c8d4f8",
                    }}
                  >
                    {playingId === selectedEntry.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <DSDivider opacity={0.08} />

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
