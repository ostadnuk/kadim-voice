import type { ArchiveEntry, AnalyzeResponse, UploadResponse, ArchiveResponse } from "./types"

function generateSignaturePoints(count: number = 48): number[] {
  const points: number[] = []
  for (let i = 0; i < count; i++) {
    points.push(Math.random() * 0.8 + 0.1)
  }
  return points
}

function generateWaveformPeaks(count: number = 80): number[] {
  const peaks: number[] = []
  for (let i = 0; i < count; i++) {
    const base = Math.sin((i / count) * Math.PI) * 0.6
    peaks.push(Math.max(0.05, base + (Math.random() - 0.5) * 0.4))
  }
  return peaks
}

const VENUES = [
  { id: "v1", name: "Tate Modern, London" },
  { id: "v2", name: "MoMA, New York" },
  { id: "v3", name: "Centre Pompidou, Paris" },
]

const CITIES = [
  { country: "United Kingdom", city: "London" },
  { country: "United States", city: "New York" },
  { country: "France", city: "Paris" },
  { country: "Germany", city: "Berlin" },
  { country: "Japan", city: "Tokyo" },
  { country: "Brazil", city: "Sao Paulo" },
  { country: "Australia", city: "Sydney" },
  { country: "Canada", city: "Toronto" },
]

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateMockEntry(index: number): ArchiveEntry {
  const isExhibition = Math.random() > 0.4
  const venue = isExhibition ? randomChoice(VENUES) : null
  const cityData = !isExhibition ? randomChoice(CITIES) : null
  const daysAgo = Math.floor(Math.random() * 60)
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60))

  return {
    id: `entry-${index.toString().padStart(4, "0")}`,
    createdAt: date.toISOString(),
    venueId: venue?.id ?? null,
    venueName: venue?.name ?? null,
    sourceType: isExhibition ? "exhibition" : "remote",
    country: cityData?.country ?? null,
    city: cityData?.city ?? null,
    lat: null,
    lng: null,
    audioUrl: `/audio/mock-${index}.webm`,
    durationSec: Math.floor(Math.random() * 25) + 5,
    signaturePoints: generateSignaturePoints(),
    waveformPeaks: generateWaveformPeaks(),
    consentVersion: "1.0",
    mixOptIn: Math.random() > 0.2,
  }
}

const MOCK_ENTRIES: ArchiveEntry[] = Array.from({ length: 42 }, (_, i) =>
  generateMockEntry(i)
).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function uploadAudio(_blob: Blob): Promise<UploadResponse> {
  await delay(1500)
  const id = `entry-${Date.now()}`
  return { id, audioUrl: `/audio/${id}.webm`, signatureNumber: Math.floor(Math.random() * 3000) + 1 }
}

export async function analyzeAudio(_audioUrl: string): Promise<AnalyzeResponse> {
  await delay(800)
  return {
    features: { spectralCentroid: 2400, rms: 0.34 },
    signaturePoints: generateSignaturePoints(),
  }
}

export async function fetchArchive(
  page: number = 1,
  pageSize: number = 12,
  filter?: { sourceType?: string; venueId?: string }
): Promise<ArchiveResponse> {
  await delay(600)
  let filtered = [...MOCK_ENTRIES]
  if (filter?.sourceType) {
    filtered = filtered.filter((e) => e.sourceType === filter.sourceType)
  }
  if (filter?.venueId) {
    filtered = filtered.filter((e) => e.venueId === filter.venueId)
  }
  const start = (page - 1) * pageSize
  const entries = filtered.slice(start, start + pageSize)
  return { entries, total: filtered.length, page, pageSize }
}

export async function fetchEntry(id: string): Promise<ArchiveEntry | null> {
  await delay(300)
  return MOCK_ENTRIES.find((e) => e.id === id) ?? MOCK_ENTRIES[0]
}

export function getVenueById(venueId: string): { id: string; name: string } | null {
  return VENUES.find((v) => v.id === venueId) ?? null
}

export { VENUES, generateSignaturePoints, generateWaveformPeaks }
