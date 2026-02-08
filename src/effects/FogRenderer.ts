// Simplex noise implementation for organic fog texture
class SimplexNoise {
  private perm: number[] = []

  constructor(seed = Math.random() * 65536) {
    const p = new Array(256)
    for (let i = 0; i < 256; i++) p[i] = i

    // Seed-based shuffle
    let s = seed
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647
      const j = s % (i + 1)
      ;[p[i], p[j]] = [p[j], p[i]]
    }

    this.perm = [...p, ...p]
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7
    const u = h < 4 ? x : y
    const v = h < 4 ? y : x
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v)
  }

  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1)
    const G2 = (3 - Math.sqrt(3)) / 6

    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)

    const t = (i + j) * G2
    const X0 = i - t
    const Y0 = j - t
    const x0 = x - X0
    const y0 = y - Y0

    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1

    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255

    let n0 = 0, n1 = 0, n2 = 0

    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 >= 0) {
      t0 *= t0
      n0 = t0 * t0 * this.grad(this.perm[ii + this.perm[jj]], x0, y0)
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 >= 0) {
      t1 *= t1
      n1 = t1 * t1 * this.grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1)
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 >= 0) {
      t2 *= t2
      n2 = t2 * t2 * this.grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2)
    }

    return 70 * (n0 + n1 + n2)
  }

  // Fractal Brownian Motion for richer texture
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, persistence = 0.5): number {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency)
      maxValue += amplitude
      amplitude *= persistence
      frequency *= lacunarity
    }

    return value / maxValue
  }
}

