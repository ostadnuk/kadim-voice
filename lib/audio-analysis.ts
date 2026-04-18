/**
 * Real audio analysis using Web Audio API.
 * Extracts waveform peaks and signature points from a recorded Blob.
 */
export async function analyzeAudioBlob(blob: Blob, peakCount = 80, signatureCount = 64): Promise<{
  waveformPeaks: number[]
  signaturePoints: number[]
}> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } finally {
    await audioCtx.close()
  }

  const channelData = audioBuffer.getChannelData(0)
  const totalSamples = channelData.length

  // ── Waveform peaks ──────────────────────────────────────────────────────────
  // RMS per segment → normalized 0-1
  const waveformPeaks: number[] = []
  const segSize = Math.floor(totalSamples / peakCount)
  for (let i = 0; i < peakCount; i++) {
    const start = i * segSize
    const end   = Math.min(start + segSize, totalSamples)
    let sum = 0
    for (let j = start; j < end; j++) {
      sum += channelData[j] * channelData[j]
    }
    waveformPeaks.push(Math.sqrt(sum / (end - start)))
  }
  const maxPeak = Math.max(...waveformPeaks, 0.001)
  const normalizedPeaks = waveformPeaks.map((p) => Math.max(0.03, p / maxPeak))

  // ── Signature points via offline FFT ───────────────────────────────────────
  // Run FFT on the full signal offline, sample frequency bins → signature
  const fftSize = 2048
  const offlineCtx = new OfflineAudioContext(1, totalSamples, audioBuffer.sampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer

  const analyser = offlineCtx.createAnalyser()
  analyser.fftSize = fftSize
  source.connect(analyser)
  analyser.connect(offlineCtx.destination)
  source.start(0)

  // Render a short window to get frequency snapshot
  const rendered = await offlineCtx.startRendering()
  const renderedCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const renderedAnalyser = renderedCtx.createAnalyser()
  renderedAnalyser.fftSize = fftSize
  const renderedSource = renderedCtx.createBufferSource()
  renderedSource.buffer = rendered
  renderedSource.connect(renderedAnalyser)
  renderedSource.start(0)

  // Give it a moment to process
  await new Promise<void>((resolve) => setTimeout(resolve, 100))

  const freqData = new Uint8Array(renderedAnalyser.frequencyBinCount)
  renderedAnalyser.getByteFrequencyData(freqData)
  await renderedCtx.close()

  // Sample signatureCount bins spread across spectrum (log scale feels more musical)
  const binCount = freqData.length
  const signaturePoints: number[] = []
  for (let i = 0; i < signatureCount; i++) {
    const t   = i / (signatureCount - 1)
    const bin = Math.floor(Math.pow(t, 1.8) * (binCount - 1)) // log-ish curve
    signaturePoints.push(freqData[bin] / 255)
  }

  return { waveformPeaks: normalizedPeaks, signaturePoints }
}
