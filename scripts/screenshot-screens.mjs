import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../screenshots')
await mkdir(OUT, { recursive: true })

const SCREENS = [
  { name: '01-intro',    url: 'http://localhost:3000' },
  { name: '02-intent',   url: 'http://localhost:3000?_step=intent' },
  { name: '03-record',   url: 'http://localhost:3000?_step=record' },
  { name: '04-review',   url: 'http://localhost:3000?_step=review' },
  { name: '05-location', url: 'http://localhost:3000?_step=location' },
  { name: '06-consent',  url: 'http://localhost:3000?_step=consent' },
  { name: '07-upload',   url: 'http://localhost:3000?_step=upload' },
  { name: '08-result',   url: 'http://localhost:3000?_step=result' },
  { name: '09-archive',  url: 'http://localhost:3000?_step=archive' },
]

// Re-enable debug routing temporarily
const { default: fs } = await import('fs')
const voiceAppPath = join(__dirname, '../components/voice/voice-app.tsx')
const original = fs.readFileSync(voiceAppPath, 'utf8')

const patched = original
  .replace(
    `import { getVenueById } from "@/lib/mock-api"`,
    `import { getVenueById, generateSignaturePoints, generateWaveformPeaks } from "@/lib/mock-api"`
  )
  .replace(
    `export function VoiceApp() {\n  const searchParams = useSearchParams()\n  const venueId = searchParams.get("venue_id")\n  const venue = venueId ? getVenueById(venueId) : null\n\n  const [step, setStep] = useState<FlowStep | "archive">("intro")`,
    `const DEBUG_RECORDING = { blob: new Blob([], { type: "audio/webm" }), duration: 18, waveformPeaks: generateWaveformPeaks() }
const DEBUG_LOCATION = { sourceType: "remote" as const, venueId: null, venueName: null, country: "Israel", city: "Tel Aviv", lat: null, lng: null }
const DEBUG_UPLOAD = { id: "entry-debug", audioUrl: "/audio/debug.webm", signaturePoints: generateSignaturePoints() }

export function VoiceApp() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get("venue_id")
  const venue = venueId ? getVenueById(venueId) : null
  const debugStep = searchParams.get("_step") as FlowStep | "archive" | null

  const [step, setStep] = useState<FlowStep | "archive">(debugStep ?? "intro")`
  )
  .replace(
    `    case "review":\n      if (!recording) return null\n      return (\n        <ScreenReview\n          recording={recording}`,
    `    case "review":\n      return (\n        <ScreenReview\n          recording={recording ?? DEBUG_RECORDING}`
  )
  .replace(
    `    case "upload":\n      if (!recording?.blob) return null\n      return (\n        <ScreenUpload\n          audioBlob={recording.blob}`,
    `    case "upload":\n      return (\n        <ScreenUpload\n          audioBlob={(recording ?? DEBUG_RECORDING).blob}`
  )
  .replace(
    `    case "result":\n      if (!recording || !location || !uploadResult) return null\n      return (\n        <ScreenResult\n          recording={recording}\n          location={location}\n          signaturePoints={uploadResult.signaturePoints}`,
    `    case "result":\n      return (\n        <ScreenResult\n          recording={recording ?? DEBUG_RECORDING}\n          location={location ?? DEBUG_LOCATION}\n          signaturePoints={(uploadResult ?? DEBUG_UPLOAD).signaturePoints}`
  )

fs.writeFileSync(voiceAppPath, patched)
console.log('Patched voice-app.tsx')

// Wait for Next.js to recompile
await new Promise(r => setTimeout(r, 3000))

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

for (const screen of SCREENS) {
  console.log(`Capturing ${screen.name}...`)
  await page.goto(screen.url, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, screen.name.includes('archive') ? 2000 : 500))
  await page.screenshot({ path: join(OUT, `${screen.name}.png`), fullPage: false })
  console.log(`  ✓ ${screen.name}.png`)
}

await browser.close()

// Restore original
fs.writeFileSync(voiceAppPath, original)
console.log('Restored voice-app.tsx')
console.log(`\nScreenshots saved to: ${OUT}`)
