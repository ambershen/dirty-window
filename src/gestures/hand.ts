import type { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { FilesetResolver as _FilesetResolver, HandLandmarker as _HandLandmarker } from '@mediapipe/tasks-vision'
import { LandmarkSmoother } from './LandmarkSmoother'

export type GestureFeatures = {
  pinch: number       // 0..1
  pinchReach: number  // where thumb and index meet, from the palm centre, in palm lengths
  pinchX: number      // 0..1 (screen space, midway between thumb and index tips)
  pinchY: number
  openness: number    // 0..1
  isIndexExtended: boolean
  isPointing: boolean // index finger extended, others curled
  isOpenPalm?: boolean // all five fingers spread
  isFist: boolean     // all fingers curled
  tiltX: number       // radians delta
  tiltY: number       // radians delta
  x: number           // 0..1 (screen space, palm center)
  y: number           // 0..1 (screen space, palm center)
  indexTipX: number   // 0..1 (screen space, index fingertip)
  indexTipY: number   // 0..1 (screen space, index fingertip)
  width: number       // 0..1
  height: number      // 0..1
  points: { x: number; y: number }[] // all 21 landmarks, mirrored like x/y (0..1 of the camera frame)
}

export class HandTracker {
  cameraError = ''
  inferenceMs = 0
  resultTime = 0
  private video: HTMLVideoElement
  private landmarker: HandLandmarker | null = null
  private lastTs = 0
  private lastVideoTime = -1
  private readonly maxHz: number
  private readonly numHands: number
  private readonly wasmPath: string
  private readonly modelUrl: string
  private readonly inferenceWidth: number
  private readonly cameraDeviceId?: string
  private readonly trackingConfidence: number
  private inferCanvas: HTMLCanvasElement | null = null
  private inferCtx: CanvasRenderingContext2D | null = null
  private smoother: LandmarkSmoother

  // Initialize off-screen so we don't show a "hole" in the center before detection
  features: GestureFeatures = { pinch: 0, pinchReach: 0, pinchX: -1, pinchY: -1, openness: 0.5, isIndexExtended: false, isPointing: false, isFist: false, tiltX: 0, tiltY: 0, x: -1, y: -1, indexTipX: -1, indexTipY: -1, width: 0, height: 0, points: [] }
  hands: GestureFeatures[] = []

  constructor(videoEl: HTMLVideoElement, options: { maxHz?: number; numHands?: number; minCutoff?: number; beta?: number; wasmPath?: string; modelUrl?: string; inferenceWidth?: number; cameraDeviceId?: string; trackingConfidence?: number } = {}) {
    this.trackingConfidence = options.trackingConfidence ?? 0.5
    this.cameraDeviceId = options.cameraDeviceId
    this.inferenceWidth = options.inferenceWidth ?? 320
    this.wasmPath = options.wasmPath ?? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    this.modelUrl = options.modelUrl ?? 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
    this.video = videoEl
    this.maxHz = options.maxHz ?? 30
    this.numHands = options.numHands ?? 2
    this.smoother = new LandmarkSmoother(options.minCutoff ?? 1, options.beta ?? 0.007)
  }

  async initCamera(onProgress?: (message: string) => void, facing: 'user' | 'environment' = 'user'): Promise<boolean> {
    let stream: MediaStream | null = null
    let abandoned = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      this.cameraError = ''
      const initialize = async () => {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: {
        ...(this.cameraDeviceId ? { deviceId: { exact: this.cameraDeviceId } } : {}),
        facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 },
        frameRate: { ideal: this.maxHz }
      }, audio: false })
      if (abandoned) { acquired.getTracks().forEach(track=>track.stop()); return false }
      stream = acquired
      // Many webcams offer 60 fps only at 720p, so the 640×480 ideal settles on 30 fps.
      // Inference downsamples to inferenceWidth anyway, so prefer the higher frame rate.
      const track = acquired.getVideoTracks()[0]
      if (this.maxHz > 30 && track && (track.getCapabilities?.().frameRate?.max ?? 0) >= 50 && (track.getSettings().frameRate ?? 0) < 50) {
        try { await track.applyConstraints({ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { min: 50, ideal: this.maxHz } }) } catch { /* Keep the original mode. */ }
      }
      onProgress?.('Starting camera video…')
      this.video.srcObject = stream
      await this.video.play()
      if (abandoned) return false
      this.lastTs = 0
      this.lastVideoTime = -1
      this.smoother.clearAll()
      // Prepare downscaled canvas for inference
      const w = Math.max(160, Math.min(this.inferenceWidth, this.video.videoWidth))
      const h = Math.round(w * (this.video.videoHeight / this.video.videoWidth || 3/4))
      this.inferCanvas = document.createElement('canvas')
      this.inferCanvas.width = w
      this.inferCanvas.height = h
      this.inferCtx = this.inferCanvas.getContext('2d')
      return true
      }
      return await Promise.race([initialize(), new Promise<never>((_, reject) => {
        timeout = setTimeout(()=>reject(new Error('Camera startup timed out. Check camera access and try again.')),15000)
      })])
    } catch (e) {
      abandoned = true
      const current = this.video.srcObject as MediaStream | null
      current?.getTracks().forEach(track=>track.stop())
      this.video.srcObject = null
      this.cameraError = e instanceof Error ? e.message : String(e)
      return false
    } finally {
      clearTimeout(timeout)
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
      numHands: this.numHands,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: this.trackingConfidence,
      minTrackingConfidence: this.trackingConfidence
    })
  }

  dispose() {
    (this.video.srcObject as MediaStream|null)?.getTracks().forEach(track=>track.stop())
    this.video.srcObject=null
    this.landmarker?.close();this.landmarker=null;this.hands=[];this.smoother.clearAll()
  }

  update(now: number) {
    // Decimate inference to maxHz
    if (!this.landmarker || !this.video.videoWidth || !this.inferCtx || !this.inferCanvas) return
    if (this.video.currentTime === this.lastVideoTime) return
    if (now - this.lastTs < 1000 / this.maxHz - 2) return
    this.lastTs = now
    this.lastVideoTime = this.video.currentTime

    // Draw downscaled frame
    this.inferCtx.drawImage(this.video, 0, 0, this.inferCanvas.width, this.inferCanvas.height)
    const started = performance.now()
    const result = this.landmarker.detectForVideo(this.inferCanvas as unknown as HTMLCanvasElement, now)
    this.inferenceMs = performance.now() - started
    this.resultTime=now
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      this.hands = []
      this.smoother.clearAll()
      return
    }

    const tSeconds = now / 1000
    this.hands = result.landmarks.map((lm, i) => {
      const raw = computeFeatures(lm, result.worldLandmarks?.[i])
      const smoothed = this.smoother.smooth(i, raw.indexTipX, raw.indexTipY, raw.x, raw.y, tSeconds)
      return { ...raw, indexTipX: smoothed.indexTipX, indexTipY: smoothed.indexTipY, x: smoothed.x, y: smoothed.y }
    })
    // Keep legacy support
    this.features = this.hands[0]
  }
}

