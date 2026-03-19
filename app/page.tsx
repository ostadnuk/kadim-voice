import { Suspense } from "react"
import { VoiceApp } from "@/components/voice/voice-app"

export default function Page() {
  return (
    <main className="min-h-[100dvh]">
      <Suspense
        fallback={
          <div className="flex min-h-[100dvh] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          </div>
        }
      >
        <VoiceApp />
      </Suspense>
    </main>
  )
}
