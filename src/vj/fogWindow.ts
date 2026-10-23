import type { Hearing } from './audioEngine'
import { NeonCity } from './neonCity'

/**
 * A fogged window at night, for the VJ deck. Behind the glass is a neon city (see neonCity.ts) that
 * moves with the music; the condensation turns it to soft coloured glows. Where a finger clears the
 * glass it shows sharp again, so a work drawn on the window is drawn in neon and light.
 * The clearing is kept as a float grid (clarity 0 fogged … 1 clear), so it can fog back over
 * smoothly, without the stalls of fading an 8-bit canvas. Heavy beads run down from the lines.
 */
type Drip = { x: number; y: number; speed: number; r: number; life: number }

const CELL = 2

export class FogWindow {
  readonly canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private sharp = document.createElement('canvas')
  private blur = document.createElement('canvas')
  private through = document.createElement('canvas')
  private maskCanvas = document.createElement('canvas')
  private texture = document.createElement('canvas')
  private mask = new Float32Array(1)
  private maskImage: ImageData | null = null
  private gw = 1; private gh = 1
  private width = 1; private height = 1
  private city = new NeonCity()
  private drips: Drip[] = []

  constructor(host: HTMLElement) {
    this.canvas.className = 'vj-deck vj-fog'; host.prepend(this.canvas)
  }

