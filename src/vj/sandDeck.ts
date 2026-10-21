import { SandSurface } from '../effects/SandSurface'
import { SnowSurface } from '../effects/SnowSurface'
import { GranularRenderer } from '../effects/GranularRenderer'
import { strokesOf } from './drawings'
import { ART_SKETCHES } from './artSketches'
import type { Hearing } from './audioEngine'
import { nextBuilding, inside, type Building, type Piece } from './buildings'

/**
 * Sand, played by the music the way hands play the Sand study: the same surface and renderer, the
 * same furrows, rims and settling. Each phrase a fingertip draws a famous work (its cut for the
 * sand: the silhouette in one movement, then a few inner lines), surging with every beat and
 * pressing harder with the loudness. Beside it, beat by beat, sandcastle forms press a building
 * into the sand, made fresh each time (see buildings.ts), its windows and doors cut on the snares;
 * the works that fill the whole sand have none. Between works the wind rises and blows the whole
 * sand evenly smooth.
 *
 * Snow plays the same way on the Snow study's powder, with winter buildings (igloos, snowmen, a
 * cabin among pines) among the others; between works fresh snow settles evenly over the old work.
 * A low winter sun circles with the phrase so every print casts a long blue shadow; hats make the
 * crystals glint.
 *
 * A broad soft brush sweeps back over some of the work's lines each bar once it is drawn,
 * and over its silhouette after a drop, thickening them. A breakdown rakes quiet rings instead.
 */
/** Each stroke of a sketch is a little off: shifted, turned and scaled, with its own tremor. */
type Hand = { dx: number; dy: number; turn: number; scale: number; phase: number }
type Picture = { name: string; after?: string; cx: number; cy: number; hw: number; hh: number; strokes: [number, number][][]; hands: Hand[]; length: number; x: number; y: number; size: number; tilt: number; stroke: number; at: number }
/** One pass of the broad brush along part of a stroke of the picture (indices into its points). */
type Sweep = { stroke: number; from: number; to: number; t: number; beats: number; r: number; load: number; last: [number, number] | null }

const DEPTH = { 1: .1, 2: .17, 3: .25 }
type Build = { building: Building; x: number; y: number; w: number; h: number; main: Piece[]; details: Piece[] }
export type Material = 'sand' | 'snow'

export class SandDeck {
  private canvas = document.createElement('canvas')
  private renderer: GranularRenderer
  private surface!: SandSurface
  private width = 1; private height = 1
  private picture: Picture | null = null
  private build: Build | null = null
  private order = ART_SKETCHES.map((_, i) => i).sort(() => Math.random() - .5)
  private drawn = 0
  private finger = { x: 0, y: 0, down: false }
  private ringS = 0
  private sweeps: Sweep[] = []
  /** A drop's bold brush, waiting for the silhouette it will sweep over. */
  private boldPending = false
  /** Before the next work the wind rises and blows the whole sand smooth, evenly. */
  private blowFrom = 0
  private blowUntil = 0
  private bpm = 120
  private lastDrop = -Infinity; private calm = false
  private stone: [number, number] = [.5, .5]
  intensity = 1

  constructor(private host: HTMLElement, private material: Material = 'sand') {
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
    const scale = Math.min(1, 560 / Math.max(this.width, this.height)), gw = Math.max(24, Math.round(this.width * scale)), gh = Math.max(24, Math.round(this.height * scale))
    this.surface = this.snow ? new SnowSurface(gw, gh) : new SandSurface(gw, gh)
    this.finger.down = false
    this.stillDone = false // a new surface needs the still work pressed again
  }

  private get snow() { return this.material === 'snow' }
  get kind() { return this.material }
  /** Change material: a fresh surface, and a new work on it. */
  set kind(material: Material) { if (material === this.material) return; this.material = material; this.resize(); this.nextPicture() }

  get mood() { return this.calm ? 'calm' : this.snow && performance.now() < this.blowUntil ? 'fresh snow' : performance.now() - this.lastDrop < 5000 ? 'drop · broad brush' : this.sweeps.length ? 'drawing · broad brush' : 'drawing' }
  get figure() {
    const p = this.picture, b = this.build
    if (this.calm) return this.snow ? 'rings traced in the snow' : 'raked rings'
    return p ? `${p.name}${p.after ? `, after ${p.after}` : ''}${p.stroke >= p.strokes.length ? ' (done)' : ''}${b ? ` · ${b.building.name} rising beside it` : ''}` : ''
  }

