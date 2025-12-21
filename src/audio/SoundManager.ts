export class RainSound {
  private ctx: AudioContext
  private gainNode: GainNode
  private source: AudioBufferSourceNode | null = null
  private isPlaying = false
  private filter: BiquadFilterNode

  constructor() {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
    this.ctx = new AudioContext()
    this.gainNode = this.ctx.createGain()
    this.gainNode.gain.value = 0
    
    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 400 // Muffled sound like rain on window

    this.filter.connect(this.gainNode)
    this.gainNode.connect(this.ctx.destination)
  }

  private createPinkNoise() {
    const bufferSize = 2 * this.ctx.sampleRate
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const output = buffer.getChannelData(0)
    
    // Pink noise algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.075076
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      output[i] *= 0.11
      b6 = white * 0.115926
    }
    return buffer
  }

  start() {
    if (this.isPlaying) return
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.createPinkNoise()
    this.source.loop = true
    
    this.source.connect(this.filter)
    
    this.source.start()
    this.isPlaying = true
  }

  stop() {
    if (!this.isPlaying) return
    // Fade out before stopping
    this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)
    
    setTimeout(() => {
        if (this.source) {
            this.source.stop()
            this.source.disconnect()
            this.source = null
        }
        this.isPlaying = false
    }, 200)
  }

  setVolume(v: number) {
    if (!this.isPlaying && v > 0) {
        this.start()
    }
    // Clamp volume
    const vol = Math.max(0, Math.min(1, v))
    this.gainNode.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1)
    
    if (vol === 0 && this.isPlaying) {
        // Optional: stop if volume is 0 for a while, but keeping it running is smoother for sliders
    }
  }
}
