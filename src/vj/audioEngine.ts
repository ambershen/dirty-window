/**
 * The VJ's ears. Listens to a DJ mixer's line-in or a room microphone (an audio input device), to
 * audio playing on the computer (a shared tab or screen), or to a dropped audio file, and turns it
 * into what the materials understand: band levels, kick / snare / hat hits, the dominant pitch,
 * and a tempo with beat phase. Tempo is detected automatically; tapping takes over until reset.
 * Nothing is recorded or uploaded, and live inputs are never sent to the speakers.
 */
export type Source = 'input' | 'system' | 'file'

export type Hearing = {
  /** Overall loudness and six bands, each 0..1 after automatic gain. */
  level: number
  bands: { sub: number; bass: number; lowMid: number; mid: number; high: number; air: number }
  /** Hits decay from 1 to 0 after each detected onset. */
  kick: number; snare: number; hat: number
  /** True only on the frame a hit or a beat lands. */
  kickHit: boolean; snareHit: boolean; hatHit: boolean; beat: boolean
  /** Strongest pitch between 50 Hz and 1 kHz, and the spectral centroid (brightness), in Hz. */
  pitch: number; brightness: number
  bpm: number; phase: number; tempo: 'auto' | 'tap'; confidence: number
  /** Beats since listening began, for bars (4) and phrases (32); and energy now vs. the last few seconds. */
  count: number; energy: number; trend: number
}

const BANDS: [keyof Hearing['bands'], number, number][] = [['sub', 20, 60], ['bass', 60, 250], ['lowMid', 250, 500], ['mid', 500, 2000], ['high', 2000, 6000], ['air', 6000, 16000]]