type LM = { x: number; y: number; z: number }

// Compute features from 21 hand landmarks
function computeFeatures(lm: LM[], world?: LM[]): GestureFeatures {
  const idxTip = lm[8]
  const thbTip = lm[4]
  const wrist = lm[0]
  const mid = lm[9]

  const handScale = dist(wrist, mid)

  // Pinch: normalized distance between thumb tip and index tip. World landmarks are a
  // metric 3D estimate, so the reading holds steady while the hand turns and moves; the
  // image landmarks' fingertip depth is noisy and flickers during fast strokes.
  const pinchSpace = world && world.length === 21 ? world : lm
  const pinchDist = dist(pinchSpace[4], pinchSpace[8])
  const pinch = clamp(1 - (pinchDist / (dist(pinchSpace[0], pinchSpace[9]) * 1.5)), 0, 1)

  // A real pinch meets in front of the palm; in a fist the thumb rests on the curled index,
  // so the tips are also close together but sit over the palm.
  const palmCentre = centroid([lm[0], lm[5], lm[9], lm[13], lm[17]])
  const pinchReach = dist(centroid([thbTip, idxTip]), palmCentre) / handScale

  // Openness: average distance of fingertips to palm center
  const tips = [lm[4], lm[8], lm[12], lm[16], lm[20]]
  const palm = centroid([lm[0], lm[5], lm[9], lm[13], lm[17]])
  const avg = tips.reduce((acc, t) => acc + dist(t, palm), 0) / tips.length
  const openness = clamp(avg / (handScale * 2), 0, 1)

  // isPointing: only index finger extended, all others curled
  const indexExtended = dist(lm[8], wrist) > dist(lm[6], wrist)
  // A curled index can still be farther from the wrist at some camera angles.
  // Require its segments to align and its tip to extend beyond the knuckle.
  const base = { x: lm[6].x-lm[5].x, y: lm[6].y-lm[5].y, z: lm[6].z-lm[5].z }
  const tip = { x: lm[8].x-lm[6].x, y: lm[8].y-lm[6].y, z: lm[8].z-lm[6].z }
  const alignment = (base.x*tip.x + base.y*tip.y + base.z*tip.z) /
    Math.max(1e-8, Math.hypot(base.x,base.y,base.z)*Math.hypot(tip.x,tip.y,tip.z))
  const indexStraight = alignment > 0.7 && dist(lm[8],lm[5]) > dist(lm[6],lm[5])*1.6
  const thumbCurled = dist(lm[4], palm) < handScale * 1.0
  const middleCurled = dist(lm[12], palm) < handScale * 0.8
  const ringCurled = dist(lm[16], palm) < handScale * 0.8
  const pinkyCurled = dist(lm[20], palm) < handScale * 0.8
  const isPointing = indexExtended && indexStraight && thumbCurled && middleCurled && ringCurled && pinkyCurled && openness < 0.55

  // isFist: all fingertips close to palm
  const isFist = tips.every(t => dist(t, palm) < handScale * 0.8)

  // Palm wiping must tolerate a relaxed thumb and a slightly angled hand.
  // Pinch already measures thumb separation; requiring the thumb to be a full
  // palm-length from the centre rejected ordinary open hands.
  const isOpenPalm = !isFist && pinch < .62 &&
    [[8,6],[12,10],[16,14],[20,18]].every(([tip,joint]) =>
      dist(lm[tip],wrist)>dist(lm[joint],wrist)*1.02 &&
      dist(lm[tip],palm)>handScale*.65)

  // Tilt: use wrist→mid direction as palm normal proxy in screen space
  const dx = (mid.x - wrist.x)
  const dy = (mid.y - wrist.y)

  // Screen space position (using palm centroid), mirrored for webcam
  const x = 1 - palm.x
  const y = palm.y

  // Index fingertip position (mirrored)
  const indexTipX = 1 - idxTip.x
  const indexTipY = idxTip.y

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

  // The pen point is where thumb and index meet: steadier than the index tip alone,
  // which swings as the pinch tightens or loosens.
  const pinchX = 1 - (thbTip.x + idxTip.x) / 2
  const pinchY = (thbTip.y + idxTip.y) / 2

  return { pinch, pinchReach, pinchX, pinchY, openness, isOpenPalm, isIndexExtended: indexExtended && indexStraight, isPointing, isFist, tiltX: -dy * 0.5, tiltY: dx * 0.5, x, y, indexTipX, indexTipY, width, height, points: lm.map(p => ({ x: 1 - p.x, y: p.y })) }
}

function dist(a: LM, b: LM) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx*dx + dy*dy + dz*dz) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function centroid(points: LM[]) { const n = points.length; let x=0,y=0,z=0; for (const p of points){x+=p.x;y+=p.y;z+=p.z;} return { x:x/n, y:y/n, z:z/n } }
