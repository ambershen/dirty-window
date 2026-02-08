import type { Layer } from './Layer'
import type { GestureFeatures } from '../gestures/hand'
import type { LayerState } from '../state/LayerState'

export class PhotoBoothLayer implements Layer {
  readonly id = 'photoBooth'
  private video: HTMLVideoElement
  private state: LayerState
  private layerGetters: (() => HTMLCanvasElement | null)[]
  private captureCanvas: HTMLCanvasElement
  private captureCtx: CanvasRenderingContext2D
  private flashEl: HTMLDivElement
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private isRecording = false
  private recordingRAF: number | null = null

  constructor(
    video: HTMLVideoElement,
    state: LayerState,
    layerGetters: (() => HTMLCanvasElement | null)[],
  ) {
    this.video = video
    this.state = state
    this.layerGetters = layerGetters

    this.captureCanvas = document.createElement('canvas')
    this.captureCtx = this.captureCanvas.getContext('2d')!
    this.flashEl = document.getElementById('photo-flash') as HTMLDivElement
  }

  enable() {}
  disable() {
    if (this.isRecording) this.stopRecording()
  }

  // ── Photo Capture ──────────────────────

  async takePhoto(countdown: number = 3): Promise<void> {
    if (countdown > 0) await this.showCountdown(countdown)
    this.compositeFrame()
    this.triggerFlash()
    return new Promise<void>((resolve) => {
      this.captureCanvas.toBlob((blob) => {
        if (!blob) return resolve()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `glass_photo_${Date.now()}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        resolve()
      }, 'image/png')
    })
  }

  private compositeFrame() {
    const w = this.video.videoWidth || window.innerWidth
    const h = this.video.videoHeight || window.innerHeight
    this.captureCanvas.width = w
    this.captureCanvas.height = h
    const ctx = this.captureCtx

    // Draw mirrored video
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(this.video, -w, 0, w, h)
    ctx.restore()

    // Draw each enabled layer canvas in z-order
    for (const getter of this.layerGetters) {
      const canvas = getter()
      if (canvas && canvas.style.display !== 'none' && canvas.width > 0) {
        ctx.drawImage(canvas, 0, 0, w, h)
      }
    }
  }

  private triggerFlash() {
    if (!this.flashEl) return
    this.flashEl.style.opacity = '0.8'
    setTimeout(() => { this.flashEl.style.opacity = '0' }, 100)
  }

  private showCountdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      let remaining = seconds
      const overlay = document.createElement('div')
      overlay.className = 'tui-countdown'
      document.body.appendChild(overlay)

      const tick = () => {
        if (remaining <= 0) {
          overlay.remove()
          resolve()
          return
        }
        overlay.innerHTML = `<span class="tui-countdown-num">${remaining}</span>`
        remaining--
        setTimeout(tick, 1000)
      }
      tick()
    })
  }

  // ── Video Recording ────────────────────

  startRecording() {
    if (this.isRecording) return
    this.isRecording = true
    this.recordedChunks = []

    // Set up capture canvas at screen resolution
    this.captureCanvas.width = window.innerWidth
    this.captureCanvas.height = window.innerHeight

    const stream = this.captureCanvas.captureStream(30)

    // Try to find a supported mime type
    const mimeTypes = [
      'video/webm; codecs=vp9',
      'video/webm; codecs=vp8',
      'video/webm',
      'video/mp4',
    ]
    let mimeType = ''
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt
        break
      }
    }

    this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data)
    }
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: mimeType || 'video/webm' })
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `glass_video_${Date.now()}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    this.mediaRecorder.start(100) // 100ms timeslice for ondataavailable

    // Start composite rendering loop for recording
    const renderFrame = () => {
      if (!this.isRecording) return
      this.compositeFrame()
      this.recordingRAF = requestAnimationFrame(renderFrame)
    }
    renderFrame()
  }

  stopRecording() {
    if (!this.isRecording) return
    this.isRecording = false
    if (this.recordingRAF) {
      cancelAnimationFrame(this.recordingRAF)
      this.recordingRAF = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.mediaRecorder = null
  }

  // ── Layer Interface ────────────────────

  update(now: number, hands: GestureFeatures[]) {
    // Photo booth has no per-frame rendering; compositing happens on capture/record
  }

  resize() {
    // Capture canvas resized at capture time
  }

  destroy() {
    this.stopRecording()
  }

  getCanvas(): HTMLCanvasElement | null {
    return null // Photo booth doesn't have its own visual canvas
  }
}
