import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page     = parseInt(searchParams.get("page")     ?? "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") ?? "12", 10)
    const sourceType = searchParams.get("sourceType") ?? undefined
    const venueId    = searchParams.get("venueId")    ?? undefined

    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase
      .from("recordings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to)

    if (sourceType) query = query.eq("source_type", sourceType)
    if (venueId)    query = query.eq("venue_id", venueId)

    const { data, count, error } = await query

    if (error) {
      console.error("Archive fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map snake_case DB columns → camelCase ArchiveEntry
    const entries = (data ?? []).map((r) => ({
      id:              r.id,
      createdAt:       r.created_at,
      audioUrl:        r.audio_url,
      durationSec:     r.duration_sec,
      signaturePoints: r.signature_points,
      waveformPeaks:   r.waveform_peaks,
      sourceType:      r.source_type,
      venueId:         r.venue_id,
      venueName:       r.venue_name,
      country:         r.country,
      city:            r.city,
      lat:             r.lat,
      lng:             r.lng,
      consentVersion:  r.consent_version,
      mixOptIn:        r.mix_opt_in,
    }))

    return NextResponse.json({ entries, total: count ?? 0, page, pageSize })
  } catch (err) {
    console.error("Archive route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
