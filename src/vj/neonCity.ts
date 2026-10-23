import type { Hearing } from './audioEngine'

/**
 * The night behind the fogged window: a dark skyline hung with thin neon signs, beams of light
 * sweeping up from the street, and fine particles drifting in the air that the beams catch.
 * Each sign is a few glowing tubes (a white-hot core in a coloured halo), drawn once and cached,
 * and breathes with its own band of the music; a snare can make one stutter like a loose tube.
 * The beams sweep with the beat and flare on a drop.
 */
type Band = 'bass' | 'lowMid' | 'mid' | 'high'
type Sign = { image: HTMLCanvasElement; x: number; y: number; band: Band; base: number; flicker: number; phase: number }
type Beam = { x: number; angle: number; swing: number; width: number; color: string; phase: number; band: Band }
type Mote = { x: number; y: number; vx: number; vy: number; size: number; glow: number }

const NEON = ['#ff2bd6', '#22e6ff', '#9b5cff', '#ff3355', '#9dff3a', '#ffb020', '#ff6ec7', '#4d7cff']
const BANDS: Band[] = ['bass', 'lowMid', 'mid', 'high']
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const between = (a: number, b: number) => a + Math.random() * (b - a)

/** Tube paths for one sign, in a w × h box. */
function tubes(w: number, h: number): [number, number][][] {
  const kind = pick(['frame', 'vertical', 'ring', 'arrow', 'wave', 'bars', 'script', 'tri'])
  const r = (n = 1) => Math.random() * n
  switch (kind) {
    case 'frame': return [[[0, 0], [w, 0], [w, h], [0, h], [0, 0]], [[w * .15, h * .5], [w * .85, h * .5]]]
    case 'vertical': {
      // A tall sign with a few glyph-like strokes inside its frame.
      const lines: [number, number][][] = [[[0, 0], [w, 0], [w, h], [0, h], [0, 0]]], n = 2 + Math.floor(r(3))
      for (let i = 0; i < n; i++) {
        const y0 = h * (i + .2) / n, y1 = h * (i + .8) / n
        lines.push([[w * .25, y0], [w * .75, y0]], [[w * .5, y0], [w * .5, y1]], Math.random() < .5 ? [[w * .25, y1], [w * .75, y1]] : [[w * .3, (y0 + y1) / 2], [w * .7, y1]])
      }
      return lines
    }
    case 'ring': {
      const ring = (k: number) => Array.from({ length: 33 }, (_, i) => [w / 2 + Math.cos(i / 32 * Math.PI * 2) * w / 2 * k, h / 2 + Math.sin(i / 32 * Math.PI * 2) * h / 2 * k] as [number, number])
      return Math.random() < .5 ? [ring(1), ring(.62)] : [ring(1)]
    }
    case 'arrow': return [[[0, h * .5], [w * .85, h * .5]], [[w * .6, h * .15], [w, h * .5], [w * .6, h * .85]]]
    case 'wave': return [Array.from({ length: 25 }, (_, i) => [w * i / 24, h / 2 + Math.sin(i / 24 * Math.PI * 4) * h * .4] as [number, number])]
    case 'bars': { const n = 3 + Math.floor(r(2)); return Array.from({ length: n }, (_, i) => [[0, h * i / (n - 1)], [w * between(.55, 1), h * i / (n - 1)]] as [number, number][]) }
    case 'script': {
      // A looping hand-written word: a smooth curve through a few loops.
      const loops = 3 + Math.floor(r(3)), points: [number, number][] = []
      for (let i = 0; i <= loops * 12; i++) { const t = i / 12, x = w * (t / loops) + Math.cos(t * Math.PI * 2) * w * .06, y = h * (.55 - Math.sin(t * Math.PI * 2) * .35 * (.7 + .3 * Math.sin(t * 1.3))); points.push([x, y]) }
      return [points, [[w * .05, h * .95], [w * .95, h * .9]]]
    }
    default: return [[[w / 2, 0], [w, h], [0, h], [w / 2, 0]]]
  }
}

