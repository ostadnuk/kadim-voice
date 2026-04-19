export type SourceType = "exhibition" | "remote"

export interface ArchiveEntry {
  id: string
  createdAt: string
  venueId: string | null
  venueName: string | null
  sourceType: SourceType
  country: string | null
  city: string | null
  lat: number | null
  lng: number | null
  audioUrl: string
  durationSec: number
  signaturePoints: number[]
  waveformPeaks: number[]
  consentVersion: string
  mixOptIn: boolean
}

export interface UploadResponse {
  id: string
  audioUrl: string
  signatureNumber: number   // ordinal position in archive (1-based)
}

export interface AnalyzeResponse {
  features: Record<string, number>
  signaturePoints: number[]
}

export interface ArchiveResponse {
  entries: ArchiveEntry[]
  total: number
  page: number
  pageSize: number
}

export type FlowStep =
  | "welcome"
  | "language"
  | "exhibition"
  | "wonder"
  | "intro"
  | "intent"
  | "record"
  | "review"
  | "location"
  | "consent"
  | "upload"
  | "result"
  | "wunderflow"

export interface RecordingState {
  blob: Blob | null
  duration: number
  waveformPeaks: number[]
}

export interface LocationState {
  sourceType: SourceType
  venueId: string | null
  venueName: string | null
  country: string
  city: string
  lat: number | null
  lng: number | null
}

export interface ConsentState {
  archiveConsent: boolean
  mixOptIn: boolean
}
