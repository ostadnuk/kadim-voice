"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { SignatureRing } from "./signature-ring"
import { Waveform } from "./waveform"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { fetchArchive, VENUES } from "@/lib/mock-api"
import type { ArchiveEntry } from "@/lib/types"
import { ArrowLeft, Play, Pause } from "lucide-react"

interface ScreenArchiveProps {
  onBack: () => void
}

export function ScreenArchive({ onBack }: ScreenArchiveProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{ sourceType?: string; venueId?: string }>({})
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const result = await fetchArchive(page, 12, filter)
    setEntries(result.entries)
    setTotal(result.total)
    setLoading(false)
  }, [page, filter])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleFilterChange = (key: string, value: string) => {
    setPage(1)
    if (key === "sourceType") {
      setFilter((prev) => ({
        ...prev,
        sourceType: value || undefined,
        venueId: value === "exhibition" ? prev.venueId : undefined,
      }))
    } else {
      setFilter((prev) => ({ ...prev, [key]: value || undefined }))
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getLocationLabel = (entry: ArchiveEntry) => {
    if (entry.venueName) return entry.venueName
    const parts = [entry.city, entry.country].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : "Remote"
  }

  const totalPages = Math.ceil(total / 12)

  return (
    <div className="min-h-[100dvh] px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-medium">Archive</h1>
            <p className="text-sm text-muted-foreground">
              {total} voice {total === 1 ? "signature" : "signatures"}
            </p>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <select
            value={filter.sourceType || ""}
            onChange={(e) => handleFilterChange("sourceType", e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none"
          >
            <option value="">All sources</option>
            <option value="exhibition">Exhibition</option>
            <option value="remote">Remote</option>
          </select>

          {filter.sourceType === "exhibition" && (
            <select
              value={filter.venueId || ""}
              onChange={(e) => handleFilterChange("venueId", e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none"
            >
              <option value="">All venues</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">No entries found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
                >
                  <SignatureRing
                    points={entry.signaturePoints}
                    size={80}
                    strokeWidth={1}
                  />
                  <div className="flex w-full flex-col items-center gap-1">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                    <span className="text-center text-[11px] text-foreground leading-tight">
                      {getLocationLabel(entry)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-9 rounded-lg text-xs"
                >
                  Previous
                </Button>
                <span className="font-mono text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-9 rounded-lg text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        {selectedEntry && (
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="sr-only">Voice Signature Detail</DialogTitle>
              <DialogDescription className="sr-only">
                Details for voice signature recorded on{" "}
                {formatDate(selectedEntry.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-6 pt-2">
              <SignatureRing
                points={selectedEntry.signaturePoints}
                size={160}
                animated
              />

              <div className="w-full rounded-xl border border-border bg-card p-4">
                <Waveform peaks={selectedEntry.waveformPeaks} height={48} />
                <div className="mt-3 flex items-center justify-center">
                  <button
                    onClick={() =>
                      setPlayingId(
                        playingId === selectedEntry.id ? null : selectedEntry.id
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
                    aria-label={playingId === selectedEntry.id ? "Pause" : "Play"}
                  >
                    {playingId === selectedEntry.id ? (
                      <Pause className="h-4 w-4 text-foreground" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4 text-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="font-medium uppercase tracking-widest text-muted-foreground">
                    Timestamp
                  </span>
                  <span className="font-mono text-foreground">
                    {formatDate(selectedEntry.createdAt)}{" "}
                    {formatTime(selectedEntry.createdAt)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between py-1">
                  <span className="font-medium uppercase tracking-widest text-muted-foreground">
                    Location
                  </span>
                  <span className="text-foreground">
                    {getLocationLabel(selectedEntry)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between py-1">
                  <span className="font-medium uppercase tracking-widest text-muted-foreground">
                    Duration
                  </span>
                  <span className="font-mono text-foreground">
                    {selectedEntry.durationSec}s
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between py-1">
                  <span className="font-medium uppercase tracking-widest text-muted-foreground">
                    Source
                  </span>
                  <span className="capitalize text-foreground">
                    {selectedEntry.sourceType}
                  </span>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
