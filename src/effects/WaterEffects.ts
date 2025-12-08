
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 100, g: 200, b: 255 }
}

export class WaterEffects {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: SplashParticle[] = []
  private ripples: Ripple[] = []
  private rainDrops: RainDrop[] = []
  private lastRippleTime = 0

  // Configurable properties
  splashColor = '#64c8ff' // Default blue-ish
  splashVolume = 5
  rainVolume = 0 // 0..1

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'fixed'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.pointerEvents = 'none' // Let clicks pass through
    this.canvas.style.zIndex = '9999' // On top of everything
    document.body.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  // Call this when hand is open
  emitSplash(x: number, y: number) {
    const rgb = hexToRgb(this.splashColor)
    // Emit a few particles per frame based on volume
    for (let i = 0; i < this.splashVolume; i++) {
      this.particles.push(new SplashParticle(x, y, rgb))
    }
  }

  // Call this when hand is pinching
  emitRipple(x: number, y: number, now: number) {
    // Limit ripple creation rate (e.g., 5 per second)
    if (now - this.lastRippleTime > 200) {
      this.ripples.push(new Ripple(x, y))
      this.lastRippleTime = now
    }
  }

  update() {
    const w = this.canvas.width
    const h = this.canvas.height
    this.ctx.clearRect(0, 0, w, h)

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.update()
      p.draw(this.ctx)
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }

    // Update and draw ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]
      r.update()
      r.draw(this.ctx)
      if (r.life <= 0) {
        this.ripples.splice(i, 1)
      }
    }

    // Handle Rain
    if (this.rainVolume > 0) {
      // Probability to spawn rain drop based on volume (0..1)
      // If volume is 1, spawn roughly 2-3 drops per frame
      if (Math.random() < this.rainVolume) {
         this.rainDrops.push(new RainDrop(
           Math.random() * w,
           Math.random() * h
         ))
      }
    }

    // Update and draw rain drops
    for (let i = this.rainDrops.length - 1; i >= 0; i--) {
      const r = this.rainDrops[i]
      r.update()
      r.draw(this.ctx)
      if (r.life <= 0) {
        this.rainDrops.splice(i, 1)
      }
    }
  }
}

class RainDrop {
  x: number
  y: number
  size: number
  life: number
  
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.size = Math.random() * 2 + 1
    this.life = 1.0
  }

  update() {
    this.life -= 0.005 // Slow fade
    this.y += 0.5 // Slow trickle down
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgba(200, 220, 255, ${this.life * 0.6})`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

class SplashParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  colorBase: string

  constructor(x: number, y: number, rgb: { r: number, g: number, b: number }) {
    this.x = x
    this.y = y
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 4 + 2
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed - 2 // Slight upward bias
    this.life = 1.0
    this.maxLife = 1.0
    this.size = Math.random() * 4 + 3
    
    this.colorBase = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b},`
  }

  update() {
    this.x += this.vx
    this.y += this.vy
    this.vy += 0.2 // Gravity
    this.life -= 0.015
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `${this.colorBase} ${this.life})`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

class Ripple {
  x: number
  y: number
  radius: number
  life: number
  maxLife: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.radius = 0
    this.life = 1.0
    this.maxLife = 1.0
  }

  update() {
    this.radius += 2 // Expansion speed
    this.life -= 0.015
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.life
    ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.stroke()
  }
}
