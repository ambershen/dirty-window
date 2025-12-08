import type { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { FilesetResolver as _FilesetResolver, HandLandmarker as _HandLandmarker } from '@mediapipe/tasks-vision'

export type GestureFeatures = {
  pinch: number // 0..1
  openness: number // 0..1
  tiltX: number // radians delta
  tiltY: number // radians delta
  x: number // 0..1 (screen space)
  y: number // 0..1 (screen space)
  width: number // 0..1
  height: number // 0..1
}

export class HandTracker {
  private video: HTMLVideoElement
  private landmarker: HandLandmarker | null = null
  private lastTs = 0
  private readonly maxHz = 30
  private readonly wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  private readonly modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  private inferCanvas: HTMLCanvasElement | null = null
  private inferCtx: CanvasRenderingContext2D | null = null

  // Initialize off-screen so we don't show a "hole" in the center before detection
  features: GestureFeatures = { pinch: 0, openness: 0.5, tiltX: 0, tiltY: 0, x: -1, y: -1, width: 0, height: 0 }
  hands: GestureFeatures[] = []

  constructor(videoEl: HTMLVideoElement) {
    this.video = videoEl
  }

  async initCamera(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      this.video.srcObject = stream
      await this.video.play()
      // Prepare downscaled canvas for inference
      const w = Math.max(160, Math.min(320, this.video.videoWidth))
      const h = Math.round(w * (this.video.videoHeight / this.video.videoWidth || 3/4))
      this.inferCanvas = document.createElement('canvas')
      this.inferCanvas.width = w
      this.inferCanvas.height = h
      this.inferCtx = this.inferCanvas.getContext('2d')
      return true
    } catch (e) {
      return false
    }
  }

  async initLandmarker() {
    const resolver = await _FilesetResolver.forVisionTasks(this.wasmPath)
    this.landmarker = await _HandLandmarker.createFromOptions(resolver as any, {
      baseOptions: {
        modelAssetPath: this.modelUrl,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
  }

  update(now: number) {
    // Decimate inference to maxHz
    if (!this.landmarker || !this.video.videoWidth || !this.inferCtx || !this.inferCanvas) return
    if (now - this.lastTs < 1000 / this.maxHz) return
    this.lastTs = now

    // Draw downscaled frame
    this.inferCtx.drawImage(this.video, 0, 0, this.inferCanvas.width, this.inferCanvas.height)
    const result = this.landmarker.detectForVideo(this.inferCanvas as unknown as HTMLCanvasElement, now)
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      this.hands = []
      return
    }
    
    this.hands = result.landmarks.map(lm => computeFeatures(lm))
    // Keep legacy support
    this.features = this.hands[0]
  }
}

type LM = { x: number; y: number; z: number }

// Compute simple features from 21 hand landmarks
function computeFeatures(lm: LM[]): GestureFeatures {
  const idxTip = lm[8]
  const thbTip = lm[4]
  const wrist = lm[0]
  const mid = lm[9]

  const handScale = dist(wrist, mid)
  const pinch = 1 - clamp(dist(idxTip, thbTip) / (handScale * 1.2), 0, 1)

  // Openness: average distance of fingertips to palm center
  const tips = [lm[4], lm[8], lm[12], lm[16], lm[20]]
  const palm = centroid([lm[0], lm[5], lm[9], lm[13], lm[17]])
  const avg = tips.reduce((acc, t) => acc + dist(t, palm), 0) / tips.length
  const openness = clamp(avg / (handScale * 2), 0, 1)

  // Tilt: use wrist→mid direction as palm normal proxy in screen space
  const dx = (mid.x - wrist.x)
  const dy = (mid.y - wrist.y)

  // Screen space position (using palm centroid)
  // Mirror x because it's a webcam
  const x = 1 - palm.x
  const y = palm.y

  // Bounding box for dynamic size
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const p of lm) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const width = maxX - minX
  const height = maxY - minY

  return { pinch, openness, tiltX: -dy * 0.5, tiltY: dx * 0.5, x, y, width, height }
}

function dist(a: LM, b: LM) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx*dx + dy*dy + dz*dz) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function centroid(points: LM[]) { const n = points.length; let x=0,y=0,z=0; for (const p of points){x+=p.x;y+=p.y;z+=p.z;} return { x:x/n, y:y/n, z:z/n } }