export class FogRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private blurCanvas: HTMLCanvasElement
  private blurCtx: CanvasRenderingContext2D
  private maskCanvas: HTMLCanvasElement
  private maskCtx: CanvasRenderingContext2D
  private noiseCanvas: HTMLCanvasElement
  private noiseCtx: CanvasRenderingContext2D
  private width = 0
  private height = 0

  // Fog Appearance
  private fogColor = 'rgba(255, 255, 255, 0.55)' // Increased opacity for more frosted look
  private blurAmount = 6 // Downscale factor (lower = more blur)
  private difficulty = 0 // 0..1

  // Noise settings
  private noise: SimplexNoise
  private noiseScale = 0.003 // Lower = larger noise features
  private noiseIntensity = 0.45 // How much noise affects fog density
  private noiseTime = 0 // For animated noise
  private noiseAnimSpeed = 0.0003 // Speed of noise animation

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'fog-canvas'
    this.canvas.style.position = 'fixed'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.zIndex = '10' // Same as old #frosted-glass
    this.canvas.style.pointerEvents = 'none'
    // Ensure we flip it to match the video mirror
    this.canvas.style.transform = 'scaleX(-1)'

    const ctx = this.canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('2D context failed')
    this.ctx = ctx

    // Offscreen canvas for downscaled blur
    this.blurCanvas = document.createElement('canvas')
    this.blurCtx = this.blurCanvas.getContext('2d', { alpha: false })!

    // Offscreen canvas for the wipe mask (stores the "erased" state)
    this.maskCanvas = document.createElement('canvas')
    this.maskCtx = this.maskCanvas.getContext('2d')!

    // Offscreen canvas for procedural noise texture
    this.noiseCanvas = document.createElement('canvas')
    this.noiseCtx = this.noiseCanvas.getContext('2d')!

    // Initialize simplex noise
    this.noise = new SimplexNoise()

    // Don't auto-append; let the layer manage DOM attachment
    this.resize()
  }

  appendTo(parent: HTMLElement) {
    parent.appendChild(this.canvas)
  }

  show() {
    this.canvas.style.display = ''
  }

  hide() {
    this.canvas.style.display = 'none'
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  // Gradually restore fog (fog creeps back over cleared areas)
  restoreFog(speed: number) {
    if (speed <= 0) return
    this.maskCtx.globalCompositeOperation = 'source-over'
    this.maskCtx.fillStyle = `rgba(255, 255, 255, ${speed * 0.008})`
    this.maskCtx.fillRect(0, 0, this.width, this.height)
  }

  resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.canvas.width = this.width
    this.canvas.height = this.height

    // Blur canvas is smaller
    const blurW = Math.max(1, Math.floor(this.width / this.blurAmount))
    const blurH = Math.max(1, Math.floor(this.height / this.blurAmount))
    this.blurCanvas.width = blurW
    this.blurCanvas.height = blurH

    // Noise canvas at 1/4 resolution for performance
    const noiseW = Math.max(1, Math.floor(this.width / 4))
    const noiseH = Math.max(1, Math.floor(this.height / 4))
    this.noiseCanvas.width = noiseW
    this.noiseCanvas.height = noiseH

    // Mask canvas is full resolution for sharp edges
    // But we need to preserve its content on resize if possible
    // For now, just reset (wiping usually resets on resize anyway)
    if (this.maskCanvas.width !== this.width || this.maskCanvas.height !== this.height) {
      this.maskCanvas.width = this.width
      this.maskCanvas.height = this.height
      this.resetMask()
    }

    // Generate initial noise texture
    this.generateNoiseTexture()
  }

  // Generate procedural noise texture for organic fog appearance
  private generateNoiseTexture() {
    const w = this.noiseCanvas.width
    const h = this.noiseCanvas.height
    const imageData = this.noiseCtx.createImageData(w, h)
    const data = imageData.data

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Use FBM for richer, more organic texture
        const nx = x * this.noiseScale * 4 // Scale up since canvas is 1/4 size
        const ny = y * this.noiseScale * 4
        const nt = this.noiseTime

        // Multi-octave noise for more detail
        const n = this.noise.fbm(nx + nt, ny + nt * 0.7, 4, 2, 0.5)

        // Map noise from [-1, 1] to [0, 1] then to intensity range
        const value = (n + 1) * 0.5
        const intensity = 0.7 + value * this.noiseIntensity // Base fog + noise variation

        const i = (y * w + x) * 4
        // White fog with varying alpha for frosted texture
        data[i] = 255     // R
        data[i + 1] = 255 // G
        data[i + 2] = 255 // B
        data[i + 3] = Math.floor(intensity * 140) // Alpha (more visible frost texture)
      }
    }

    this.noiseCtx.putImageData(imageData, 0, 0)
  }

  // Update noise for animation (call periodically)
  updateNoise() {
    this.noiseTime += this.noiseAnimSpeed
    this.generateNoiseTexture()
  }

  setDifficulty(d: number) {
    this.difficulty = Math.max(0, Math.min(1, d))
  }

  // Fill mask with white (opaque fog)
  resetMask() {
    this.maskCtx.globalCompositeOperation = 'source-over'
    this.maskCtx.fillStyle = '#fff'
    this.maskCtx.fillRect(0, 0, this.width, this.height)
  }

  // Erase: Draw on the mask where we wipe with soft radial gradient edges
  eraseBlob(x: number, y: number, r: number, alpha: number) {
    // Note: In our composition logic, we will use the mask to *keep* the fog.
    // So "white" = fog, "black/transparent" = clear.
    // eraseBlob should make the mask transparent.

    // Use destination-out to remove white with soft gradient edges
    this.maskCtx.save()
    this.maskCtx.globalCompositeOperation = 'destination-out'

    // Create radial gradient for soft falloff edges
    // Center is fully opaque (complete erasure), edges fade to transparent
    const gradient = this.maskCtx.createRadialGradient(x, y, 0, x, y, r)

    // Inner core: strong erasure
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    // Middle: still visible erasure
    gradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.85})`)
    // Outer transition: soft fade
    gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.4})`)
    // Edge: very soft fade out
    gradient.addColorStop(0.9, `rgba(255, 255, 255, ${alpha * 0.1})`)
    // Outer edge: fully transparent
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.maskCtx.fillStyle = gradient

    // Add slight organic variation with noise-based displacement
    // Draw slightly larger circle to accommodate the gradient fade
    const outerR = r * 1.2

    // Draw main circular shape with soft edges
    this.maskCtx.beginPath()
    this.maskCtx.arc(x, y, outerR, 0, Math.PI * 2)
    this.maskCtx.fill()

    // Optional: Add smaller scattered dots around main blob for organic feel
    const numDots = 3 + Math.floor(Math.random() * 4)
    for (let i = 0; i < numDots; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = r * (0.6 + Math.random() * 0.5)
      const dotX = x + Math.cos(angle) * dist
      const dotY = y + Math.sin(angle) * dist
      const dotR = r * (0.1 + Math.random() * 0.15)

      const dotGradient = this.maskCtx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotR)
      dotGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.5})`)
      dotGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

      this.maskCtx.fillStyle = dotGradient
      this.maskCtx.beginPath()
      this.maskCtx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      this.maskCtx.fill()
    }

    this.maskCtx.restore()
  }

  eraseStroke(x0: number, y0: number, x1: number, y1: number, r: number, alpha: number) {
    const dx = x1 - x0
    const dy = y1 - y0
    const dist = Math.hypot(dx, dy)
    const step = Math.max(2, r * 0.25) 
    const steps = Math.ceil(dist / step)

    if (steps === 0) {
      this.eraseBlob(x1, y1, r, alpha)
      return
    }

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.eraseBlob(x0 + dx * t, y0 + dy * t, r, alpha)
    }
  }

  render(video: HTMLVideoElement) {
    if (!video.videoWidth) return

    // Animate noise texture (throttled for performance)
    if (Math.random() < 0.1) {
      this.updateNoise()
    }

    // 1. Draw Blurred Video
    // Draw video to small canvas
    this.blurCtx.drawImage(video, 0, 0, this.blurCanvas.width, this.blurCanvas.height)

    // 2. Main Composition
    // Clear
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.clearRect(0, 0, this.width, this.height)

    // Draw the blurred image, scaled up
    // This provides the "foggy" background
    // We want this ONLY where the mask is White.

    this.ctx.save()

    // A. Draw heavily blurred video as base
    this.ctx.filter = 'blur(8px)' // Strong blur for frosted glass effect
    this.ctx.drawImage(this.blurCanvas, 0, 0, this.width, this.height)
    this.ctx.filter = 'none'

    // B. Draw primary fog tint (thick white overlay for frosted look)
    this.ctx.fillStyle = this.fogColor
    this.ctx.fillRect(0, 0, this.width, this.height)

    // C. Add second fog layer for extra frost density
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.fillStyle = 'rgba(240, 245, 255, 0.3)' // Slight blue-white tint
    this.ctx.fillRect(0, 0, this.width, this.height)

    // D. Draw Noise Texture for organic fog appearance
    // Use 'overlay' blend to add texture variation
    this.ctx.globalCompositeOperation = 'overlay'
    this.ctx.globalAlpha = 0.25 // More visible noise for texture
    this.ctx.drawImage(this.noiseCanvas, 0, 0, this.width, this.height)
    this.ctx.globalAlpha = 1

    // E. Add subtle vignette effect (slightly darker/cooler edges)
    this.ctx.globalCompositeOperation = 'multiply'
    const vignetteGradient = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.2,
      this.width / 2, this.height / 2, this.height * 0.85
    )
    vignetteGradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    vignetteGradient.addColorStop(0.6, 'rgba(248, 250, 255, 1)')
    vignetteGradient.addColorStop(1, 'rgba(220, 230, 245, 1)')
    this.ctx.fillStyle = vignetteGradient
    this.ctx.fillRect(0, 0, this.width, this.height)

    // E. Apply Mask
    // We want to KEEP pixels where Mask is White.
    // We want to REMOVE pixels where Mask is Black (Transparent).
    // 'destination-in' keeps destination where source is opaque.
    this.ctx.globalCompositeOperation = 'destination-in'
    this.ctx.drawImage(this.maskCanvas, 0, 0)

    this.ctx.restore()
  }
  
  clear() {
      this.resetMask()
  }
  
  destroy() {
      this.canvas.remove()
  }
}
