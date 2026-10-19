import { paperGrain } from './paper'
import type { HeroView } from './heroGlass'

/**
 * Behind the glass, pools of watercolour on warm paper: indigo, ochre, moss, rust and rose drift and
 * bleed into one another very slowly, each pool with the darker tide line pigment leaves at its edge.
 * Pools are painted at a third of the resolution and softened, then laid over a paper grain.
 */
const PIGMENTS = ['#3f5878', '#c99a4b', '#6f8a5a', '#b4664a', '#c98f8c', '#2f4c55', '#d8b46a']

export class WatercolourView implements HeroView {
  readonly veil = 'rgba(241,237,229,.56)'
  readonly condensation = { rate: 5, run: .15 }
  private wash = document.createElement('canvas')
  private paper = document.createElement('canvas') // cold-press grain
  private w = 1; private h = 1; private dpr = 1
  private pools = PIGMENTS.map((color, i) => ({ color, x: .12 + (i * .137) % .8, y: .2 + ((i * .29) % .6), r: .2 + (i % 3) * .07, fx: .021 + i * .004, fy: .017 + i * .003, phase: i * 1.7 }))

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr
    this.wash.width = Math.ceil(w / 3); this.wash.height = Math.ceil(h / 3)
    this.paper = paperGrain(w, h, dpr)
  }

  draw(g: CanvasRenderingContext2D, now: number) {
    const t = now / 1000, s = this.wash.getContext('2d')!, ww = this.wash.width, wh = this.wash.height, m = Math.min(ww, wh)
    s.globalCompositeOperation = 'source-over'; s.fillStyle = '#f1ebdf'; s.fillRect(0, 0, ww, wh)
    // Pigments mix where pools overlap, as glazes do.
    s.globalCompositeOperation = 'multiply'
    for (const p of this.pools) {
      const x = ww * (p.x + .08 * Math.sin(t * p.fx * 6 + p.phase)), y = wh * (p.y + .07 * Math.cos(t * p.fy * 6 + p.phase))
      const r = m * p.r * (1 + .06 * Math.sin(t * .23 + p.phase))
      const pool = s.createRadialGradient(x, y, 0, x, y, r)
      pool.addColorStop(0, p.color + '8c'); pool.addColorStop(.62, p.color + '70'); pool.addColorStop(.86, p.color + 'a6'); pool.addColorStop(1, p.color + '00')
      s.fillStyle = pool; s.beginPath(); s.arc(x, y, r, 0, Math.PI * 2); s.fill()
    }
    s.globalCompositeOperation = 'source-over'
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingQuality = 'high'
    g.save(); g.filter = 'blur(3px)'; g.drawImage(this.wash, -6, -6, g.canvas.width + 12, g.canvas.height + 12); g.restore()
    g.globalCompositeOperation = 'multiply'; g.drawImage(this.paper, 0, 0); g.globalCompositeOperation = 'source-over'
  }
}
