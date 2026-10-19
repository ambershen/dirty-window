import type { HeroView } from './heroGlass'

/**
 * Behind the glass, a wet night: distant warm windows and street lamps blur into bokeh, a little
 * light catches the falling rain, and the glass itself is busy with drops that gather and run.
 */
type Light = { x: number; y: number; r: number; color: string; alpha: number; phase: number; drift: number }

export class RainView implements HeroView {
  readonly veil = 'rgba(150,160,168,.4)'
  readonly condensation = { rate: 34, run: 1.3, size: 1.7 }
  private base = document.createElement('canvas')
  private lights: Light[] = []
  private w = 1; private h = 1; private dpr = 1
  private look = { x: 0, y: 0 }; private target = { x: 0, y: 0 }

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr
    this.base.width = Math.round(w * dpr); this.base.height = Math.round(h * dpr)
    const g = this.base.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#0b1217'); sky.addColorStop(.55, '#15212a'); sky.addColorStop(1, '#0d1519')
    g.fillStyle = sky; g.fillRect(0, 0, w, h)
    // A low glow where the town is.
    const town = g.createRadialGradient(w * .55, h * .62, 0, w * .55, h * .62, w * .6)
    town.addColorStop(0, '#5a3e2a66'); town.addColorStop(1, '#5a3e2a00')
    g.fillStyle = town; g.fillRect(0, 0, w, h)
    const palette = ['#f2c27a', '#eda766', '#e8935a', '#f6dca6', '#9ec3d8', '#c9d8e2']
    this.lights = Array.from({ length: Math.round(w * h / 22000) + 18 }, () => {
      const near = Math.random() < .3
      return { x: Math.random() * w, y: h * (.35 + Math.random() * .5), r: near ? 18 + Math.random() * 26 : 4 + Math.random() * 12, color: palette[Math.floor(Math.random() * palette.length)], alpha: near ? .18 + Math.random() * .2 : .35 + Math.random() * .45, phase: Math.random() * 6.3, drift: near ? 1 : .35 }
    })
  }

  lookAt(x: number, y: number) { this.target = { x, y } }

  draw(g: CanvasRenderingContext2D, now: number) {
    const { w, h, dpr } = this, t = now / 1000
    this.look.x += (this.target.x - this.look.x) * .05; this.look.y += (this.target.y - this.look.y) * .05
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.base, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Out-of-focus lights: soft discs with a brighter rim, as a lens renders them.
    g.globalCompositeOperation = 'screen'
    for (const l of this.lights) {
      const x = l.x - this.look.x * 18 * l.drift, y = l.y - this.look.y * 8 * l.drift
      const a = l.alpha * (.85 + .15 * Math.sin(t * .7 + l.phase))
      const disc = g.createRadialGradient(x, y, 0, x, y, l.r)
      disc.addColorStop(0, l.color + hex(a * .55)); disc.addColorStop(.82, l.color + hex(a * .7)); disc.addColorStop(.95, l.color + hex(a)); disc.addColorStop(1, l.color + '00')
      g.fillStyle = disc; g.beginPath(); g.arc(x, y, l.r, 0, Math.PI * 2); g.fill()
    }
    // Rain falling in the light: faint slanted streaks.
    g.strokeStyle = '#c9d8e2'; g.lineWidth = 1
    for (let i = 0; i < 70; i++) {
      const seed = i * 97.13, x = ((seed * 13.7 + t * 40) % (w + 80)) - 40, y = ((seed * 7.3 + t * 620 * (.7 + (i % 5) * .08)) % (h + 60)) - 30
      g.globalAlpha = .06 + (i % 4) * .025; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 18); g.stroke()
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'
  }
}

function hex(alpha: number) { return Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0') }