/** Neon tubes drawn onto g: a soft coloured halo, the tube in its colour, and a white-hot core. */
function drawTubes(g: CanvasRenderingContext2D, lines: [number, number][][], color: string, scale: number) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
  const stroke = (width: number, style: string, blur: number, alpha: number) => {
    g.shadowColor = color; g.shadowBlur = blur; g.strokeStyle = style; g.lineWidth = width; g.globalAlpha = alpha
    for (const line of lines) { g.beginPath(); line.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke() }
  }
  stroke(5 * scale, color, 18 * scale, .55)
  stroke(2.4 * scale, color, 8 * scale, 1)
  stroke(1 * scale, '#fff', 0, .85)
  g.restore()
}
/** One sign on its own canvas, for the few that stutter on their own. */
function signImage(w: number, h: number, color: string, scale: number): HTMLCanvasElement {
  const pad = 22 * scale, c = document.createElement('canvas')
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(h + pad * 2)
  const g = c.getContext('2d')!; g.translate(pad, pad); drawTubes(g, tubes(w, h), color, scale)
  return c
}

export class NeonCity {
  private width = 1; private height = 1
  private skyline = document.createElement('canvas')
  /** Most of the neon, drawn once into one layer per band, so hundreds of tubes cost four draws a frame. */
  private layers = Object.fromEntries(BANDS.map(b => [b, document.createElement('canvas')])) as Record<Band, HTMLCanvasElement>
  private signs: Sign[] = []
  private beams: Beam[] = []
  private motes: Mote[] = []