  /** One touch on the sand, in screen pixels: radius, load (how hard it presses) and motion. */
  private stamp(x: number, y: number, r: number, load: number, amount: number, mx = 0, my = 0) {
    const sx = this.surface.width / this.width, sy = this.surface.height / this.height
    // Powder gives far more under the same weight than sand, so the snow is touched lightly.
    if (this.snow) this.surface.touch(x * sx, y * sy, r * sx * .8, load * SNOW_LOAD, amount * .8)
    else this.surface.touch(x * sx, y * sy, r * sx, load, amount, mx, my)
  }
  /** Drag a touch from a to b, stamped closely enough to leave one continuous furrow. */
  private trace(ax: number, ay: number, bx: number, by: number, r: number, load: number, amount: number) {
    const d = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(d / Math.max(2, r * .22)))
    for (let i = 1; i <= steps; i++) { const t = i / steps; this.stamp(ax + (bx - ax) * t, ay + (by - ay) * t, r, load, amount, bx - ax, by - ay) }
  }

  /** The next work, large on the sand, with the next building's place beside it. */
  private nextPicture() {
    const index = this.order[this.drawn % this.order.length], side = this.drawn % 2 ? 1 : -1; this.drawn++
    // In sand every line is a groove with raised rims, so each work uses its cut for the sand: one
    // continuous silhouette, then a few strong inner lines (see scripts/sketch-art.mjs).
    const art = ART_SKETCHES[index], strokes = strokesOf(art.sand || art.d)
    let x0 = 100, y0 = 100, x1 = 0, y1 = 0
    for (const line of strokes) for (const [u, v] of line) { x0 = Math.min(x0, u); y0 = Math.min(y0, v); x1 = Math.max(x1, u); y1 = Math.max(y1, v) }
    // A steadier hand than for doodles: these shapes must stay recognisable.
    const hands = strokes.map(() => ({ dx: rand(.4), dy: rand(.4), turn: rand(.01), scale: 1 + rand(.008), phase: Math.random() * 100 }))
    const W = this.width, H = this.height
    // Fit the work large: tall figures by height, the wide Creation of Adam by width.
    const full = !!art.full, fit = Math.min(W * (full ? .94 : .88) / Math.max(10, x1 - x0), H * (full ? .9 : .84) / Math.max(10, y1 - y0)) * 100
    const hw = (x1 - x0) / 200 * fit, hh = (y1 - y0) / 200 * fit, wide = hw * 2 > W * .55
    // A tall work steps a little aside for its building; a wide one rises a little, building below.
    const x = wide || full ? W / 2 : W / 2 - side * Math.min(W * .1, Math.max(0, W / 2 - hw - 24)), y = full ? H / 2 : wide ? H * .4 : H / 2
    this.picture = { name: art.name, after: art.after, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw, hh, strokes, hands, length: strokes.reduce((sum, s) => sum + s.length * 1.2, 0), x, y, size: fit, tilt: rand(.03), stroke: 0, at: 0 }
    this.build = full ? null : this.place(this.picture, side, wide)
    this.sweeps = []; this.boldPending = false
    // The wind blows for four beats (within reason); fresh snow settles over a little longer.
    const now = performance.now(), beats = this.snow ? 6 : 4
    this.finger.down = false; this.blowFrom = now; this.blowUntil = now + Math.max(1600, Math.min(this.snow ? 4200 : 3000, beats * 60000 / this.bpm))
    this.stone = [.3 + Math.random() * .4, .35 + Math.random() * .3]
  }
  /** The next building, as large as fits in the open sand beside (or below) the work. */
  private place(p: Picture, side: number, wide: boolean): Build | null {
    const building = nextBuilding(this.snow), a = building.aspect, W = this.width, H = this.height
    let s: number, bx: number, by: number
    if (wide) {
      const top = p.y + p.hh + 20, bottom = H - 24
      s = Math.min((bottom - top) * .95, W * between(.3, .42) / a); bx = W / 2 + side * W * .2 - s * a / 2; by = bottom - s
    } else {
      const left = side > 0 ? p.x + p.hw + 28 : 24, right = side > 0 ? W - 24 : p.x - p.hw - 28
      s = Math.min((right - left) * .92 / a, H * between(.34, .5), p.hh * 1.3); bx = (left + right) / 2 - s * a / 2; by = Math.min(H - 28, p.y + p.hh) - s
    }
    if (!(s > 60)) return null
    // Built from the ground up, or along from one side, or out from the middle.
    const main = building.pieces.filter(q => !q[6]), order = Math.floor(Math.random() * 3), side2 = Math.random() > .5 ? 1 : -1
    main.sort(order === 0 ? (p, q) => q[4] - p[4] || q[2] - p[2] : order === 1 ? (p, q) => side2 * (p[1] - q[1]) : (p, q) => Math.abs((p[1] + p[3]) / 2 - .5) - Math.abs((q[1] + q[3]) / 2 - .5))
    return { building, x: bx, y: by, w: s * a, h: s, main, details: building.pieces.filter(q => q[6]).sort((p, q) => q[4] - p[4]) }
  }
  /** Press one piece of the building into the sand. */
  private press(b: Build, [shape, u0, v0, u1, v1, level]: Piece, strength: number) {
    const X0 = b.x + u0 * b.w, Y0 = b.y + v0 * b.h, X1 = b.x + u1 * b.w, Y1 = b.y + v1 * b.h, test = inside(shape, X0, Y0, X1, Y1)
    const sx = this.surface.width / this.width, sy = this.surface.height / this.height
    this.surface.imprint(X0 * sx, Y0 * sy, X1 * sx, Y1 * sy, (x, y) => test(x / sx, y / sy), DEPTH[level] * strength * (this.snow ? SNOW_DEPTH : 1))
  }
  /**
   * A point of the picture in screen pixels, as a loose hand would place it: the stroke's own
   * offset, turn and scale, a slow tremor along the line, and the whole picture tilted. Looseness
   * (0 tidy … 1 wild) comes from the music.
   */
  private point(p: Picture, [u, v]: [number, number], stroke = -1, along = 0): [number, number] {
    const hand = p.hands[stroke], loose = this.looseness
    let x = u - p.cx, y = v - p.cy
    if (hand) {
      const c = Math.cos(hand.turn * loose), s = Math.sin(hand.turn * loose), sc = 1 + (hand.scale - 1) * loose
      ;[x, y] = [(x * c - y * s) * sc + hand.dx * loose, (x * s + y * c) * sc + hand.dy * loose]
      const t = hand.phase + along * .045, tremor = .12 + loose * .35
      x += (Math.sin(t * 1.7) + Math.sin(t * 3.1) * .5) * tremor; y += (Math.cos(t * 1.3) + Math.sin(t * 2.3) * .5) * tremor
    }
    const c = Math.cos(p.tilt), s = Math.sin(p.tilt)
    return [p.x + (x * c - y * s) / 100 * p.size, p.y + (x * s + y * c) / 100 * p.size]
  }
  /** How loosely the music is drawing: tidy when quiet, gestural when loud, wildest after a drop. */
  private looseness = .4

  /**
   * Tuning aid (?still=<id>): press one work and its building into the sand whole, with a steady
   * hand and no music, wind or rhythm marks, to judge the line itself.
   */
  private still = new URLSearchParams(location.search).get('still')
  private stillDone = false
  private drawStill() {
    const index = ART_SKETCHES.findIndex(a => a.id === this.still)
    if (index < 0 || this.stillDone) return
    this.order = [index]; this.drawn = 0; this.nextPicture(); this.looseness = 0
    const p = this.picture!
    p.strokes.forEach((stroke, i) => { for (let j = 1; j < stroke.length; j++) { const [ax, ay] = this.point(p, stroke[j - 1], i, j - 1), [bx, by] = this.point(p, stroke[j], i, j); this.trace(ax, ay, bx, by, 4.5, .45, .42) } })
    if (this.build) for (const piece of this.build.building.pieces) this.press(this.build, piece, 1)
    p.stroke = p.strokes.length; this.stillDone = true
  }

  frame(hear: Hearing, dt: number, now: number) {
    if (this.still) { this.drawStill(); this.surface.settle(dt); this.renderer.render(this.surface, this.width, this.height); return }
    const k = this.intensity, W = this.width, H = this.height, m = Math.min(W, H)
    this.bpm = hear.bpm
    // Sections: a new phrase brings a new work.
    if (hear.beat && hear.count > 0 && hear.count % 32 === 0) this.nextPicture()
    // A drop: the wind clears the sand for a new work, and once its silhouette is drawn the broad
    // brush sweeps boldly back over part of it.
    if (hear.trend > 1.45 && hear.level > .35 && now - this.lastDrop > 8000) { this.lastDrop = now; this.nextPicture(); this.boldPending = true }
    this.calm = hear.trend < .55 || (this.calm && hear.trend < .9)
    const wanted = Math.min(1, .25 + hear.level * .45 + Math.max(0, hear.trend - 1) * .6 + (now - this.lastDrop < 6000 ? .35 : 0))
    this.looseness += (wanted - this.looseness) * (1 - Math.exp(-dt * 1.5))
    const load = (.22 + hear.level * .6 + hear.bands.bass * .3 + hear.kick * .25) * (.85 + .15 * Math.sin(now / 260)) * k
    const p = this.picture, b = this.build, ready = now > this.blowUntil && !this.calm

    if (this.calm) {
      // A breakdown: quiet rings raked around a stone.
      const before = this.ringS; this.ringS += dt * (hear.bpm / 120) * .1 * k
      const at = (s: number): [number, number] => { const a = s * Math.PI * 2, r = (.07 + (Math.floor(s) % 6) * .055) * m; return [W * this.stone[0] + Math.cos(a) * r, H * this.stone[1] + Math.sin(a) * r] }
      const [bx, by] = at(before), [x, y] = at(this.ringS)
      if (Math.hypot(x - bx, y - by) < m * .05 && hear.level > .03) this.trace(bx, by, x, y, 11, load * .8, .45)
      this.finger.down = false
    } else if (p && p.stroke < p.strokes.length && hear.level > .03 && ready) {
      // Drawing: the fingertip walks along the current stroke. It keeps the real tempo, surging as
      // each beat lands and easing toward the next (the pulse averages 1, so a work is finished in
      // about 70% of a phrase, a touch quicker when loud).
      const stroke = p.strokes[p.stroke], pulse = .6 + 1.2 * (1 - hear.phase) ** 2
      p.at += dt * p.length / (32 * 60 / hear.bpm * .7) * (.85 + hear.level * .3) * pulse * k
      const i = Math.min(stroke.length - 1, Math.floor(p.at / 1.2)), target = this.point(p, stroke[i], p.stroke, p.at)
      // Pressure lands with the beat too; the bass widens the fingertip a little.
      const press = load * (.85 + .3 * (1 - hear.phase) ** 3)
      if (this.finger.down) this.trace(this.finger.x, this.finger.y, target[0], target[1], 4.5 + hear.bands.bass * 1.5, press * .85, .42)
      this.finger = { x: target[0], y: target[1], down: true }
      // The end of a stroke: lift, and move to the next.
      if (i >= stroke.length - 1) { p.stroke++; p.at = 0; this.finger.down = false }
    }

    // The building rises beat by beat beside the work, a piece pressed on each beat (deeper on a
    // hard kick); its doors and windows are cut on the snares, or on the beat once it stands.
    if (b && ready && hear.level > .03) {
      const strength = Math.min(1.25, (.85 + hear.kick * .3 + hear.bands.bass * .1) * k)
      if (hear.beat && b.main.length) { this.press(b, b.main.shift()!, strength); if (hear.kick > .8 && b.main.length && Math.random() < .5) this.press(b, b.main.shift()!, strength) }
      else if ((hear.snareHit || (hear.beat && !b.main.length)) && b.details.length && b.main.length < b.building.pieces.length * .5) this.press(b, b.details.shift()!, strength)
    }

    // The broad brush: after a drop, boldly over part of the silhouette once it is drawn; each bar,
    // lightly over one of the lines already drawn (every bar once the work is done, every other
    // bar while it is being drawn), so lines thicken here and there with the music.
    if (p && ready) {
      if (this.boldPending && p.stroke >= 1) { this.boldPending = false; this.brush(p, 0, .45, 4, 12 + hear.bands.bass * 5, .4) }
      const done = p.stroke >= p.strokes.length, drawnLines = Math.min(p.stroke, p.strokes.length)
      if (hear.beat && drawnLines && hear.level > .2 && hear.count % (done ? 4 : 8) === 0 && this.sweeps.length < 2) {
        // Longer lines are likelier, so the brush mostly finds the lines that carry the shape.
        let pick = Math.random() * p.strokes.slice(0, drawnLines).reduce((n, s) => n + s.length, 0), stroke = 0
        while (stroke < drawnLines - 1 && (pick -= p.strokes[stroke].length) > 0) stroke++
        this.brush(p, stroke, .25 + hear.bands.mid * .3, hear.bpm > 130 ? 3 : 2, 9 + hear.level * 5, .28)
      }
      this.sweeps = this.sweeps.filter(s => this.sweep(p, s, hear, dt, k))
    }
    this.wind(dt)
    this.surface.settle(dt)
    this.light(hear, now)
    this.renderer.render(this.surface, W, H)
  }

  /** Start a pass of the broad brush over `span` of a stroke, lasting `beats` beats. */
  private brush(p: Picture, stroke: number, span: number, beats: number, r: number, load: number) {
    const n = p.strokes[stroke]?.length ?? 0
    if (n < 4) return
    const length = Math.max(3, Math.round(n * Math.min(1, span))), from = Math.floor(Math.random() * (n - length)), to = from + length - 1
    const [a, z] = Math.random() > .5 ? [from, to] : [to, from]
    this.sweeps.push({ stroke, from: a, to: z, t: 0, beats, r, load, last: null })
  }
  /** One frame of a brush pass: it lands softly, presses fullest midway, and lifts softly. */
  private sweep(p: Picture, s: Sweep, hear: Hearing, dt: number, k: number) {
    const line = p.strokes[s.stroke]
    s.t = Math.min(1, s.t + dt / (s.beats * 60 / hear.bpm))
    const e = s.t * s.t * (3 - 2 * s.t), i = s.from + (s.to - s.from) * e, j = Math.min(line.length - 2, Math.floor(i)), f = i - j
    const at = this.point(p, [line[j][0] + (line[j + 1][0] - line[j][0]) * f, line[j][1] + (line[j + 1][1] - line[j][1]) * f], s.stroke, i * 1.2)
    const touch = Math.sin(Math.PI * s.t) ** .7
    if (s.last) this.trace(s.last[0], s.last[1], at[0], at[1], s.r * (.55 + .45 * touch), s.load * (.25 + .75 * touch) * (.9 + hear.bands.bass * .2) * k, .3)
    s.last = at
    return s.t < 1
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
    if (this.snow) {
      // Snow is nearly white, so brightness would only clip it: the music plays its shadows instead. A low
      // winter sun circles with the phrase and swings on each beat; bass brings it lower still, so prints
      // and moulds cast long sky-blue shadows, deeper on the kicks. The open snow is lit as brightly as
      // under a high sun (the exposure makes up for the low angle); the pool of light is faint and cool.
      const low = Math.max(.22, Math.min(.5, .38 - hear.bands.bass * .14 + Math.max(0, hear.trend - 1) * .1))
      L.fine = [Math.cos(azimuth), Math.sin(azimuth), low]
      const flat = low / Math.hypot(1, low), deep = Math.min(1, .6 + hear.kick * .25 + hear.bands.bass * .2) * this.intensity
      L.exposure = (.86 + .2 * .61) / (.86 + .2 * flat) * .99
      L.shadow = [.8 - .3 * deep, .85 - .24 * deep, .93 - .12 * deep]
    }
    const drift = beats / 16 * Math.PI, flare = now - this.lastDrop < 2500 ? (1 - (now - this.lastDrop) / 2500) * .8 : 0
    L.spot = [.5 + Math.sin(drift) * .3, .5 + Math.sin(drift * 2) * .18, this.calm ? .08 : Math.min(1.1, (.18 + hear.bands.mid * .45) * this.intensity + flare) * (this.snow ? .3 : 1)]
  }

  /** Wind smooths the sand back toward its dunes, faster in a breakdown, so marks become texture and fade. */
  private wind(dt: number) {
    const { levels, base, disturbed, compact } = this.surface, now = performance.now(), drawing = this.picture && this.picture.stroke < this.picture.strokes.length
    let strength = this.calm ? .3 : drawing ? .015 : .03
    if (now < this.blowUntil) {
      // Between works the wind rises and falls again; over the gust about one percent of the old work is left.
      const t = (now - this.blowFrom) / (this.blowUntil - this.blowFrom), seconds = (this.blowUntil - this.blowFrom) / 1000
      strength = Math.max(strength, 4.6 * Math.PI / 2 / seconds * Math.sin(Math.PI * t))
    }
    const rate = 1 - Math.exp(-dt * strength)
    for (let i = 0; i < levels.length; i++) { levels[i] += (base[i] - levels[i]) * rate; disturbed[i] *= 1 - rate * .5; compact[i] *= 1 - rate }
  }
}

const SNOW_LOAD = .9, SNOW_DEPTH = 2.6
const rand = (n: number) => (Math.random() * 2 - 1) * n
const between = (a: number, b: number) => a + Math.random() * (b - a)
