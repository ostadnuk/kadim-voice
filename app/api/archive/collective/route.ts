import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { averageSignatures } from "@/lib/chladni"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/**
 * GET /api/archive/collective
 * Returns the averaged signaturePoints across all recordings + total count.
 * Used to render the collective Chladni pattern in the archive screen.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("recordings")
      .select("signature_points")

    if (error) {
      console.error("Collective fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const sigs = (data ?? [])
      .map(r => r.signature_points as number[] | null)
      .filter((s): s is number[] => Array.isArray(s) && s.length > 0)

    const signaturePoints = averageSignatures(sigs)
    return NextResponse.json({ signaturePoints, total: sigs.length })
  } catch (err) {
    console.error("Collective route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
