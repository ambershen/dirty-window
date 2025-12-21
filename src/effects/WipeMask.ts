export class WipeMask {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private lastAppliedUrl: string | null = null
  private lastApplyTs = 0
  private maxApplyHz = 30
  private applying = false
  private difficulty = 0 // 0..1 (0 easy, 1 hard)
  private urlPool: string[] = []
  private initializedEls = new WeakSet<HTMLElement>()

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.fillBlack()
  }

  resize(width: number, height: number) {
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width
    this.canvas.height = height
    this.fillBlack()
  }

  clear() {
    this.fillBlack()
    this.deferRevoke(this.lastAppliedUrl)
    this.lastAppliedUrl = null
    this.lastApplyTs = 0
    while (this.urlPool.length) this.deferRevoke(this.urlPool.pop()!)
  }

  setDifficulty(d: number) {
    this.difficulty = Math.max(0, Math.min(1, d))
  }

  eraseBlob(x: number, y: number, r: number, alpha?: number) {
    const base = 0.15 + (1 - this.difficulty) * (0.85 - 0.15)
    const a = Math.max(0.05, Math.min(0.95, alpha ?? base))
    const n = 12 + Math.floor(Math.random() * 8)
    const a0 = Math.random() * Math.PI * 2
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < n; i++) {
      const t = a0 + (i / n) * Math.PI * 2
      const k = 0.6 + Math.random() * 0.6
      const rx = r * k
      const ry = r * k
      pts.push({ x: x + Math.cos(t) * rx, y: y + Math.sin(t) * ry })
    }
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.globalAlpha = a
    // Slight blur to soften polygon edges and reduce jitter perception
    ;(this.ctx as any).filter = 'blur(1.5px)'
    this.ctx.beginPath()
    this.ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i].x, pts[i].y)
    }
    this.ctx.closePath()
    this.ctx.fill()
    ;(this.ctx as any).filter = 'none'
    this.ctx.restore()
  }

  eraseStroke(x0: number, y0: number, x1: number, y1: number, r: number, alpha: number) {
    const dx = x1 - x0
    const dy = y1 - y0
    const dist = Math.hypot(dx, dy)
    // Step size: smaller means smoother but more expensive. r * 0.25 ensures good overlap.
    const step = Math.max(2, r * 0.25) 
    const steps = Math.ceil(dist / step)

    if (steps === 0) {
      this.eraseBlob(x1, y1, r, alpha)
      return
    }

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x0 + dx * t
      const y = y0 + dy * t
      this.eraseBlob(x, y, r, alpha)
    }
  }

  restoreFog(speed: number) {
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'source-over'
    // Ensure speed is within a reasonable range for alpha (0..1)
    // Very small values are needed for gradual restoration (e.g. 0.005)
    this.ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.001, Math.min(0.1, speed))})`
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()
  }

  addFog(x: number, y: number, r: number, alpha: number) {
    // Similar to eraseBlob but adds fog (black color)
    const a = Math.max(0.05, Math.min(0.95, alpha))
    const n = 12 + Math.floor(Math.random() * 8)
    const a0 = Math.random() * Math.PI * 2
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < n; i++) {
      const t = a0 + (i / n) * Math.PI * 2
      const k = 0.6 + Math.random() * 0.6
      const rx = r * k
      const ry = r * k
      pts.push({ x: x + Math.cos(t) * rx, y: y + Math.sin(t) * ry })
    }
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.fillStyle = '#000' // Black restores the mask (fog)
    this.ctx.globalAlpha = a
    // Soft blur for breath effect
    ;(this.ctx as any).filter = 'blur(10px)'
    this.ctx.beginPath()
    this.ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i].x, pts[i].y)
    }
    this.ctx.closePath()
    this.ctx.fill()
    ;(this.ctx as any).filter = 'none'
    this.ctx.restore()
  }

  applyTo(el: HTMLElement) {
    const now = performance.now()
    if (now - this.lastApplyTs < 1000 / this.maxApplyHz) return
    if (this.applying) return
    this.applying = true
    const initEl = () => {
      if (!this.initializedEls.has(el)) {
        el.style.webkitMaskRepeat = 'no-repeat'
        el.style.maskRepeat = 'no-repeat'
        el.style.webkitMaskSize = '100% 100%'
        el.style.maskSize = '100% 100%'
        el.style.willChange = '-webkit-mask-image, mask-image'
        el.style.transform = 'translateZ(0)'
        this.initializedEls.add(el)
      }
    }
    const swapUrl = (url: string) => {
      if (this.lastAppliedUrl) this.urlPool.push(this.lastAppliedUrl)
      this.lastAppliedUrl = url
      this.lastApplyTs = performance.now()
      requestAnimationFrame(() => {
        initEl()
        el.style.webkitMaskImage = `url(${url})`
        el.style.maskImage = `url(${url})`
        this.applying = false
        // Defer revocation to avoid races with compositor
        // Increase pool size and delay to prevent flickering
        while (this.urlPool.length > 12) this.deferRevoke(this.urlPool.shift()!)
      })
    }
    const processBlob = (b: Blob | null) => {
        let url: string
        if (b) {
            url = URL.createObjectURL(b)
        } else {
            url = this.canvas.toDataURL('image/png')
        }
        
        // Pre-decode the image to prevent flickering
        const img = new Image()
        img.src = url
        const finalize = () => swapUrl(url)
        
        if ((img as any).decode) {
            img.decode().then(finalize).catch(() => {
                // If decode fails, try finalize anyway (might flicker but better than stuck)
                finalize() 
            })
        } else {
            img.onload = finalize
            img.onerror = finalize
        }
    }

    if (this.canvas.toBlob) {
      this.canvas.toBlob(processBlob, 'image/png')
    } else {
      processBlob(null)
    }
  }

  removeFrom(el: HTMLElement) {
    el.style.webkitMaskImage = ''
    el.style.maskImage = ''
  }

  private fillBlack() {
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private deferRevoke(url: string | null) {
    if (!url) return
    setTimeout(() => {
      try { URL.revokeObjectURL(url) } catch {}
    }, 1500)
  }
}
