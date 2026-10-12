/** Recorded sand, continuously enveloped by real contact motion. */
export class SandSound {
  private context: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private loading: Promise<void> | null = null
  private source: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private pan: StereoPannerNode | null = null
  enabled = true
  async unlock() {
    // Like IceSound/WaterSoundscape: play through the iOS ring/silent switch, and start a silent buffer inside the gesture.
    try { const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession; if (session) session.type = 'playback' } catch { /* Older browsers use their default session. */ }
    if (!this.context) this.context = new AudioContext()
    const context = this.context
    const resumed = context.resume()
    const silent = context.createBufferSource()
    silent.buffer = context.createBuffer(1, 1, context.sampleRate); silent.connect(context.destination); silent.start(); silent.onended = () => silent.disconnect()
    if (!this.buffer && !this.loading) this.loading = fetch(`${import.meta.env.BASE_URL}audio/sand-pour.mp3`).then(async response => {
      if (!response.ok) throw Error('Sand recording could not load')
      const recording = await context.decodeAudioData(await response.arrayBuffer())
      // Use the continuous middle pour, avoiding the recording's pauses.
      const start = Math.round(8 * recording.sampleRate), end = Math.min(recording.length, Math.round(15 * recording.sampleRate))
      const fade = Math.round(.12 * recording.sampleRate), length = end - start - fade
      const loop = context.createBuffer(recording.numberOfChannels, length, recording.sampleRate)
      for (let channel = 0; channel < recording.numberOfChannels; channel++) {
        const input = recording.getChannelData(channel), output = loop.getChannelData(channel)
        for (let i = 0; i < length; i++) output[i] = i < fade
          ? input[start + length + i] * (1 - i / fade) + input[start + i] * (i / fade)
          : input[start + i]
      }
      // The source pour sits near -42 dBFS; raise it to a usable level and soft-limit the rare loud grains.
      let sum = 0
      for (let channel = 0; channel < loop.numberOfChannels; channel++) for (const x of loop.getChannelData(channel)) sum += x * x
      const makeup = .12 / Math.max(1e-4, Math.sqrt(sum / (length * loop.numberOfChannels)))
      for (let channel = 0; channel < loop.numberOfChannels; channel++) {
        const data = loop.getChannelData(channel)
        for (let i = 0; i < length; i++) data[i] = Math.tanh(data[i] * makeup)
      }
      this.buffer = loop
    }).finally(() => { this.loading = null })
    await Promise.all([resumed, this.loading])
  }
  motion(speed: number, x: number, broad: boolean) {
    const c = this.context
    if (!this.enabled || !c || c.state !== 'running' || !this.buffer) return
    if (!this.source && speed > 3) {
      const source = c.createBufferSource(), gain = c.createGain(), pan = c.createStereoPanner(), filter = c.createBiquadFilter()
      source.buffer = this.buffer; source.loop = true
      filter.type = 'lowpass'; filter.frequency.value = 3600; gain.gain.value = 0
      source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(c.destination)
      source.start(); this.source = source; this.gain = gain; this.pan = pan
    }
    const volume = speed > 3 ? Math.min(.22, .022 + speed / 2200) * (broad ? 1.3 : 1) : 0
    this.gain?.gain.setTargetAtTime(volume, c.currentTime, speed > 3 ? .035 : .045)
    this.pan?.pan.setTargetAtTime((x * 2 - 1) * .35, c.currentTime, .08)
  }
  quiet() { if (this.context) this.gain?.gain.setTargetAtTime(0, this.context.currentTime, .025) }
  toggle() { this.enabled = !this.enabled; if (!this.enabled) this.quiet(); return this.enabled }
  dispose() { this.source?.stop(); this.source = null; void this.context?.close() }
}
