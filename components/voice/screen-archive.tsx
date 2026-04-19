"use client"

import { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { ChladniThumbnail } from "./chladni-thumbnail"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import type { ArchiveResponse, ArchiveEntry } from "@/lib/types"
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
  voices: (n: number) => string
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
  remote: string
  dateLocale: string
  footer: string
}> = {
  en: {
    voices:        (n) => `${n.toLocaleString()} ${n === 1 ? "voice" : "voices"}`,
    collectiveSub: "The sum of every voice recorded into Kadim",
    individuals:   "INDIVIDUAL SIGNATURES",
    loading:       "LOADING...",
    noEntries:     "NO ENTRIES YET",
    prev:          "←",
    next:          "→",
    sigLabel:      "VOICE SIGNATURE",
    timestamp:     "Timestamp",
    location:      "Location",
    duration:      "Duration",
    source:        "Source",
    remote:        "Remote",
    dateLocale:    "en-GB",
    footer:        "Created by ReactionTime Collective · 2026",
  },
  he: {
    voices:        (n) => `${n.toLocaleString()} ${n === 1 ? "קול" : "קולות"}`,
    collectiveSub: "סכום כל הקולות שנקלטו בקדים",
    individuals:   "חתימות אישיות",
    loading:       "טוען...",
    noEntries:     "אין רשומות עדיין",
    prev:          "→",
    next:          "←",
    sigLabel:      "חתימת קול",
    timestamp:     "חותמת זמן",
    location:      "מיקום",
    duration:      "משך",
    source:        "מקור",
    remote:        "מרחוק",
    dateLocale:    "he-IL",
    footer:        "נוצר בידי קולקטיב ריאקשן טיים · 2026",
  },
  ar: {
    voices:        (n) => `${n.toLocaleString()} أصوات`,
    collectiveSub: "مجموع كل الأصوات المسجَّلة في قديم",
    individuals:   "التوقيعات الفردية",
    loading:       "جارٍ التحميل...",
    noEntries:     "لا توجد تسجيلات بعد",
    prev:          "→",
    next:          "←",
    sigLabel:      "توقيع صوتي",
    timestamp:     "الطابع الزمني",
    location:      "الموقع",
    duration:      "المدة",
    source:        "المصدر",
    remote:        "عن بُعد",
    dateLocale:    "ar-SA",
    footer:        "من إنتاج كولكتيف ريآكشن تايم · 2026",
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
  language?:      Language
  mySignatureId?: string | null
  onBack:         () => void
}

const PAGE_SIZE = 12

export function ScreenArchive({ language = "en", mySignatureId, onBack }: ScreenArchiveProps) {
  const t   = T[language]
  const dir = (language === "en" ? "ltr" : "rtl") as "ltr" | "rtl"

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

  const loc = t.dateLocale
  const fmtDate  = (s: string) => new Date(s).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" })
  const fmtTime  = (s: string) => new Date(s).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })
  const locLabel = (e: ArchiveEntry) => e.venueName || [e.city, e.country].filter(Boolean).join(", ") || t.remote
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const globalOffset = (page - 1) * PAGE_SIZE

  return (
    <DSShell dir={dir} className="overflow-y-auto">
      <style>{`
        @keyframes my-entry-glow {
          0%   { box-shadow: inset 0 0 0 1px rgba(125,212,160,0.6), 0 0 24px rgba(125,212,160,0.2); }
          60%  { box-shadow: inset 0 0 0 1px rgba(125,212,160,0.4), 0 0 16px rgba(125,212,160,0.12); }
          100% { box-shadow: inset 0 0 0 1px rgba(125,212,160,0.0), 0 0 0px rgba(125,212,160,0.0); }
        }
      `}</style>

      <DSTopBar
        left={<DSBack onClick={onBack} />}
        right={<WorldClock />}
      />

      {/* ── Collective pattern hero — tall, full-bleed, breathing 3D ──────── */}
      <div style={{
        position:   "relative",
        width:      "100%",
        height:     "60svh",
        minHeight:  320,
        background: COLOR.bg,
        flexShrink: 0,
      }}>
        {collectiveSig ? (
          <ArchiveCanvasDynamic signaturePoints={collectiveSig} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: FONT.base, fontSize: TYPE.xs, letterSpacing: TRACK.caps, color: COLOR.secondary, opacity: 0.3 }}>
              …
            </span>
          </div>
        )}

        {/* Bottom overlay: count + sub-label — clear of TopBar */}
        <div style={{
          position: "absolute", bottom: "clamp(1.25rem, 4vw, 2rem)",
          left: "clamp(1.25rem, 6vw, 2.5rem)", right: "clamp(1.25rem, 6vw, 2.5rem)",
          pointerEvents: "none",
          display: "flex", flexDirection: "column",
          alignItems: dir === "rtl" ? "flex-end" : "flex-start",
          gap: 4,
        }}>
          <div style={{
            fontFamily: FONT.base, fontWeight: 700,
            fontSize: "clamp(2.8rem, 11vw, 4.5rem)",
            letterSpacing: "-0.03em",
            color: COLOR.text, lineHeight: 1,
            opacity: collectiveSig ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}>
            {collectiveTotal.toLocaleString()}
          </div>
          <div style={{
            fontFamily: FONT.base, fontWeight: 300,
            fontSize: TYPE.xs, letterSpacing: TRACK.caps,
            color: "#c8d4f8", opacity: 0.5,
            textTransform: "uppercase",
          }}>
            {t.voices(collectiveTotal)}
          </div>
          <div style={{
            fontFamily: FONT.base, fontWeight: 300,
            fontSize: TYPE.hud, letterSpacing: TRACK.sm,
            color: COLOR.text, opacity: OPACITY.tertiary * 0.6,
            marginTop: 2,
          }}>
            {t.collectiveSub}
          </div>
        </div>
      </div>

      {/* ── Individual signatures — elegant list ─────────────────────────── */}
      <div style={{ paddingBottom: "4rem" }}>

        {/* Section label */}
        <div style={{
          padding: "clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 6vw, 2.5rem) 0.5rem",
          fontFamily: FONT.base, fontWeight: 300,
          fontSize: TYPE.hud, letterSpacing: TRACK.caps,
          color: COLOR.secondary, opacity: 0.4,
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
            {entries.map((entry, idx) => {
              const num    = String(globalOffset + idx + 1).padStart(2, "0")
              const isMine = mySignatureId && entry.id === mySignatureId
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  style={{
                    width: "100%", background: "none", border: "none",
                    cursor: "pointer",
                    padding: "0 clamp(1.25rem, 6vw, 2.5rem)",
                    WebkitTapHighlightColor: "transparent",
                    ...(isMine ? { animation: "my-entry-glow 3.5s ease-out forwards" } : {}),
                  }}
                >
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                  <div style={{
                    display: "flex", alignItems: "center",
                    flexDirection: dir === "rtl" ? "row-reverse" : "row",
                    gap: "clamp(0.9rem, 3.5vw, 1.25rem)",
                    padding: "clamp(0.8rem, 3vw, 1rem) 0",
                  }}>
                    {/* Index */}
                    <span style={{
                      fontFamily: FONT.base, fontWeight: 300,
                      fontSize: "0.65rem", letterSpacing: TRACK.caps,
                      color: COLOR.secondary, opacity: 0.3,
                      flexShrink: 0, minWidth: 22,
                      textAlign: dir === "rtl" ? "right" : "left",
                      direction: "ltr",
                    }}>
                      {num}
                    </span>

                    {/* Thumbnail — no background, just the pattern on dark */}
                    <div style={{
                      width: 56, height: 56, flexShrink: 0,
                      borderRadius: "50%",
                      overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <ChladniThumbnail
                        signaturePoints={entry.signaturePoints}
                        size={56}
                        gridSize={48}
                      />
                    </div>

                    {/* Text */}
                    <div style={{
                      flex: 1, display: "flex", flexDirection: "column", gap: 4,
                      textAlign: dir === "rtl" ? "right" : "left",
                      overflow: "hidden",
                    }}>
                      <span style={{
                        fontFamily: FONT.base, fontWeight: 400,
                        fontSize: TYPE.sm,
                        color: COLOR.text, opacity: OPACITY.secondary,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {locLabel(entry)}
                      </span>
                      <span style={{
                        fontFamily: FONT.base, fontWeight: 300,
                        fontSize: TYPE.hud, letterSpacing: TRACK.sm,
                        color: COLOR.secondary, opacity: 0.4,
                        direction: "ltr", textAlign: dir === "rtl" ? "right" : "left",
                      }}>
                        {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                      </span>
                    </div>

                    {/* Duration */}
                    <span style={{
                      fontFamily: FONT.base, fontWeight: 300,
                      fontSize: TYPE.hud, letterSpacing: TRACK.caps,
                      color: COLOR.secondary, opacity: 0.28,
                      flexShrink: 0, direction: "ltr",
                    }}>
                      {entry.durationSec}s
                    </span>
                  </div>
                </button>
              )
            })}

            {/* Bottom divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 clamp(1.25rem, 6vw, 2.5rem)" }} />

            {/* Pagination — minimal page indicator */}
            {totalPages > 1 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 0, marginTop: 32, marginBottom: 8,
              }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    background: "none", border: "none", fontFamily: FONT.base,
                    fontSize: TYPE.sm, color: COLOR.text,
                    opacity: page === 1 ? 0.15 : 0.55,
                    cursor: page === 1 ? "default" : "pointer",
                    minHeight: TOUCH_MIN, minWidth: TOUCH_MIN,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {t.prev}
                </button>
                <span style={{
                  fontFamily: FONT.base, fontWeight: 300,
                  fontSize: TYPE.hud, letterSpacing: TRACK.caps,
                  color: COLOR.secondary, opacity: 0.35,
                  minWidth: 64, textAlign: "center",
                }}>
                  {String(page).padStart(2,"0")} / {String(totalPages).padStart(2,"0")}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    background: "none", border: "none", fontFamily: FONT.base,
                    fontSize: TYPE.sm, color: COLOR.text,
                    opacity: page === totalPages ? 0.15 : 0.55,
                    cursor: page === totalPages ? "default" : "pointer",
                    minHeight: TOUCH_MIN, minWidth: TOUCH_MIN,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {t.next}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "clamp(1.5rem, 5vw, 2.5rem) clamp(1.25rem, 6vw, 2.5rem) clamp(2rem, 8vw, 3rem)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column",
        alignItems: dir === "rtl" ? "flex-end" : "flex-start",
        gap: 6,
      }}>
        <a
          href="https://reactiontime.co"
          target="_blank" rel="noopener noreferrer"
          style={{
            fontFamily: FONT.base, fontWeight: 300,
            fontSize: TYPE.hud, letterSpacing: TRACK.sm,
            color: COLOR.text, opacity: 0.35,
            textDecoration: "none",
            direction: "ltr",
          }}
        >
          {t.footer}
        </a>
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              {/* Signature label */}
              <span style={{ fontFamily: FONT.base, fontSize: TYPE.hud, letterSpacing: TRACK.caps, color: "#c8d4f8", opacity: 0.5 }}>
                {t.sigLabel}
              </span>

              {/* Large Chladni pattern */}
              <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <ChladniThumbnail signaturePoints={selectedEntry.signaturePoints} size={200} gridSize={160} />
              </div>

              <DSDivider opacity={0.08} />

              {/* Metadata */}
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
