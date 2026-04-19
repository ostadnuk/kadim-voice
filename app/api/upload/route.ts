import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Service client — uses service role key to bypass RLS (server-side only, never exposed to browser)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get("audio") as File | null
    const metaRaw = formData.get("meta") as string | null

    if (!audio || !metaRaw) {
      return NextResponse.json({ error: "Missing audio or meta" }, { status: 400 })
    }

    const meta = JSON.parse(metaRaw) as {
      durationSec: number
      signaturePoints: number[]
      waveformPeaks: number[]
      sourceType: "exhibition" | "remote"
      venueId: string | null
      venueName: string | null
      country: string | null
      city: string | null
      lat: number | null
      lng: number | null
      consentVersion: string
      mixOptIn: boolean
    }

    // Upload audio to Supabase Storage
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webm`
    const arrayBuffer = await audio.arrayBuffer()
    const { error: storageError } = await supabase.storage
      .from("audio")
      .upload(filename, arrayBuffer, {
        contentType: "audio/webm",
        upsert: false,
      })

    if (storageError) {
      console.error("Storage error:", storageError)
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from("audio").getPublicUrl(filename)
    const audioUrl = urlData.publicUrl

    // Save metadata to DB
    const { data, error: dbError } = await supabase
      .from("recordings")
      .insert({
        audio_url:        audioUrl,
        duration_sec:     meta.durationSec,
        signature_points: meta.signaturePoints,
        waveform_peaks:   meta.waveformPeaks,
        source_type:      meta.sourceType,
        venue_id:         meta.venueId,
        venue_name:       meta.venueName,
        country:          meta.country,
        city:             meta.city,
        lat:              meta.lat,
        lng:              meta.lng,
        consent_version:  meta.consentVersion,
        mix_opt_in:       meta.mixOptIn,
      })
      .select("id")
      .single()

    if (dbError) {
      console.error("DB error:", dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Count total recordings to give the user their ordinal position
    const { count } = await supabase
      .from("recordings")
      .select("*", { count: "exact", head: true })

    const signatureNumber = count ?? 0

    return NextResponse.json({ id: data.id, audioUrl, signatureNumber })
  } catch (err) {
    console.error("Upload route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
