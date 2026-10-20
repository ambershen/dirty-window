/**
 * The view through the hero window, painted for the visitor's own hour: dawn, day, dusk or night.
 * Sky, three ranges of hills and the lake are cached as separate layers so they can shift by
 * different amounts as the pointer moves, like looking out while moving your head.
 */
import type { HeroView } from './heroGlass'
import { paperGrain } from './paper'

export type Hour = 'dawn' | 'day' | 'dusk' | 'night'

type Palette = { sky: string[]; hills: string[]; lake: string[]; reeds: string; sun: { x: number; y: number; r: number; core: string; glow: string; streak: string }; clouds: string; veil: string; stars: boolean }
const PALETTES: Record<Hour, Palette> = {
  dawn: { sky: ['#7f8fb2', '#b59cb6', '#e3a79c', '#f0c79c'], hills: ['#8f8aa3', '#62677f', '#3a4258'], lake: ['#d9ae9f', '#77768a', '#262d3d'], reeds: '#272e3a',
    sun: { x: .3, y: .53, r: .045, core: '#fff3e0', glow: '#fde6cfb0', streak: '#fbe3cc' }, clouds: '#fff4ee', veil: 'rgba(234,234,236,.6)', stars: false },
  day: { sky: ['#6f9bbb', '#93b8cc', '#c4d8dc', '#e6ece2'], hills: ['#8aa596', '#5c7f6c', '#36533f'], lake: ['#a9c8cf', '#5f8584', '#24403d'], reeds: '#2a3d33',
    sun: { x: .76, y: .2, r: .04, core: '#fffdf4', glow: '#fffbe680', streak: '#ffffff' }, clouds: '#ffffff', veil: 'rgba(236,239,236,.6)', stars: false },
  dusk: { sky: ['#9fb3b0', '#c9b7ae', '#df9f86', '#efc39c'], hills: ['#8e9c96', '#5f736d', '#34494a'], lake: ['#c99a85', '#6f7d78', '#25393a'], reeds: '#1f302f',
    sun: { x: .7, y: .5, r: .055, core: '#fbefd9', glow: '#fbe6c6c0', streak: '#f8dcb4' }, clouds: '#fff3ea', veil: 'rgba(234,237,233,.6)', stars: false },
  night: { sky: ['#101a2b', '#1a2740', '#2b3a57', '#43506b'], hills: ['#29344a', '#1b2436', '#111824'], lake: ['#3a4660', '#1a2232', '#0a0f17'], reeds: '#070b11',
    sun: { x: .72, y: .24, r: .03, core: '#eef0ea', glow: '#dfe6f080', streak: '#d9e2ee' }, clouds: '#a9b6cc', veil: 'rgba(206,212,222,.58)', stars: true },
}

export function hourNow(date = new Date()): Hour {
  const forced = new URLSearchParams(location.search).get('time')
  if (forced && forced in PALETTES) return forced as Hour
  const h = date.getHours() + date.getMinutes() / 60
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20.5 ? 'dusk' : 'night'
}

const OVERSCAN = 40 // layers are wider than the window so parallax never shows an edge

export class WindowView implements HeroView {
  readonly hour: Hour
  readonly veil: string
  private p: Palette
  private layers: HTMLCanvasElement[] = [] // sky, far hills, middle hills, near hills, lake
  private paper = document.createElement('canvas') // fine paper grain, so the view reads as painted
  private w = 1; private h = 1; private dpr = 1
  private stars: { x: number; y: number; r: number; phase: number }[] = []
  private clouds = Array.from({ length: 5 }, (_, i) => ({ y: .1 + i * .07 + Math.random() * .03, x: Math.random(), len: .22 + Math.random() * .3, speed: .004 + Math.random() * .006, alpha: .14 + Math.random() * .12 }))
  private look = { x: 0, y: 0 } // eased pointer, -1..1