  resize(width: number, height: number) {
    this.width = width; this.height = height
    const dpr = Math.min(1.25, devicePixelRatio)
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const c of [this.sharp, this.through]) { c.width = Math.round(width); c.height = Math.round(height) }
    this.blur.width = Math.max(1, Math.round(width / 2)); this.blur.height = Math.max(1, Math.round(height / 2))
    this.gw = Math.max(8, Math.ceil(width / CELL)); this.gh = Math.max(8, Math.ceil(height / CELL))
    this.mask = new Float32Array(this.gw * this.gh)
    this.maskCanvas.width = this.gw; this.maskCanvas.height = this.gh; this.maskImage = new ImageData(this.gw, this.gh)
    this.drips = []
    this.makeTexture(); this.city.resize(width, height)
  }

  /** The condensation: mottled density, fine grain and a heavier fog towards the frame's top and bottom. */
  private makeTexture() {
    const W = Math.round(this.width), H = Math.round(this.height), c = this.texture
    c.width = W; c.height = H
    const g = c.getContext('2d')!
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * Math.min(W, H) * .35, mist = g.createRadialGradient(x, y, 0, x, y, r)
      mist.addColorStop(0, i % 3 ? 'rgba(214,222,226,.06)' : 'rgba(40,46,52,.05)'); mist.addColorStop(1, 'rgba(200,215,220,0)')
      g.fillStyle = mist; g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const grain = g.createImageData(W, H)
    for (let i = 0; i < grain.data.length; i += 4) { const light = Math.random() > .5; grain.data[i] = light ? 236 : 60; grain.data[i + 1] = light ? 240 : 66; grain.data[i + 2] = light ? 242 : 72; grain.data[i + 3] = Math.random() * 4 }
    const noise = document.createElement('canvas'); noise.width = W; noise.height = H; noise.getContext('2d')!.putImageData(grain, 0, 0); g.drawImage(noise, 0, 0)
    const edge = g.createLinearGradient(0, 0, 0, H)
    edge.addColorStop(0, 'rgba(190,200,206,.18)'); edge.addColorStop(.15, 'rgba(190,200,206,0)'); edge.addColorStop(.82, 'rgba(190,200,206,0)'); edge.addColorStop(1, 'rgba(190,200,206,.24)')
    g.fillStyle = edge; g.fillRect(0, 0, W, H)
  }

  /** A fingertip on the glass (screen pixels): it clears a soft-edged spot, cleaner the harder it presses. */
  touch(x: number, y: number, r: number, load: number) {
    const gx = x / CELL, gy = y / CELL, gr = Math.max(1, r / CELL), clear = Math.min(1, .55 + load * .5)
    for (let py = Math.max(0, Math.floor(gy - gr)); py <= Math.min(this.gh - 1, Math.ceil(gy + gr)); py++)
      for (let px = Math.max(0, Math.floor(gx - gr)); px <= Math.min(this.gw - 1, Math.ceil(gx + gr)); px++) {
        const d = Math.hypot(px - gx, py - gy) / gr
        if (d >= 1) continue
        const e = Math.min(1, (1 - d) / .45), i = py * this.gw + px
        this.mask[i] = Math.max(this.mask[i], clear * e * e * (3 - 2 * e))
      }
  }
  /** Wipe a shape clear (screen pixels): the shallow pieces of a building leave a film, the deep ones clear it. */
  imprint(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, clarity: number) {
    for (let py = Math.max(0, Math.floor(y0 / CELL)); py <= Math.min(this.gh - 1, Math.ceil(y1 / CELL)); py++)
      for (let px = Math.max(0, Math.floor(x0 / CELL)); px <= Math.min(this.gw - 1, Math.ceil(x1 / CELL)); px++) {
        let c = 0
        for (const [ox, oy] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) if (inside((px + ox) * CELL, (py + oy) * CELL)) c++
        if (c) { const i = py * this.gw + px; this.mask[i] = Math.max(this.mask[i], clarity * c / 4) }
      }
  }
  /** Condensation forms again over the whole glass. */
  fog(rate: number) {
    const m = this.mask
    for (let i = 0; i < m.length; i++) if (m[i]) m[i] = Math.max(0, m[i] * (1 - rate) - rate * .01)
  }
  /** A heavy bead that gathers on a line and runs down, clearing a thin trail. */
  drip(x: number, y: number) {
    if (this.drips.length < 14) this.drips.push({ x, y, speed: 40 + Math.random() * 70, r: 2 + Math.random() * 1.5, life: .8 + Math.random() * 2.4 })
  }
  /** Whether the glass is clear at a point (screen pixels). */
  clearAt(x: number, y: number) {
    const px = Math.floor(x / CELL), py = Math.floor(y / CELL)
    return px >= 0 && py >= 0 && px < this.gw && py < this.gh ? this.mask[py * this.gw + px] : 0
  }

  render(hear: Hearing, dt: number, now: number, flare: number, calm: boolean) {
    const W = this.width, H = this.height, ctx = this.ctx
    // The city behind the glass.
    const s = this.sharp.getContext('2d')!
    this.city.draw(s, hear, dt, now, flare, calm)
    // Through the fog: the same view, blurred and veiled.
    const b = this.blur.getContext('2d')!
    b.filter = 'blur(12px)'; b.drawImage(this.sharp, 0, 0, this.blur.width, this.blur.height); b.filter = 'none'
    // Even through clear glass the neon blooms in the night air.
    s.globalCompositeOperation = 'lighter'; s.globalAlpha = .7; s.drawImage(this.blur, 0, 0, W, H); s.globalAlpha = 1; s.globalCompositeOperation = 'source-over'
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.blur, 0, 0, W, H)
    // Condensation scatters light: the fog glows milky over the dark view, brighter where the lights are.
    ctx.fillStyle = 'rgba(176,186,196,.24)'; ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .85; ctx.drawImage(this.blur, 0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.texture, 0, 0, W, H)

    // Drips run down, clearing a thin trail.
    this.drips = this.drips.filter(d => {
      d.life -= dt; const step = d.speed * dt
      d.y += step; d.x += Math.sin(d.y * .05) * .3
      for (let t = 0; t <= step; t += 2) this.touch(d.x, d.y - t, d.r, .7)
      return d.life > 0 && d.y < H + 10
    })

    // The clear glass: the sharp view, wherever the mask lets it through.
    const img = this.maskImage!, data = img.data, m = this.mask
    for (let i = 0; i < m.length; i++) { const k = i * 4; data[k] = data[k + 1] = data[k + 2] = 255; data[k + 3] = m[i] * 255 }
    this.maskCanvas.getContext('2d')!.putImageData(img, 0, 0)
    const t = this.through.getContext('2d')!
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.drawImage(this.sharp, 0, 0)
    t.globalCompositeOperation = 'destination-in'; t.imageSmoothingEnabled = true; t.drawImage(this.maskCanvas, 0, 0, W, H)
    t.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.through, 0, 0, W, H)

    // The beads at the heads of the drips catch the light.
    for (const d of this.drips) {
      const g = ctx.createRadialGradient(d.x - d.r * .3, d.y - d.r * .3, 0, d.x, d.y, d.r * 1.6)
      g.addColorStop(0, 'rgba(250,252,255,.8)'); g.addColorStop(.5, 'rgba(200,210,220,.3)'); g.addColorStop(1, 'rgba(20,24,30,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 1.6, 0, Math.PI * 2); ctx.fill()
    }
  }
}