  resize(width: number, height: number) {
    this.width = width; this.height = height
    const W = width, H = height, m = Math.min(W, H), scale = Math.max(.7, m / 800)
    // The skyline: dark towers a shade lighter than the sky, with a scatter of small lit windows.
    const c = this.skyline; c.width = Math.round(W); c.height = Math.round(H)
    const g = c.getContext('2d')!, sky = g.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#07081a'); sky.addColorStop(.6, '#120f2a'); sky.addColorStop(1, '#1e1226')
    g.fillStyle = sky; g.fillRect(0, 0, W, H)
    const towers: [number, number, number][] = []
    for (let x = -20; x < W; ) {
      const w = between(.05, .13) * W, top = H * between(.12, .55)
      towers.push([x, w, top]); x += w * between(.75, 1.05)
    }
    for (const [x, w, top] of towers) {
      g.fillStyle = `rgb(${18 + Math.random() * 10},${16 + Math.random() * 8},${34 + Math.random() * 14})`; g.fillRect(x, top, w, H - top)
      for (let wy = top + 8; wy < H; wy += 7 * scale) for (let wx = x + 5; wx < x + w - 5; wx += 6 * scale)
        if (Math.random() < .07) { g.fillStyle = pick(['#ffd9a033', '#9fd8ff2a', '#ffffff22', '#ffb04030']); g.fillRect(wx, wy, 2 * scale, 2.5 * scale) }
    }
    const layer = Object.fromEntries(BANDS.map(b => { const l = this.layers[b]; l.width = Math.round(W); l.height = Math.round(H); return [b, l.getContext('2d')!] })) as Record<Band, CanvasRenderingContext2D>
    // Most towers are edged in neon: up the sides, along the roof, and a band or two across the face.
    for (const [x, w, top] of towers) {
      if (Math.random() < .3) continue
      const g = layer[pick(BANDS)], color = pick(NEON), drop = (H - top) * between(.15, .5), lines: [number, number][][] = [[[x + 3, top + drop], [x + 3, top + 3], [x + w - 3, top + 3], [x + w - 3, top + drop]]]
      for (let k = Math.floor(between(0, 3)); k > 0; k--) { const y = between(top + 20, H * .95); lines.push([[x + 3, y], [x + w - 3, y]]) }
      drawTubes(g, lines, color, scale)
    }
    // And signs all over them: frames, tall signs, rings, arrows, waves, stripes, scripts.
    const sign = () => {
      const [x, w, top] = pick(towers), tall = Math.random() < .3
      const sw = tall ? between(.02, .035) * m : between(.05, .14) * m, sh = tall ? between(.12, .26) * m : between(.03, .07) * m
      return { sw, sh, x: between(x, x + Math.max(1, w - sw)), y: between(top + 6, H * .97 - sh) }
    }
    for (let i = 0; i < Math.round(45 + W * H / 18000); i++) {
      const { sw, sh, x, y } = sign(), g = layer[pick(BANDS)]
      g.save(); g.translate(x, y); drawTubes(g, tubes(sw, sh), pick(NEON), scale); g.restore()
    }
    // A few signs on their own, free to stutter.
    this.signs = Array.from({ length: 8 }, () => {
      const { sw, sh, x, y } = sign()
      return { image: signImage(sw, sh, pick(NEON), scale), x: x - 22 * scale, y: y - 22 * scale, band: pick(BANDS), base: between(.45, .8), flicker: 0, phase: Math.random() * 7 }
    })
    // Beams from the street, sweeping.
    const count = 4 + Math.floor(W / 600)
    this.beams = Array.from({ length: count }, (_, i) => ({ x: W * (i + .5) / count + between(-.05, .05) * W, angle: -Math.PI / 2 + between(-.35, .35), swing: between(.15, .35), width: between(.025, .05), color: pick(['200,220,255', '255,120,230', '120,240,255', '190,150,255']), phase: Math.random() * 7, band: pick(['mid', 'high', 'lowMid'] as Band[]) }))
    this.motes = Array.from({ length: Math.round(220 + W * H / 4000) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: between(-6, 6), vy: between(-14, -3), size: between(.6, 1.8) * scale, glow: Math.random() }))
  }

  draw(g: CanvasRenderingContext2D, hear: Hearing, dt: number, now: number, flare: number, calm: boolean) {
    const W = this.width, H = this.height, beats = hear.count + hear.phase, dim = calm ? .5 : 1
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(this.skyline, 0, 0, W, H)
    g.globalCompositeOperation = 'lighter'

    // Beams: they sweep across the bar and lean with each beat; their band and a drop light them.
    const rays: [number, number, number][] = []
    for (const b of this.beams) {
      const angle = b.angle + Math.sin(beats * Math.PI / 4 + b.phase) * b.swing + Math.sin(hear.phase * Math.PI * 2) * .03
      const strength = Math.min(1, (.15 + hear.bands[b.band] * .55 + flare * .6) * dim), length = H * 1.4
      const dx = Math.cos(angle), dy = Math.sin(angle), ex = b.x + dx * length, ey = H + dy * length, spread = length * b.width
      const gradient = g.createLinearGradient(b.x, H, ex, ey)
      gradient.addColorStop(0, `rgba(${b.color},${.45 * strength})`); gradient.addColorStop(1, `rgba(${b.color},0)`)
      g.fillStyle = gradient; g.beginPath(); g.moveTo(b.x - 3, H); g.lineTo(ex - dy * spread, ey + dx * spread); g.lineTo(ex + dy * spread, ey - dx * spread); g.lineTo(b.x + 3, H); g.fill()
      rays.push([angle, b.width, strength])
    }

    // The neon breathes band by band; a kick lifts the bass layer, and a snare may make a sign stutter.
    for (const band of BANDS) {
      const hit = band === 'bass' ? hear.kick * .3 : band === 'high' ? hear.hat * .25 : 0
      g.globalAlpha = Math.min(1, (.42 + hear.bands[band] * .6 + hit + flare * .3) * dim)
      g.drawImage(this.layers[band], 0, 0, W, H)
    }
    for (const s of this.signs) {
      if (hear.snareHit && Math.random() < .25) s.flicker = .25
      s.flicker = Math.max(0, s.flicker - dt)
      const stutter = s.flicker > 0 && Math.sin(now / 18 + s.phase) > 0 ? .15 : 1
      g.globalAlpha = Math.min(1, (s.base * .55 + hear.bands[s.band] * .7 + flare * .3) * stutter * dim)
      g.drawImage(s.image, s.x, s.y)
    }

    // Motes drift up through the air; inside a beam they light up, and the hats make them glitter.
    g.globalAlpha = 1
    for (const p of this.motes) {
      p.x += p.vx * dt; p.y += p.vy * dt
      if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W } else if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5
      let lit = 0
      for (let i = 0; i < this.beams.length; i++) {
        const b = this.beams[i], [angle, width, strength] = rays[i], ax = p.x - b.x, ay = p.y - H
        const along = ax * Math.cos(angle) + ay * Math.sin(angle), across = Math.abs(-ax * Math.sin(angle) + ay * Math.cos(angle))
        if (along > 0 && across < along * width) lit = Math.max(lit, strength * (1 - across / (along * width)))
      }
      const a = Math.min(1, .05 + lit * 1.4 + hear.hat * p.glow * .35)
      if (a < .04) continue
      g.fillStyle = `rgba(235,240,255,${a})`; g.fillRect(p.x, p.y, p.size, p.size)
    }
    g.globalCompositeOperation = 'source-over'
  }
}
