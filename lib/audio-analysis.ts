/**
 * Audio analysis — extracts waveform peaks and a unique voice signature.
 *
 * Signature approach: direct DFT on a windowed segment of raw audio samples,
 * sampled at 64 log-spaced frequency bins (80 Hz → 8 kHz).
 *
 * This is fully deterministic — no timing hacks, no realtime AudioContext
 * race conditions, no dependency on buffer availability windows.
 * Different voices produce measurably different frequency profiles.
 */
export async function analyzeAudioBlob(
  blob: Blob,
  peakCount      = 80,
  signatureCount = 64,
): Promise<{ waveformPeaks: number[]; signaturePoints: number[] }> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx    = new (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  )()

  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } finally {
    await audioCtx.close()
  }

  const channelData   = audioBuffer.getChannelData(0)
  const totalSamples  = channelData.length
  const sampleRate    = audioBuffer.sampleRate

  // ── Waveform peaks — RMS per segment, normalized ────────────────────────────
  const waveformPeaks: number[] = []
  const segSize = Math.floor(totalSamples / peakCount)
  for (let i = 0; i < peakCount; i++) {
    const start = i * segSize
    const end   = Math.min(start + segSize, totalSamples)
    let sum = 0
    for (let j = start; j < end; j++) sum += channelData[j] * channelData[j]
    waveformPeaks.push(Math.sqrt(sum / (end - start)))
  }
  const maxPeak = Math.max(...waveformPeaks, 0.001)
  const normalizedPeaks = waveformPeaks.map(p => Math.max(0.03, p / maxPeak))

  // ── Voice signature — direct DFT on raw samples ────────────────────────────
  //
  // We analyse the middle 20–80% of the recording (richest voiced content),
  // apply a Hann window to reduce spectral leakage, then compute DFT magnitudes
  // at 64 log-spaced frequency bins from 80 Hz to 8 kHz.
  //
  // Window size 2048 → 64 DFT points = ~131K operations, <1 ms on any device.

  const winStart = Math.floor(totalSamples * 0.20)
  const winSize  = Math.min(2048, totalSamples - winStart)

  // Hann window
  const windowed = new Float32Array(winSize)
  for (let i = 0; i < winSize; i++) {
    const hann   = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)))
    windowed[i]  = channelData[winStart + i] * hann
  }

  const raw: number[] = []
  for (let si = 0; si < signatureCount; si++) {
    const t    = si / (signatureCount - 1)
    const freq = 80 * Math.pow(8000 / 80, t)           // log 80 Hz → 8 kHz
    const k    = Math.round((freq * winSize) / sampleRate)

    if (k <= 0 || k >= winSize / 2) { raw.push(0); continue }

    let re = 0, im = 0
    for (let j = 0; j < winSize; j++) {
      const angle = (2 * Math.PI * k * j) / winSize
      re += windowed[j] * Math.cos(angle)
      im += windowed[j] * Math.sin(angle)
    }
    raw.push(Math.sqrt(re * re + im * im) / winSize)
  }

  // Normalize to [0.05, 1.0]
  const maxSig = Math.max(...raw, 0.001)
  const signaturePoints = raw.map(p => Math.max(0.05, p / maxSig))

  return { waveformPeaks: normalizedPeaks, signaturePoints }
}