export class AudioEngine {
  readonly hearing: Hearing = { level: 0, bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0 }, kick: 0, snare: 0, hat: 0, kickHit: false, snareHit: false, hatHit: false, beat: false, pitch: 110, brightness: 1000, bpm: 120, phase: 0, tempo: 'auto', confidence: 0, count: 0, energy: 0, trend: 0 }
  /** Multiplies every level; the performer's sensitivity fader. */
  gain = 1
  source: Source | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private media: HTMLAudioElement | null = null
  private spectrum = new Float32Array(1024)
  private previous = new Float32Array(1024)
  private sustained = new Float32Array(1024) // a slow average of the spectrum: held notes stand out, drums do not
  private peaks = { level: .02, sub: .02, bass: .02, lowMid: .02, mid: .02, high: .02, air: .02 } as Record<string, number>
  private flux = { kick: [] as number[], snare: [] as number[], hat: [] as number[] }
  private lastHit = { kick: 0, snare: 0, hat: 0 }
  private onsets: number[] = [] // times of strong onsets, for tempo
  private taps: number[] = []
  private beatOrigin = 0 // a time a beat landed; phase counts from here
  private lastBeat = -1
  private slowEnergy = 0
  private frames = 0

  /** Line-in and microphones are both audio inputs; list them so the performer can pick the mixer. */
  static async inputs() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label || 'Audio input' }))
  }

  async listen(source: Source, options: { deviceId?: string; file?: File } = {}) {
    this.stop()
    const context = new AudioContext({ latencyHint: 'interactive' }); this.context = context; await context.resume()
    const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0; this.analyser = analyser
    if (source === 'input') {
      // Processing off: a mixer feed should arrive untouched, and a room mic should not duck the music.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: options.deviceId ? { exact: options.deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
      context.createMediaStreamSource(this.stream).connect(analyser)
    } else if (source === 'system') {
      // Browsers share computer audio through screen sharing; choose a tab or screen with "share audio".
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints })
      stream.getVideoTracks().forEach(t => t.stop())
      if (!stream.getAudioTracks().length) { stream.getTracks().forEach(t => t.stop()); throw Error('No audio was shared. Share again and turn on “Share audio”.') }
      this.stream = stream; context.createMediaStreamSource(stream).connect(analyser)
    } else {
      if (!options.file) throw Error('Choose an audio file.')
      const media = new Audio(URL.createObjectURL(options.file)); media.loop = true; this.media = media
      const node = context.createMediaElementSource(media); node.connect(analyser); node.connect(context.destination) // a file is heard as well as seen
      await media.play()
    }
    this.source = source; this.previous.fill(0); this.onsets = []; this.frames = 0; this.slowEnergy = 0
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null
    if (this.media) { this.media.pause(); URL.revokeObjectURL(this.media.src); this.media = null }
    void this.context?.close(); this.context = null; this.analyser = null; this.source = null
  }

  /** Tap tempo: four or more taps set the tempo and put the beat where the last tap landed. */
  tap(now = performance.now()) {
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) this.taps = []
    this.taps.push(now); if (this.taps.length > 8) this.taps.shift()
    if (this.taps.length >= 4) {
      const gaps = this.taps.slice(1).map((t, i) => t - this.taps[i]), gap = gaps.reduce((a, b) => a + b) / gaps.length
      this.hearing.bpm = 60000 / gap; this.hearing.tempo = 'tap'; this.hearing.confidence = 1; this.beatOrigin = now
    }
  }
  /** Return tempo to automatic detection. */
  autoTempo() { this.taps = []; this.hearing.tempo = 'auto' }

  /** Call once per animation frame. */
  update(now: number) {
    const h = this.hearing, a = this.analyser
    h.kickHit = h.snareHit = h.hatHit = h.beat = false
    const decay = (v: number, ms: number) => v * Math.exp(-16.7 / ms)
    h.kick = decay(h.kick, 140); h.snare = decay(h.snare, 120); h.hat = decay(h.hat, 70)
    if (a && this.context) {
      a.getFloatFrequencyData(this.spectrum)
      const hz = this.context.sampleRate / a.fftSize, mag = (i: number) => Math.pow(10, this.spectrum[i] / 20)
      // Band energies with an automatic gain that follows the loudest recent moments down slowly.
      let total = 0
      for (const [name, lo, hi] of BANDS) {
        let sum = 0, n = 0
        for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(this.spectrum.length - 1, Math.ceil(hi / hz)); i++) { sum += mag(i); n++ }
        const e = sum / Math.max(1, n); total += e
        this.peaks[name] = Math.max(e, this.peaks[name] * .9985, 1e-5)
        h.bands[name] = h.bands[name] * .35 + Math.min(1, e / this.peaks[name] * this.gain) * .65
      }
      this.peaks.level = Math.max(total, this.peaks.level * .9985, 1e-5)
      h.level = h.level * .45 + Math.min(1, total / this.peaks.level * this.gain) * .55
      // Energy now against the last few seconds: rising into a drop, falling into a breakdown.
      // While listening warms up (about four seconds), the slow average follows quickly, so the start is not mistaken for a drop.
      this.frames++; const settle = this.frames < 240 ? .08 : .005
      h.energy = h.energy * .9 + h.level * .1; this.slowEnergy = this.slowEnergy * (1 - settle) + h.level * settle
      h.trend = this.slowEnergy > .02 ? h.energy / this.slowEnergy : 1
      // Onsets: rises in spectral energy (flux) per region, above an adaptive threshold.
      const fluxIn = (lo: number, hi: number) => { let f = 0; for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz); i++) { const d = mag(i) - this.previous[i]; if (d > 0) f += d } return f }
      const regions = { kick: fluxIn(40, 130) + fluxIn(130, 2000) * .15, snare: fluxIn(180, 400) + fluxIn(2000, 5000) * .5, hat: fluxIn(7000, 14000) }
      for (const key of ['kick', 'snare', 'hat'] as const) {
        const history = this.flux[key]; history.push(regions[key]); if (history.length > 43) history.shift()
        const mean = history.reduce((s, v) => s + v, 0) / history.length, spread = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length)
        const gap = { kick: 220, snare: 160, hat: 90 }[key]
        if (regions[key] > mean + spread * 1.25 && regions[key] > 1e-5 && now - this.lastHit[key] > gap) {
          this.lastHit[key] = now; h[key] = 1; h[`${key}Hit`] = true
          if (key !== 'hat') { this.onsets.push(now); if (this.onsets.length > 64) this.onsets.shift() }
        }
      }
      for (let i = 0; i < this.spectrum.length; i++) this.previous[i] = mag(i)
      // The strongest held note between 80 Hz and 1 kHz picks the plate's mode (the kick sits below
      // 80 Hz, and averaging over time favours sustained tones over hits); the centroid is brightness.
      let best = 0, bestI = 2, weighted = 0, sumMag = 0
      for (let i = 0; i < this.sustained.length; i++) this.sustained[i] = this.sustained[i] * .92 + mag(i) * .08
      for (let i = Math.floor(80 / hz); i < Math.ceil(1000 / hz); i++) { const m = this.sustained[i]; if (m > best) { best = m; bestI = i } }
      for (let i = 1; i < this.spectrum.length; i++) { const m = mag(i); weighted += m * i * hz; sumMag += m }
      if (h.level > .08) h.pitch = h.pitch * .8 + bestI * hz * .2
      h.brightness = h.brightness * .9 + (sumMag ? weighted / sumMag : 1000) * .1
      if (h.tempo === 'auto') this.detectTempo(now)
    }
    // Beat phase runs from the tempo; a beat lands once per period.
    const period = 60000 / h.bpm
    h.phase = (((now - this.beatOrigin) % period) + period) % period / period
    const index = Math.floor((now - this.beatOrigin) / period)
    if (index !== this.lastBeat) { this.lastBeat = index; h.beat = true; h.count++ }
  }

  /** Tempo from the onsets of the last few seconds: score candidate periods by how many onset gaps they explain. */
  private detectTempo(now: number) {
    const recent = this.onsets.filter(t => now - t < 8000)
    if (recent.length < 6) { this.hearing.confidence *= .99; return }
    let bestBpm = this.hearing.bpm, bestScore = 0
    for (let bpm = 70; bpm <= 180; bpm += .5) {
      const period = 60000 / bpm; let score = 0
      for (let i = 0; i < recent.length; i++) for (let j = i + 1; j < recent.length && j < i + 6; j++) {
        const beats = (recent[j] - recent[i]) / period, off = Math.abs(beats - Math.round(beats))
        if (Math.round(beats) >= 1) score += Math.max(0, 1 - off * 6)
      }
      // A mild preference for the common dance range keeps half and double tempos from winning.
      score *= 1 - Math.abs(bpm - 124) / 400
      if (score > bestScore) { bestScore = score; bestBpm = bpm }
    }
    const pairs = Math.max(1, recent.length * 3)
    this.hearing.confidence = this.hearing.confidence * .9 + Math.min(1, bestScore / pairs) * .1
    if (Math.abs(bestBpm - this.hearing.bpm) > 3) this.hearing.bpm = this.hearing.bpm * .7 + bestBpm * .3
    else this.hearing.bpm = this.hearing.bpm * .95 + bestBpm * .05
    // Pull the beat grid toward the latest strong onset, gently, so the phase locks to the music.
    const last = recent[recent.length - 1], period = 60000 / this.hearing.bpm
    const offset = ((last - this.beatOrigin) % period + period) % period
    this.beatOrigin += (offset > period / 2 ? offset - period : offset) * .2
  }
}
