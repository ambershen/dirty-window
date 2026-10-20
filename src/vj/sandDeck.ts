import { SandSurface } from '../effects/SandSurface'
import { GranularRenderer } from '../effects/GranularRenderer'
import { DRAWINGS, strokesOf } from './drawings'
import type { Hearing } from './audioEngine'

/**
 * Sand, played by the music the way hands play the Sand study: the same surface and renderer, the
 * same furrows, rims and settling. Each phrase, a fingertip draws a picture (a castle, a horse, a
 * car…) stroke by stroke, lifting between strokes; it draws faster with the tempo and deeper with
 * the loudness. Kicks press stitches beside the stroke, then stipple the outline once the picture
 * is done; snares flick; hats prick; rising energy brings a four-finger rake around the picture; a
 * drop brings a gust (a band of wind ripples) or a pressed handprint before the next picture; a breakdown rakes quiet rings instead. Each
 * picture lands somewhere new, so the last one fades in the wind beside it.
 */
type Pen = { x: number; y: number; down: boolean }
/** Each stroke of a sketch is a little off: shifted, turned and scaled, with its own tremor. */
type Hand = { dx: number; dy: number; turn: number; scale: number; phase: number }
type Tool = 'palm' | 'finger'
type Picture = { name: string; after?: string; strokes: [number, number][][]; tools: Tool[]; hands: Hand[]; length: number; x: number; y: number; size: number; tilt: number; stroke: number; at: number }

const SLOTS: [number, number][] = [[.5, .52], [.3, .5], [.7, .5], [.42, .45], [.6, .56]]

