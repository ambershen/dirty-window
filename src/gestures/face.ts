import type { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { FilesetResolver as _FilesetResolver, FaceLandmarker as _FaceLandmarker } from '@mediapipe/tasks-vision'

export type FaceFeatures = {
  mouthOpenness: number // 0..1 (ratio of height/width)
  isMouthRound: boolean
  x: number // 0..1 center of mouth
  y: number // 0..1 center of mouth
  width: number // 0..1 width of mouth
}

export class FaceTracker {
  private video: HTMLVideoElement
  private landmarker: FaceLandmarker | null = null
  private lastTs = 0
  private readonly maxHz = 30
  private readonly wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  private readonly modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  private inferCanvas: HTMLCanvasElement | null = null
  private inferCtx: CanvasRenderingContext2D | null = null

  faces: FaceFeatures[] = []

  constructor(videoEl: HTMLVideoElement) {
    this.video = videoEl
  }

  async initLandmarker() {
    const resolver = await _FilesetResolver.forVisionTasks(this.wasmPath)
    this.landmarker = await _FaceLandmarker.createFromOptions(resolver as any, {
      baseOptions: {
        modelAssetPath: this.modelUrl,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    
    // Setup inference canvas if not already setup (might share logic with hand tracker but separate for now)
    if (!this.inferCanvas && this.video.videoWidth) {
        this.setupCanvas()
    }
  }

  private setupCanvas() {
    const w = Math.max(160, Math.min(320, this.video.videoWidth))
    const h = Math.round(w * (this.video.videoHeight / this.video.videoWidth || 3/4))
    this.inferCanvas = document.createElement('canvas')
    this.inferCanvas.width = w
    this.inferCanvas.height = h
    this.inferCtx = this.inferCanvas.getContext('2d')
  }

  update(now: number) {
    if (!this.landmarker || !this.video.videoWidth) return
    
    if (!this.inferCanvas) {
        this.setupCanvas()
    }
    if (!this.inferCtx || !this.inferCanvas) return

    if (now - this.lastTs < 1000 / this.maxHz) return
    this.lastTs = now

    this.inferCtx.drawImage(this.video, 0, 0, this.inferCanvas.width, this.inferCanvas.height)
    const result = this.landmarker.detectForVideo(this.inferCanvas as unknown as HTMLCanvasElement, now)
    
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      this.faces = []
      return
    }
    
    this.faces = result.faceLandmarks.map(lm => computeFaceFeatures(lm))
  }
}

type LM = { x: number; y: number; z: number }

function computeFaceFeatures(lm: LM[]): FaceFeatures {
  // Mouth landmarks
  // Upper lip bottom: 13
  // Lower lip top: 14
  // Left corner: 61
  // Right corner: 291
  
  const upper = lm[13]
  const lower = lm[14]
  const left = lm[61]
  const right = lm[291]
  
  const mouthHeight = dist(upper, lower)
  const mouthWidth = dist(left, right)
  
  // Ratio > 0.3 usually means open, > 0.5 usually means round "O" shape
  const ratio = mouthHeight / mouthWidth
  
  const isMouthRound = ratio > 0.5
  
  const center = {
    x: (upper.x + lower.x + left.x + right.x) / 4,
    y: (upper.y + lower.y + left.y + right.y) / 4
  }
  
  // Mirror x because it's a webcam
  const x = 1 - center.x
  const y = center.y

  return {
    mouthOpenness: ratio,
    isMouthRound,
    x,
    y,
    width: mouthWidth
  }
}

function dist(a: LM, b: LM) { 
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = a.z - b.z
    return Math.sqrt(dx*dx + dy*dy + dz*dz) 
}