  constructor(hour = hourNow()) { this.hour = hour; this.p = PALETTES[hour]; this.veil = this.p.veil }

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr
    const W = w + OVERSCAN * 2, horizon = h * .66, p = this.p
    const layer = (paint: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(h * dpr)
      const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); paint(g); return c
    }
    const sky = layer(g => {
      const grad = g.createLinearGradient(0, 0, 0, horizon); p.sky.forEach((c, i) => grad.addColorStop([0, .38, .72, 1][i], c))
      g.fillStyle = grad; g.fillRect(0, 0, W, horizon + 4)
    })
    const ranges = [[.5, .07, 3], [.57, .09, 7], [.63, .06, 11]].map(([base, amp, seed], i) => layer(g => {
      g.fillStyle = p.hills[i]; g.beginPath(); g.moveTo(0, h)
      for (let x = 0; x <= W + 8; x += 8) {
        const u = x / W, y = h * (base - amp * (.55 * Math.sin(u * 5.1 + seed) + .3 * Math.sin(u * 11.7 + seed * 2) + .15 * Math.sin(u * 23 + seed * 3)))
        g.lineTo(x, Math.min(y, horizon + 1))
      }
      g.lineTo(W, h); g.closePath(); g.fill()
    }))
    const lake = layer(g => {
      const grad = g.createLinearGradient(0, horizon, 0, h); p.lake.forEach((c, i) => grad.addColorStop([0, .25, 1][i], c))
      g.fillStyle = grad; g.fillRect(0, horizon, W, h - horizon)
      g.fillStyle = p.reeds
      for (let x = -4; x < W; x += 3 + Math.random() * 5) {
        const reed = h * (.04 + Math.random() * .07), lean = (Math.random() - .5) * 8
        g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * .3, h - reed * .6, x + lean, h - reed); g.lineTo(x + lean + 1.4, h - reed); g.quadraticCurveTo(x + 2, h - reed * .5, x + 3, h); g.fill()
      }
    })
    this.layers = [sky, ...ranges, lake]
    this.paper = paperGrain(w, h, dpr, this.hour === 'night' ? 9 : 12)
    this.stars = p.stars ? Array.from({ length: Math.round(w * h / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * horizon * .82, r: Math.random() < .12 ? 1.3 : .7, phase: Math.random() * 6.3 })) : []
  }

  /** Where the viewer is looking from, -1..1 on each axis; eased in draw(). */
  lookAt(x: number, y: number) { this.target = { x, y } }
  private target = { x: 0, y: 0 }

  draw(g: CanvasRenderingContext2D, now: number) {
    const { w, h, dpr, p } = this, t = now / 1000, horizon = h * .66
    this.look.x += (this.target.x - this.look.x) * .05; this.look.y += (this.target.y - this.look.y) * .05
    // Deeper layers move less: the sky barely, the near reeds the most.
    const depth = [.15, .35, .55, .8, 1], shift = (i: number) => -OVERSCAN - this.look.x * OVERSCAN * depth[i]
    const lift = (i: number) => -this.look.y * 8 * depth[i]
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w * dpr, h * dpr)
    const blit = (i: number) => g.drawImage(this.layers[i], Math.round(shift(i) * dpr), Math.round(lift(i) * dpr))
    blit(0)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Stars twinkle slowly on clear nights.
    for (const s of this.stars) {
      g.globalAlpha = .35 + .5 * (.5 + .5 * Math.sin(t * .9 + s.phase))
      g.fillStyle = '#f2f4f8'; g.fillRect(s.x + shift(0), s.y + lift(0), s.r, s.r)
    }
    g.globalAlpha = 1
    // The sun or moon, glowing gently; it sinks behind the far hills.
    const sx = w * p.sun.x + shift(1) + OVERSCAN, sy = h * p.sun.y + lift(1), sr = Math.min(w, h) * p.sun.r * (1 + .015 * Math.sin(t * .6))
    const glow = g.createRadialGradient(sx, sy, sr * .4, sx, sy, sr * 5)
    glow.addColorStop(0, p.sun.glow); glow.addColorStop(1, p.sun.glow.slice(0, 7) + '00')
    g.fillStyle = glow; g.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10)
    g.fillStyle = p.sun.core; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill()
    // Long soft clouds drift.
    g.save(); g.filter = `blur(${Math.max(6, h * .02)}px)`
    for (const c of this.clouds) {
      const x = ((c.x + t * c.speed) % 1.6 - .3) * w + shift(0) + OVERSCAN
      g.globalAlpha = c.alpha; g.fillStyle = p.clouds; g.beginPath(); g.ellipse(x, c.y * h + lift(0), c.len * w * .5, h * .012, 0, 0, Math.PI * 2); g.fill()
    }
    g.restore()
    g.setTransform(1, 0, 0, 1, 0, 0)
    for (let i = 1; i < 5; i++) blit(i)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    // The light's reflection: short strokes on the lake, flickering as the surface moves.
    g.save(); g.globalCompositeOperation = 'screen'
    for (let i = 0; i < 26; i++) {
      const y = horizon + 4 + i * (h * .012) + lift(4), spread = 6 + i * 1.8, flicker = .5 + .5 * Math.sin(t * 2.1 + i * 1.7)
      const x = sx + Math.sin(t * .8 + i * 2.3) * spread * .6 + (shift(4) - shift(1))
      g.globalAlpha = (.42 - i * .013) * flicker * (this.p.sun.y < .4 ? .55 : 1); g.fillStyle = p.sun.streak
      g.fillRect(x - spread, y, spread * 2 * (.4 + .6 * flicker), 1.6)
    }
    g.restore()
    // Painted on paper: a fine grain over everything.
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(this.paper, 0, 0); g.globalCompositeOperation = 'source-over'
  }
}
