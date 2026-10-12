import { HandTracker } from './hand'

export type MaterialHand = { x: number; y: number; radius: number; action: 'finger' | 'palm' }

/** Direct mirrored camera coordinates, one selected hand, one smoothing stage. */
export class MaterialCamera {
  private tracker: HandTracker | null = null
  private video = document.createElement('video')
  private cursor = document.createElement('span')
  private status = document.createElement('p')
  private devices = document.createElement('select')
  private epoch = 0
  private raf = 0
  private action = 'idle'
  private candidate = 'idle'
  private candidateAt = 0
  private sampleTime = 0
  private previous: { x: number; y: number } | null = null
  constructor(private button: HTMLButtonElement, private contact: (point: MaterialHand) => void, private release: () => void) {
    this.video.muted = true; this.video.playsInline = true; this.video.className = 'material-camera-preview'; this.video.hidden = true
    this.video.setAttribute('aria-label', 'Mirrored hand camera preview')
    this.cursor.className = 'material-hand-cursor'; this.cursor.hidden = true
    this.status.className = 'material-camera-status'; this.status.setAttribute('role', 'status')
    this.devices.className = 'material-camera-devices'; this.devices.hidden = true; this.devices.setAttribute('aria-label', 'Camera device')
    this.devices.add(new Option('System camera', ''))
    this.devices.onchange = () => { this.stop(); void this.start() }
    document.body.append(this.video, this.cursor, this.status, this.devices)
    button.onclick = () => { if (this.tracker) this.stop(); else void this.start() }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop() })
    addEventListener('blur', () => { this.action = 'idle'; this.previous = null; this.release() })
  }
  stop() {
    this.epoch++; cancelAnimationFrame(this.raf); this.tracker?.dispose(); this.tracker = null
    this.action = this.candidate = 'idle'; this.previous = null; this.release()
    this.video.hidden = true; this.cursor.hidden = true; this.devices.hidden = true; this.status.textContent = ''
    this.button.setAttribute('aria-pressed', 'false'); this.button.setAttribute('aria-label', 'Enable hand camera')
  }
  private async start() {
    const epoch = ++this.epoch
    const tracker = new HandTracker(this.video, { numHands: 1, maxHz: 30, inferenceWidth: 640, minCutoff: 5, beta: 12, wasmPath: '/vision', modelUrl: '/hand_landmarker.task', cameraDeviceId: this.devices.value || undefined })
    this.tracker = tracker; this.status.textContent = 'Starting hand camera…'
    try {
      if (!await tracker.initCamera()) throw Error(tracker.cameraError || 'Camera unavailable')
      if (epoch !== this.epoch) { tracker.dispose(); return }
      await this.refreshDevices()
      if (epoch !== this.epoch) { tracker.dispose(); return }
      await tracker.initLandmarker()
      if (epoch !== this.epoch) { tracker.dispose(); return }
      this.video.hidden = false; this.button.setAttribute('aria-pressed', 'true'); this.button.setAttribute('aria-label', 'Turn off hand camera')
      const frame = (now: number) => {
        if (epoch !== this.epoch) return
        try {
          tracker.update(now)
          const hand = tracker.hands[0]
          if (!hand || now - tracker.resultTime > 150 || !document.hasFocus()) {
            this.action = this.candidate = 'idle'; this.previous = null; this.cursor.hidden = true; this.release()
            this.status.textContent = 'Show one hand · pinch to touch · open palm to sweep'
          } else {
            // Unlike a reflected full-screen image, this material has no cover crop.
            const next = hand.isOpenPalm ? 'palm' : !hand.isFist && hand.pinch > (this.action === 'finger' ? .63 : .76) ? 'finger' : 'idle'
            if (next !== this.candidate) { this.candidate = next; this.candidateAt = now }
            if (next === 'idle' || (next !== this.action && now - this.candidateAt > 55)) {
              if (this.action !== next) { this.release(); this.previous = null }
              this.action = next
            }
            const palm = this.action === 'palm'
            const x = palm ? hand.x : hand.indexTipX, y = palm ? hand.y : hand.indexTipY
            if (tracker.resultTime !== this.sampleTime) {
              if (this.previous && Math.hypot(x - this.previous.x, y - this.previous.y) > .18) { this.release(); this.action = 'idle'; this.candidateAt = now }
              this.previous = { x, y }; this.sampleTime = tracker.resultTime
            }
            this.cursor.hidden = false; this.cursor.style.left = `${x * 100}%`; this.cursor.style.top = `${y * 100}%`
            this.cursor.dataset.action = this.action
            const radius = palm ? Math.max(30, Math.min(72, hand.width * innerWidth * .28)) : 12
            this.cursor.style.setProperty('--contact-size', `${radius * 2}px`)
            if (this.action !== 'idle') this.contact({ x, y, radius, action: palm ? 'palm' : 'finger' })
            else this.release()
            this.status.textContent = this.action === 'idle' ? 'Hover · pinch to touch' : palm ? 'Palm · sweeping' : 'Pinch · touching'
          }
        } catch { this.stop(); this.status.textContent = 'Tracking interrupted. Tap Camera to retry.'; return }
        this.raf = requestAnimationFrame(frame)
      }
      this.raf = requestAnimationFrame(frame)
    } catch (error) {
      if (epoch === this.epoch) {
        this.stop(); this.status.textContent = `${error instanceof Error ? error.message : 'Camera unavailable'} · choose another camera or retry`
        await this.refreshDevices()
      } else tracker.dispose()
    }
  }
  private async refreshDevices() {
    try {
      const epoch = this.epoch
      const selected = this.devices.value, devices = await navigator.mediaDevices.enumerateDevices()
      if (epoch !== this.epoch) return
      this.devices.replaceChildren(new Option('System camera', ''))
      for (const [i, device] of devices.filter(d => d.kind === 'videoinput').entries()) this.devices.add(new Option(device.label || `Camera ${i + 1}`, device.deviceId))
      this.devices.value = selected; this.devices.hidden = this.devices.options.length < 2
    } catch { /* The camera error and retry button remain available. */ }
  }
}