export class SandDeck {
  private canvas = document.createElement('canvas')
  private renderer: GranularRenderer
  private surface!: SandSurface
  private width = 1; private height = 1
  private picture: Picture | null = null
  private order = DRAWINGS.map((_, i) => i).sort(() => Math.random() - .5)
  private drawn = 0
  private finger: Pen = { x: 0, y: 0, down: false }
  private rake: Pen[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0, down: false }))
  private rakeS = 0; private ringS = 0
  private side = 1
  private heading: [number, number] = [1, 0]
  /** A drop's gesture in progress: a gust laying wind ripples, or a hand pressing in. */
  private gesture: { kind: 'gust' | 'hand'; t: number; x: number; y: number; angle: number; drawn: number } | null = null
  private drops = 0
  private arcs: { start: number; span: number; dir: number; t: number; drawn: number }[] = []
  private lastDrop = -Infinity; private calm = false
  private stone: [number, number] = [.5, .5]
  intensity = 1

  constructor(private host: HTMLElement) {
    this.canvas.className = 'vj-deck'; host.prepend(this.canvas)
    this.renderer = new GranularRenderer(this.canvas)
    new ResizeObserver(() => this.resize()).observe(host); this.resize()
    this.nextPicture()
  }

  private resize() {
    const box = this.host.getBoundingClientRect()
    this.width = Math.max(1, box.width); this.height = Math.max(1, box.height)
    // The same resolution choices as the Sand study.
    const dpr = Math.min(1.5, devicePixelRatio, 1800 / Math.max(this.width, this.height))
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr)
    const scale = Math.min(1, 560 / Math.max(this.width, this.height))
    this.surface = new SandSurface(Math.max(24, Math.round(this.width * scale)), Math.max(24, Math.round(this.height * scale)))
    this.finger.down = false; for (const p of this.rake) p.down = false
  }

  get mood() { return this.calm ? 'calm' : performance.now() - this.lastDrop < 5000 ? (this.gesture?.kind === 'hand' || this.drops % 2 === 0 ? 'handprint' : 'gust') : 'drawing' }
  get figure() { const p = this.picture; return this.calm ? 'raked rings' : p ? `${p.name}${p.after ? `, after ${p.after}` : ''}${p.stroke >= p.strokes.length ? ' (done)' : p.tools[p.stroke] === 'palm' ? ' · palm' : ''}` : '' }

  /** One touch on the sand, in screen pixels: radius, load (how hard it presses) and motion. */
  private stamp(x: number, y: number, r: number, load: number, amount: number, mx = 0, my = 0) {
    const sx = this.surface.width / this.width, sy = this.surface.height / this.height
    this.surface.touch(x * sx, y * sy, r * sx, load, amount, mx, my)
  }
  /** Drag a touch from a to b, stamped closely enough to leave one continuous furrow. */
  private trace(ax: number, ay: number, bx: number, by: number, r: number, load: number, amount: number) {
    const d = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(d / Math.max(2, r * .22)))
    for (let i = 1; i <= steps; i++) { const t = i / steps; this.stamp(ax + (bx - ax) * t, ay + (by - ay) * t, r, load, amount, bx - ax, by - ay) }
  }

  /** The next picture, in the next place on the sand. */
  private nextPicture() {
    const index = this.order[this.drawn % this.order.length], slot = SLOTS[this.drawn % SLOTS.length]; this.drawn++
    const m = Math.min(this.width, this.height)
    // Not a tracing: a quick sketch. Small details are sometimes left out, and every stroke runs
    // on a little past its end, the way a fast hand overshoots.
    // Like a sand artist: the broad masses with the side of the palm first, then the fingertip lines.
    const drawing = DRAWINGS[index], masses = strokesOf(drawing.palm), lines = strokesOf(drawing.finger).filter(s => s.length > 8 || Math.random() < .6).map(overshoot)
    const strokes = [...masses, ...lines], tools: Tool[] = [...masses.map((): Tool => 'palm'), ...lines.map((): Tool => 'finger')]
    const hands = strokes.map(() => ({ dx: rand(2.5), dy: rand(2.5), turn: rand(.06), scale: 1 + rand(.05), phase: Math.random() * 100 }))
    // A palm sweeps faster than a fingertip draws, so its strokes count for less of the time.
    this.picture = { name: drawing.name, after: drawing.after, strokes, tools, hands, length: strokes.reduce((sum, s, i) => sum + s.length * 1.2 * (tools[i] === 'palm' ? .55 : 1), 0), x: this.width * slot[0] + rand(this.width * .04), y: this.height * slot[1] + rand(this.height * .04), size: m * (.7 + Math.random() * .1), tilt: rand(.12), stroke: 0, at: 0 }
    this.finger.down = false
    this.stone = [.3 + Math.random() * .4, .35 + Math.random() * .3]
  }
  /**
   * A point of the picture in screen pixels, as a loose hand would place it: the stroke's own
   * offset, turn and scale, a slow tremor along the line, and the whole picture tilted. Looseness
   * (0 tidy … 1 wild) comes from the music.
   */
  private point(p: Picture, [u, v]: [number, number], stroke = -1, along = 0): [number, number] {
    const hand = p.hands[stroke], loose = this.looseness
    let x = u - 50, y = v - 50
    if (hand) {
      const c = Math.cos(hand.turn * loose), s = Math.sin(hand.turn * loose), sc = 1 + (hand.scale - 1) * loose
      ;[x, y] = [(x * c - y * s) * sc + hand.dx * loose, (x * s + y * c) * sc + hand.dy * loose]
      const t = hand.phase + along * .045, tremor = .6 + loose * 2.2
      x += (Math.sin(t * 1.7) + Math.sin(t * 3.1) * .5) * tremor; y += (Math.cos(t * 1.3) + Math.sin(t * 2.3) * .5) * tremor
    }
    const c = Math.cos(p.tilt), s = Math.sin(p.tilt)
    return [p.x + (x * c - y * s) / 100 * p.size, p.y + (x * s + y * c) / 100 * p.size]
  }
  /** How loosely the music is drawing: tidy when quiet, gestural when loud, wildest after a drop. */
  private looseness = .4

  frame(hear: Hearing, dt: number, now: number) {
    const k = this.intensity, W = this.width, H = this.height, m = Math.min(W, H)
    // Sections: a new phrase brings a new picture.
    if (hear.beat && hear.count > 0 && hear.count % 32 === 0) this.nextPicture()
    // A drop: a gust lays a band of wind ripples, or a hand presses into the sand (they alternate);
    // the wind blows harder for a moment, and a new picture begins.
    if (hear.trend > 1.45 && hear.level > .35 && now - this.lastDrop > 8000) {
      this.lastDrop = now; this.drops++
      this.gesture = { kind: this.drops % 2 ? 'gust' : 'hand', t: 0, x: W * (.3 + Math.random() * .4), y: H * (.3 + Math.random() * .4), angle: (Math.random() - .5) * .5, drawn: 0 }
      this.nextPicture()
    }
    this.calm = hear.trend < .55 || (this.calm && hear.trend < .9)
    const wanted = Math.min(1, .25 + hear.level * .45 + Math.max(0, hear.trend - 1) * .6 + (now - this.lastDrop < 6000 ? .35 : 0))
    this.looseness += (wanted - this.looseness) * (1 - Math.exp(-dt * 1.5))
    const load = (.22 + hear.level * .6 + hear.bands.bass * .3 + hear.kick * .25) * (.85 + .15 * Math.sin(now / 260)) * k
    let [x, y] = [this.finger.x, this.finger.y]

    if (this.calm) {
      // A breakdown: quiet rings raked around a stone.
      const before = this.ringS; this.ringS += dt * (hear.bpm / 120) * .1 * k
      const at = (s: number): [number, number] => { const a = s * Math.PI * 2, r = (.07 + (Math.floor(s) % 6) * .055) * m; return [W * this.stone[0] + Math.cos(a) * r, H * this.stone[1] + Math.sin(a) * r] }
      const [bx, by] = at(before); [x, y] = at(this.ringS)
      if (Math.hypot(x - bx, y - by) < m * .05 && hear.level > .03) this.trace(bx, by, x, y, 11, load * .8, .45)
      this.finger.down = false
    } else if (this.picture && this.picture.stroke < this.picture.strokes.length && hear.level > .03) {
      // Drawing: the fingertip walks along the current stroke at a speed set by the tempo.
      const p = this.picture, stroke = p.strokes[p.stroke]
      // Paced so any picture is finished in about 70% of a phrase (32 beats), a touch quicker when loud.
      const palm = p.tools[p.stroke] === 'palm'
      p.at += dt * p.length / (32 * 60 / hear.bpm * .7) * (.85 + hear.level * .3) * k / (palm ? .55 : 1)
      let i = Math.floor(p.at / 1.2)
      if (i >= stroke.length - 1) { i = stroke.length - 1 }
      const target = this.point(p, stroke[i], p.stroke, p.at)
      // The palm's side lays a broad, shallow, soft-edged mass; the fingertip a fine line.
      if (this.finger.down) palm ? this.trace(this.finger.x, this.finger.y, target[0], target[1], p.size * .05, load * .45, .3) : this.trace(this.finger.x, this.finger.y, target[0], target[1], 6.5, load, .5)
      const dx = target[0] - this.finger.x, dy = target[1] - this.finger.y, d = Math.hypot(dx, dy)
      if (d > .5) this.heading = [dx / d, dy / d]
      this.finger = { x: target[0], y: target[1], down: true }; [x, y] = target
      // The end of a stroke: lift, and move to the next.
      if (i >= stroke.length - 1) { p.stroke++; p.at = 0; this.finger.down = false }
    }
    const [hx, hy] = this.heading, nx = -hy, ny = hx

    // Kicks: stitches beside the stroke while drawing; once the picture is done, dots along its outline.
    if (hear.kickHit && !this.calm && this.picture) {
      const p = this.picture, size = 5 + hear.kick * 4, press = (.5 + hear.bands.bass * .4) * k
      // Stitches on every other kick, set back from the line so the picture stays legible.
      if (p.stroke < p.strokes.length) { if (hear.count % 2 === 0 && p.tools[p.stroke] === 'finger') { this.side = -this.side; const d = 30 + hear.kick * 8; this.stamp(x + nx * d * this.side, y + ny * d * this.side, size, press, .9) } }
      else { const s = p.strokes[Math.floor(Math.random() * p.strokes.length)], q = this.point(p, s[Math.floor(Math.random() * s.length)], p.strokes.indexOf(s)); this.stamp(q[0], q[1], size * .8, press, .85) }
    }
    // Snares flick a short, light stroke out from the fingertip.
    if (hear.snareHit && !this.calm) { const a = Math.random() > .5 ? 1 : -1; this.trace(x + nx * 22 * a, y + ny * 22 * a, x + nx * 44 * a + hx * 14, y + ny * 44 * a + hy * 14, 6, .4 * k, .45) } // narrower than ~2 sand cells would bead into dots
    // Hats prick the sand around the picture, outside its lines: a fine, glittering texture.
    if (hear.hatHit && Math.random() < .6) { const a = Math.random() * Math.PI * 2, r = m * (.38 + Math.random() * .12); this.stamp(W / 2 + Math.cos(a) * r * 1.3, H / 2 + Math.sin(a) * r, 2.5, .3, .4) }
    // The palm in the music: each bar the mids bring a soft palm arc around the picture, like a
    // vignette; a heavy bass presses the heel of the hand into the sand near the edge.
    if (hear.beat && hear.count % 4 === 0 && !this.calm && hear.bands.mid > .2 && this.picture) {
      const start = Math.random() * Math.PI * 2
      this.arcs.push({ start, span: .7 + hear.bands.mid * .8, dir: Math.random() > .5 ? 1 : -1, t: 0, drawn: 0 })
    }
    if (this.picture) this.arcs = this.arcs.filter(a => {
      const p = this.picture!, before = a.t; a.t = Math.min(1, a.t + dt / .7)
      const at = (t: number): [number, number] => { const ang = a.start + a.dir * a.span * t, r = p.size * (.6 + .05 * Math.sin(t * 3)); return [p.x + Math.cos(ang) * r * 1.2, p.y + Math.sin(ang) * r * .9] }
      const [ax, ay] = at(before), [bx, by] = at(a.t); this.trace(ax, ay, bx, by, p.size * .045, .28 * k, .28)
      return a.t < 1
    })
    if (hear.kickHit && hear.bands.bass > .75 && !this.calm && this.picture && Math.random() < .35) {
      const p = this.picture, ang = Math.random() * Math.PI * 2; this.stamp(p.x + Math.cos(ang) * p.size * .7, p.y + Math.sin(ang) * p.size * .55, p.size * .07, .55 * k, .55)
    }
    // Rising energy: a four-finger rake circles the picture.
    const raking = !this.calm && hear.level > .4 && (now - this.lastDrop < 12000 || hear.trend > 1.2) && this.picture
    if (raking) {
      const p = this.picture!, before = this.rakeS; this.rakeS += dt * (hear.bpm / 120) * .09 * k
      const around = (s: number, off: number): [number, number] => { const a = s * Math.PI * 2, r = p.size * .62 + off; return [p.x + Math.cos(a) * r * 1.15, p.y + Math.sin(a) * r * .85] }
      this.rake.forEach((pen, f) => { const off = (f - 1.5) * 15, [ax, ay] = around(before, off), [bx, by] = around(this.rakeS, off); if (pen.down) this.trace(ax, ay, bx, by, 6, load * .9, .45); pen.down = true })
    } else for (const pen of this.rake) pen.down = false
    if (this.gesture) this.drop(this.gesture, dt, k)
    this.wind(dt)
    this.surface.settle(dt)
    this.light(hear, now)
    this.renderer.render(this.surface, W, H)
  }

  /**
   * The sand dances in its light. The sun circles half the sky each phrase and swings a little on
   * every beat, so every furrow's shadow sways; bass lowers it (longer shadows, deeper relief) and
   * energy raises it; kicks pulse the exposure; hats make the quartz glitter; the mids carry a warm
   * pool of light across the sand at the tempo, which flares on a drop.
   */
  private light(hear: Hearing, now: number) {
    const L = this.renderer.light, beats = hear.count + hear.phase
    const swing = Math.sin(hear.phase * Math.PI * 2) * (.08 + hear.level * .14)
    const azimuth = Math.atan2(-.75, -.45) + beats / 32 * Math.PI + swing
    const height = Math.max(.16, Math.min(.62, .4 - hear.bands.bass * .2 + Math.max(0, hear.trend - 1) * .15))
    L.sun = [Math.cos(azimuth) * .87, Math.sin(azimuth) * .87, height]
    L.exposure = 1 + hear.kick * .1 * this.intensity + (hear.beat ? .03 : 0)
    L.sparkle = Math.min(1, (hear.hat * .8 + hear.bands.high * .35 + hear.bands.air * .25) * this.intensity)
    const drift = beats / 16 * Math.PI, flare = now - this.lastDrop < 2500 ? (1 - (now - this.lastDrop) / 2500) * .8 : 0
    L.spot = [.5 + Math.sin(drift) * .3, .5 + Math.sin(drift * 2) * .18, this.calm ? .08 : Math.min(1.1, (.18 + hear.bands.mid * .45) * this.intensity + flare)]
  }

  /**
   * The drop's gesture. A gust: eight thin, gently wavy crests laid left to right across a band,
   * like the ripples wind leaves on a dune. A hand: the heel of the palm presses first, then the
   * fingers and the thumb, as a hand set down flat.
   */
  private drop(g: NonNullable<SandDeck['gesture']>, dt: number, k: number) {
    const W = this.width, m = Math.min(W, this.height), c = Math.cos(g.angle), s = Math.sin(g.angle)
    const at = (u: number, v: number): [number, number] => [g.x + u * c - v * s, g.y + u * s + v * c]
    if (g.kind === 'gust') {
      g.t = Math.min(1, g.t + dt / 1.4)
      const reach = W * .62, from = -reach / 2 + reach * g.drawn, to = -reach / 2 + reach * g.t
      for (let line = 0; line < 8; line++) {
        const v = (line - 3.5) * 15, wave = (u: number) => v + Math.sin(u * .022 + line * .7) * 9 + Math.sin(u * .061 + line) * 2.5
        // Each crest begins a little later than the one above, so the band arrives as a slant.
        const lag = line * .02 * reach, a = Math.max(-reach / 2, from - lag), b = Math.max(-reach / 2, to - lag)
        if (b <= a) continue
        for (let u = a; u < b; u += 6) { const [x0, y0] = at(u, wave(u)), [x1, y1] = at(Math.min(b, u + 6), wave(Math.min(b, u + 6))); this.trace(x0, y0, x1, y1, 5, .3 * k, .35) }
      }
      g.drawn = g.t
    } else {
      const before = g.t; g.t = Math.min(1, g.t + dt / .9)
      const size = m * .2
      // The heel and the body of the palm, pressed first.
      if (before < .25 && g.t >= .25) for (const [u, v, r] of [[0, .35, .3], [-.15, .1, .26], [.15, .1, .26], [0, -.05, .28]] as const) { const [x, y] = at(u * size, v * size); this.stamp(x, y, r * size, .7 * k, .7) }
      // Then the fingers, spreading a little, and the thumb out to the side.
      const fingers: [number, number, number, number][] = [[-.22, -.18, -.3, -.72], [-.08, -.25, -.1, -.86], [.07, -.25, .1, -.82], [.21, -.18, .28, -.66], [-.3, .15, -.62, -.1]]
      fingers.forEach(([u0, v0, u1, v1], i) => {
        const start = .3 + i * .1, p0 = Math.max(0, Math.min(1, (before - start) / .25)), p1 = Math.max(0, Math.min(1, (g.t - start) / .25))
        if (p1 <= p0) return
        const [ax, ay] = at((u0 + (u1 - u0) * p0) * size, (v0 + (v1 - v0) * p0) * size), [bx, by] = at((u0 + (u1 - u0) * p1) * size, (v0 + (v1 - v0) * p1) * size)
        this.trace(ax, ay, bx, by, size * (i === 4 ? .1 : .085), .6 * k, .6)
      })
    }
    if (g.t >= 1) this.gesture = null
  }

  /** Wind smooths the sand back toward its dunes, faster in a breakdown, so marks become texture and fade. */
  private wind(dt: number) {
    const { levels, base, disturbed } = this.surface, rate = 1 - Math.exp(-dt * (this.calm ? .3 : performance.now() - this.lastDrop < 3000 ? .25 : .045))
    for (let i = 0; i < levels.length; i++) { levels[i] += (base[i] - levels[i]) * rate; disturbed[i] *= 1 - rate * .5 }
  }
}

const rand = (n: number) => (Math.random() * 2 - 1) * n
/** Run a stroke on past its end along its last direction, a few units, tapering out. */
function overshoot(stroke: [number, number][]): [number, number][] {
  const n = stroke.length, [ax, ay] = stroke[Math.max(0, n - 4)], [bx, by] = stroke[n - 1], d = Math.hypot(bx - ax, by - ay)
  if (d < .5 || (stroke[0][0] === bx && stroke[0][1] === by)) return stroke // closed shapes just close
  const extra = 2 + Math.random() * 4, steps = Math.ceil(extra / 1.2)
  return [...stroke, ...Array.from({ length: steps }, (_, i): [number, number] => [bx + (bx - ax) / d * (i + 1) * 1.2, by + (by - ay) / d * (i + 1) * 1.2])]
}
