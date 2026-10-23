import { SandSurface, terrainNoise } from '../effects/SandSurface'
import { SnowSurface } from '../effects/SnowSurface'
import { FogWindow } from './fogWindow'
import { WaterPool } from './waterPool'
import { GranularRenderer } from '../effects/GranularRenderer'
import { strokesOf } from './drawings'
import { ART_SKETCHES } from './artSketches'
import { SCROLLS, sceneStrokes, type Scroll } from './scrolls'
import type { Mood } from './storylines'
import type { Hearing } from './audioEngine'
import { nextBuilding, inside, type Building, type Piece } from './buildings'

/**
 * Sand, played by the music the way hands play the Sand study: the same surface and renderer, the
 * same furrows, rims and settling. Each phrase a fingertip draws a famous work (its cut for the
 * sand: the silhouette in one movement, then a few inner lines), surging with every beat and
 * pressing harder with the loudness. Beside it, beat by beat, sandcastle forms press a building
 * into the sand, made fresh each time (see buildings.ts), its windows and doors cut on the snares;
 * the works that fill the whole sand have none.
 *
 * The sand is an endless scroll, like a handscroll unrolled without end (see scroll()): it travels
 * steadily to the left at the tempo, a little push on every beat, so each work is drawn as it comes
 * in on the right, its building pressed beside it as that comes in after, and both drift on to the
 * left, the wind wearing them away until they leave the sand. A river runs the whole length below
 * them, its bends deepening with the bass. A drop rushes the scroll on to the next work; a breakdown
 * all but stops it; when the music stops it still drifts. Time is laid out left to right: fresh on
 * the right, worn on the left.
 *
 * Snow plays the same way on the Snow study's powder, with winter buildings (igloos, snowmen, a
 * cabin among pines) among the others; between works fresh snow settles evenly over the old work.
 * A low winter sun circles with the phrase so every print casts a long blue shadow; hats make the
 * crystals glint.
 *
 * Fog is a fogged window at night instead (see fogWindow.ts): the finger clears the glass, so the
 * work and its building show as the sharp city lights behind; heavy kicks send beads running down
 * the lines, and between works the condensation forms evenly again. A broad soft brush sweeps back over some of the work's lines each bar once it is drawn,
 * and over its silhouette after a drop, thickening them. A breakdown rakes quiet rings instead.
 */
/** Each stroke of a sketch is a little off: shifted, turned and scaled, with its own tremor. */
type Hand = { dx: number; dy: number; turn: number; scale: number; phase: number }
type Picture = { name: string; after?: string; cx: number; cy: number; hw: number; hh: number; strokes: [number, number][][]; hands: Hand[]; length: number; x: number; y: number; size: number; tilt: number; stroke: number; at: number; scene?: boolean }
/** One pass of the broad brush along part of a stroke of the picture (indices into its points). */
type Sweep = { stroke: number; from: number; to: number; t: number; beats: number; r: number; load: number; last: [number, number] | null }

const DEPTH = { 1: .1, 2: .17, 3: .25 }
type Build = { building: Building; x: number; y: number; w: number; h: number; main: Piece[]; details: Piece[] }
export type Material = 'sand' | 'snow' | 'fog' | 'water'

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
  private lastDrop = -Infinity; private lastQuiet = -Infinity; private calm = false
  private stone: [number, number] = [.5, .5]
  /** The scroll: screen pixels travelled, whole cells already slid, a drop's rush, and the river's last point. */
  private pan = 0; private slid = 0; private rush = 0
  private riverAt: [number, number] | null = null; private bend = 0
  /** The light as it eases toward the music (see light()). */
  private lit = { height: .42, exposure: 1, sparkle: 0, bass: 0, spot: 0, turn: 0 }
  intensity = 1

  /**
   * A theme to play on the sand scroll (see scrolls.ts and docs/DRAWING-AGENT.md): '' draws random
   * works with buildings, 'all' plays every composed scroll in turn, or one scroll's id. Scenes are
   * laid end to end, so their ground and border run on; the music picks which comes next.
   */
  private theme = new URLSearchParams(location.search).get('story') ?? ''
  private scrollNow: Scroll | null = null
  private sceneAt = -1
  /** What the music asked for while a scene was still being drawn: taken up as soon as it is finished. */
  private pending: Mood | 'next' | null = null

  private window: FogWindow | null = null
  private pool: WaterPool | null = null
  private floorSrc = ''
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
    // Sand stands like a mural: what the fingertip piles up runs down the screen.
    if (!this.snow) this.surface.gravity = GRAVITY
    // The scroll's own dunes, laid out along its length so new ground can keep arriving.
    this.pan = this.slid = 0; this.riverAt = null; Object.assign(this.renderer.scroll, { on: this.scrolling, cells: 0, travel: 0 })
    if (this.scrolling) { const s = this.surface; for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) s.base[y * gw + x] = this.ground(x, y); s.reset() }
    if (this.fog && !this.window) this.window = new FogWindow(this.host)
    this.window?.resize(this.width, this.height)
    if (this.water && !this.pool) { this.pool = new WaterPool(this.host); if (this.floorSrc) this.pool.floor(this.floorSrc) }
    this.pool?.resize(this.width, this.height)
    this.canvas.hidden = this.fog || this.water; if (this.window) this.window.canvas.hidden = !this.fog; if (this.pool) this.pool.canvas.hidden = !this.water
    this.finger.down = false
    this.stillDone = false // a new surface needs the still work pressed again
  }

  private get snow() { return this.material === 'snow' }
  private get fog() { return this.material === 'fog' }
  private get water() { return this.material === 'water' }
  /** Sand is an endless scroll (but not when tuning a still). */
  private get scrolling() { return this.material === 'sand' && !this.still }
  /** Untouched ground at a cell of the scroll: long rounded dunes along its whole length. */
  private ground(x: number, y: number) {
    const s = this.surface, scale = Math.max(s.width, s.height), u = (this.slid + x) / scale, v = y / scale
    const broad = terrainNoise(u * 3.1 + 4.7, v * 3.1 + 2.3), shoulder = terrainNoise(u * 5.2 + 11.2, v * 5.2 + 7.8)
    const mound = terrainNoise(u * 1.6 + 20.3, v * 2.1 + 3.1) * .7 + terrainNoise(u * 2.9 + 8.1, v * 2.9 + 15.6) * .3, m = Math.max(0, Math.min(1, (mound - .3) / .55))
    return .94 + m * m * (3 - 2 * m) * 1.4 + broad * .1 + shoulder * .025
  }
  /** Screen x to the surface's cells and back: a scrolling view hides one column and slides across it. */
  private get cellScale() { return this.scrolling ? (this.surface.width - 1) / this.width : this.surface.width / this.width }
  private get cellShift() { return this.scrolling ? this.renderer.scroll.cells : 0 }
  get kind() { return this.material }
  /** The picture under the water (an image URL); empty for the tiled pool. */
  floor(src: string) { this.floorSrc = src; this.pool?.floor(src || undefined) }
  /** Change material: a fresh surface, and a new work on it. */
  set kind(material: Material) { if (material === this.material) return; this.material = material; this.resize(); this.nextPicture() }

  get mood() { return this.water ? this.pool!.mood : this.calm ? 'calm' : this.snow && performance.now() < this.blowUntil ? 'fresh snow' : this.fog && performance.now() < this.blowUntil ? 'fogging over' : performance.now() - this.lastDrop < 5000 ? 'drop · broad brush' : this.sweeps.length ? 'drawing · broad brush' : 'drawing' }
  get figure() {
    if (this.water) return this.pool!.figure
    const p = this.picture, b = this.build
    if (this.calm && !p?.scene) return this.snow ? 'rings traced in the snow' : this.fog ? 'rings traced on the glass' : 'raked rings'
    return p ? `${p.name}${p.after ? `, after ${p.after}` : ''}${p.stroke >= p.strokes.length ? ' (done)' : ''}${b ? ` · ${b.building.name} rising beside it` : ''}` : ''
  }

  /** One touch on the sand, in screen pixels: radius, load (how hard it presses) and motion. */
  private stamp(x: number, y: number, r: number, load: number, amount: number, mx = 0, my = 0) {
    const sx = this.cellScale, sy = this.surface.height / this.height, gx = x * sx + this.cellShift
    // Powder gives far more under the same weight than sand, so the snow is touched lightly.
    if (this.fog) this.window!.touch(x, y, r * FOG_R, load)
    else if (this.snow) this.surface.touch(gx, y * sy, r * sx * 1.2, load * SNOW_LOAD, amount * .8)
    else this.surface.touch(gx, y * sy, r * sx, load, amount, mx, my)
  }
  /** Drag a touch from a to b, stamped closely enough to leave one continuous furrow. */
  private trace(ax: number, ay: number, bx: number, by: number, r: number, load: number, amount: number) {
    const d = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(d / Math.max(2, r * .22)))
    for (let i = 1; i <= steps; i++) { const t = i / steps; this.stamp(ax + (bx - ax) * t, ay + (by - ay) * t, r, load, amount, bx - ax, by - ay) }
  }

  /** The themes that can be played: composed scrolls, by id and title. */
  static get stories() { return SCROLLS.map(s => ({ id: s.id, title: s.title ?? s.id })) }
  get story() { return this.theme }
  /** Play a theme ('' for random works, 'all' for every scroll in turn), starting from its first scene. */
  set story(id: string) {
    this.theme = id; this.scrollNow = null; this.sceneAt = -1
    const p = this.picture; if (p && !p.stroke && !p.at) this.picture = null // a scene not yet begun gives way
    this.nextPicture()
  }

  /** The next scene of the theme, laid on the scroll just after the one before; `mood` skips ahead to one that fits. */
  private nextScene(mood?: Mood) {
    if (!this.scrollNow) { this.scrollNow = SCROLLS.find(s => s.id === this.theme) ?? SCROLLS[Math.floor(Math.random() * SCROLLS.length)]; this.sceneAt = -1 }
    let scroll = this.scrollNow, n = scroll.scenes.length, i = this.sceneAt + 1
    // Never the same scene twice running: the search starts after it and stops before coming back to it.
    // Playing every theme in turn, it only looks ahead, so the music never holds the deck in one theme.
    const all = this.theme === 'all' || !SCROLLS.some(s => s.id === this.theme)
    if (mood) for (let k = 1; k < n; k++) { const j = this.sceneAt + k; if (all && j >= n) break; if (scroll.scenes[j % n].mood === mood) { i = j % n; break } }
    if (i >= n) {
      // The end of the scroll: the next one (for 'all'), or this one again.
      if (all) scroll = this.scrollNow = SCROLLS[(SCROLLS.indexOf(scroll) + 1) % SCROLLS.length]
      i = 0
    }
    this.sceneAt = i
    const scene = scroll.scenes[i], strokes = sceneStrokes(scene), W = this.width, H = this.height
    // A scene is 200 × 100, as large as the screen allows (most of its height, under its width),
    // scene after scene meeting end to end; it stands a little above the middle of the sand.
    const size = Math.min(W * .45, H * .84), hw = size, hh = size / 2
    const p0 = this.picture, queued = p0?.scene && !p0.stroke && !p0.at
    const x = p0?.scene ? (queued ? p0.x : p0.x + p0.hw + hw) : W - 8 - hw
    this.picture = { name: `${scene.caption ?? scene.episode} · ${scroll.title ?? scroll.id}`, cx: 100, cy: 50, hw, hh, strokes, hands: strokes.map(() => ({ dx: rand(.25), dy: rand(.25), turn: rand(.004), scale: 1 + rand(.004), phase: Math.random() * 100 })), length: strokes.reduce((sum, s) => sum + s.length * 1.2, 0), x, y: H * .48, size, tilt: 0, stroke: 0, at: 0, scene: true }
    this.build = null; this.sweeps = []; this.boldPending = false; this.finger.down = false
    this.blowFrom = this.blowUntil = performance.now()
  }

  /** The next work, large on the sand, with the next building's place beside it (or the theme's next scene). */
  private nextPicture(mood?: Mood) {
    if (this.scrolling && this.theme && SCROLLS.length) {
      // A scene half drawn is never abandoned: the request waits for it (a drop's climax wins over a phrase's next).
      const p = this.picture
      if (p?.scene && (p.stroke || p.at) && p.stroke < p.strokes.length) { if (mood || !this.pending) this.pending = mood ?? 'next'; return }
      // A scene still coming in is already the next one; only a drop or a breakdown replaces it.
      if (p?.scene && !p.stroke && !p.at && !mood) return
      this.pending = null; this.nextScene(mood); return
    }
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
    // On the fogged window everything is drawn by hand: no building, so every work is centred and large.
    const full = !!art.full || this.fog
    if (this.scrolling) {
      // On the scroll each work is one scene of many: it comes in on the right above the river,
      // with room after it for its building, and the scene before it still drifting on the left.
      const fit = Math.min(W * (full ? .56 : .4) / Math.max(10, x1 - x0), H * .58 / Math.max(10, y1 - y0)) * 100
      const hw = (x1 - x0) / 200 * fit, hh = (y1 - y0) / 200 * fit
      // After a drop the scene before may still be on the right: the new one queues just after it,
      // off the sand, and is drawn once it has come on.
      // (A scene not yet begun is simply dropped.)
      const p0 = this.picture, b0 = this.build
      const before = Math.max(p0 && (p0.stroke || p0.at) ? p0.x + p0.hw : 0, b0 && b0.main.length < b0.building.pieces.filter(q => !q[6]).length ? b0.x + b0.w : 0)
      const x = Math.max(W * .92 - hw, before + W * .06 + hw)
      this.picture = { name: art.name, after: art.after, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw, hh, strokes, hands, length: strokes.reduce((sum, s) => sum + s.length * 1.2, 0), x, y: H * .42, size: fit, tilt: rand(.03), stroke: 0, at: 0 }
      this.build = full ? null : this.placeAfter(this.picture)
      this.sweeps = []; this.boldPending = false; this.finger.down = false
      this.blowFrom = this.blowUntil = performance.now()
      this.stone = [.62, .4]
      return
    }
    const fit = Math.min(W * (full ? .94 : .88) / Math.max(10, x1 - x0), H * (full ? .9 : .84) / Math.max(10, y1 - y0)) * 100
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
  /** On the scroll: the next building just after the work, standing on the river bank, still off the sand to the right. */
  private placeAfter(p: Picture): Build | null {
    const building = nextBuilding(false), a = building.aspect, W = this.width, H = this.height
    const s = Math.min(H * between(.3, .4), W * .24 / a), bottom = H * RIVER - H * .07
    const main = building.pieces.filter(q => !q[6]), order = Math.floor(Math.random() * 3), side2 = Math.random() > .5 ? 1 : -1
    main.sort(order === 0 ? (p, q) => q[4] - p[4] || q[2] - p[2] : order === 1 ? (p, q) => side2 * (p[1] - q[1]) : (p, q) => Math.abs((p[1] + p[3]) / 2 - .5) - Math.abs((q[1] + q[3]) / 2 - .5))
    return { building, x: p.x + p.hw + W * .06, y: bottom - s, w: s * a, h: s, main, details: building.pieces.filter(q => q[6]).sort((p, q) => q[4] - p[4]) }
  }
  /** Press one piece of the building into the sand. */
  private press(b: Build, [shape, u0, v0, u1, v1, level]: Piece, strength: number) {
    const X0 = b.x + u0 * b.w, Y0 = b.y + v0 * b.h, X1 = b.x + u1 * b.w, Y1 = b.y + v1 * b.h, test = inside(shape, X0, Y0, X1, Y1)
    // On the glass, the shallow pieces leave a film and the deep ones wipe it clean.
    if (this.fog) { this.window!.imprint(X0, Y0, X1, Y1, test, Math.min(1, (.35 + level * .22) * strength)); return }
    const sx = this.cellScale, sy = this.surface.height / this.height, o = this.cellShift
    this.surface.imprint(X0 * sx + o, Y0 * sy, X1 * sx + o, Y1 * sy, (x, y) => test((x - o) / sx, y / sy), DEPTH[level] * strength * (this.snow ? SNOW_DEPTH : 1))
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
    // Water holds no drawing: the music plays the pool itself (see waterPool.ts).
    if (this.water) { this.pool!.frame(hear, dt, now, this.intensity); return }
    if (this.still) { this.drawStill(); if (this.fog) this.window!.render(hear, dt, now, 0, false); else { this.surface.settle(dt); this.renderer.render(this.surface, this.width, this.height) } return }
    const k = this.intensity, W = this.width, H = this.height, m = Math.min(W, H)
    this.bpm = hear.bpm
    // Sections: a new phrase brings a new work.
    if (hear.beat && hear.count > 0 && hear.count % 32 === 0) this.nextPicture()
    // A drop: the wind clears the sand for a new work, and once its silhouette is drawn the broad
    // brush sweeps boldly back over part of it.
    // A theme's scenes are chosen by the music: a drop takes the next climax, a breakdown the next quiet one.
    if (hear.trend > 1.45 && hear.level > .35 && now - this.lastDrop > 8000) { this.lastDrop = now; this.rush = 7; this.nextPicture('climax'); this.boldPending = true }
    const wasCalm = this.calm
    this.calm = hear.trend < .55 || (this.calm && hear.trend < .9)
    if (this.calm && !wasCalm && this.picture?.scene && now - this.lastQuiet > 8000) { this.lastQuiet = now; this.nextPicture('quiet') }
    if (this.scrolling) this.scroll(hear, dt)
    const wanted = Math.min(1, .25 + hear.level * .45 + Math.max(0, hear.trend - 1) * .6 + (now - this.lastDrop < 6000 ? .35 : 0))
    this.looseness += (wanted - this.looseness) * (1 - Math.exp(-dt * 1.5))
    const load = (.22 + hear.level * .6 + hear.bands.bass * .3 + hear.kick * .25) * (.85 + .15 * Math.sin(now / 260)) * k
    // A theme's scene keeps being drawn through a breakdown (it is the quiet scene); otherwise a breakdown rakes rings.
    const p = this.picture, b = this.build, scene = !!p?.scene, ready = now > this.blowUntil && (!this.calm || scene)

    if (this.calm && !scene) {
      // A breakdown: quiet rings raked around a stone.
      const before = this.ringS; this.ringS += dt * (hear.bpm / 120) * .1 * k
      const at = (s: number): [number, number] => { const a = s * Math.PI * 2, r = (.07 + (Math.floor(s) % 6) * .055) * m; return [W * this.stone[0] + Math.cos(a) * r, H * this.stone[1] + Math.sin(a) * r] }
      const [bx, by] = at(before), [x, y] = at(this.ringS)
      if (Math.hypot(x - bx, y - by) < m * .05 && hear.level > .03) this.trace(bx, by, x, y, 11, load * .8, .45)
      this.finger.down = false
    } else if (p && p.stroke < p.strokes.length && hear.level > .03 && ready && (!this.scrolling || scene || p.x + p.hw < W - 6)) {
      // A theme's scene is drawn as it comes in: the fingertip waits at the right edge for the next point to arrive.
      const held = scene && this.point(p, p.strokes[p.stroke][Math.min(p.strokes[p.stroke].length - 1, Math.floor(p.at / 1.2) + 1)], p.stroke, p.at)[0] > W - 6
      // Drawing: the fingertip walks along the current stroke. It keeps the real tempo, surging as
      // each beat lands and easing toward the next (the pulse averages 1, so a work is finished in
      // about 70% of a phrase, a touch quicker when loud).
      const stroke = p.strokes[p.stroke], pulse = .6 + 1.2 * (1 - hear.phase) ** 2
      // On the scroll a work is drawn in half a phrase, while it is still on the right.
      if (!held) p.at += dt * p.length / (32 * 60 / hear.bpm * (this.scrolling ? .5 : .7)) * (.85 + hear.level * .3) * pulse * k
      const i = Math.min(stroke.length - 1, Math.floor(p.at / 1.2)), target = this.point(p, stroke[i], p.stroke, p.at)
      // Pressure lands with the beat too; the bass widens the fingertip a little.
      const press = load * (.85 + .3 * (1 - hear.phase) ** 3)
      if (this.finger.down) this.trace(this.finger.x, this.finger.y, target[0], target[1], 4.5 + hear.bands.bass * 1.5, press * .85, .42)
      this.finger = { x: target[0], y: target[1], down: true }
      // The end of a stroke: lift, and move to the next.
      if (i >= stroke.length - 1) { p.stroke++; p.at = 0; this.finger.down = false }
      // A scene just finished: now take up what the music asked for meanwhile.
      if (p.scene && p.stroke >= p.strokes.length && this.pending) { const want = this.pending; this.pending = null; this.nextPicture(want === 'next' ? undefined : want) }
    }

    // The building rises beat by beat beside the work, a piece pressed on each beat (deeper on a
    // hard kick); its doors and windows are cut on the snares, or on the beat once it stands.
    // On the scroll it waits until it has come fully onto the sand.
    if (b && ready && hear.level > .03 && (!this.scrolling || (b.x + b.w < W - 8 && b.x > 8))) {
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
    if (this.fog) {
      // A heavy kick sends a bead running down from where the finger is.
      const f = this.finger
      if (hear.beat && hear.kick > .75 && f.down && Math.random() < .6 && this.window!.clearAt(f.x, f.y) > .4) this.window!.drip(f.x, f.y + 6)
      this.window!.render(hear, dt, now, now - this.lastDrop < 2500 ? 1 - (now - this.lastDrop) / 2500 : 0, this.calm)
      return
    }
    this.surface.settle(dt)
    this.light(hear, now, dt)
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
   * The light on the sand barely moves, so a big projected wall stays calm: the drawing carries the
   * music, not the light. The sun drifts an eighth of the sky each phrase; bass lowers it a touch
   * (slightly longer shadows); hats bring out a faint glitter in the quartz; the mids a faint warm pool
   * of light. Every value eases over seconds: on a projector, any quick change in light reads as flicker.
   */
  private light(hear: Hearing, now: number, dt: number) {
    const L = this.renderer.light, s = this.lit
    const ease = (t: number) => 1 - Math.exp(-dt / t)
    s.height += (Math.max(.34, Math.min(.46, .42 - hear.bands.bass * .06 + Math.max(0, hear.trend - 1) * .04)) - s.height) * ease(3)
    s.exposure += (1 + hear.level * .012 * this.intensity - s.exposure) * ease(3)
    s.sparkle += (Math.min(.22, (hear.hat * .2 + hear.bands.high * .15 + hear.bands.air * .1) * this.intensity) - s.sparkle) * ease(2.5)
    s.bass += (hear.bands.bass * .12 - s.bass) * ease(3)
    const flare = now - this.lastDrop < 4000 ? (1 - (now - this.lastDrop) / 4000) * .1 : 0
    s.spot += ((this.calm ? .06 : Math.min(.3, (.1 + hear.bands.mid * .1) * this.intensity + flare) * (this.snow ? .3 : 1)) - s.spot) * ease(3)
    s.turn += dt * Math.PI / 4 / (32 * 60 / Math.max(60, hear.bpm))
    const azimuth = Math.atan2(-.75, -.45) + Math.sin(s.turn) * Math.PI / 4
    L.sun = [Math.cos(azimuth) * .87, Math.sin(azimuth) * .87, s.height]
    L.exposure = s.exposure
    L.sparkle = s.sparkle
    if (this.snow) {
      // Snow is nearly white, so brightness would only clip it: the music plays its shadows instead. A low
      // winter sun drifts with the phrase; bass brings it a little lower, so prints and moulds cast long
      // sky-blue shadows, deep enough to read on a projected wall. The open snow is lit as brightly as
      // under a high sun (the exposure makes up for the low angle); the pool of light is faint and cool.
      const low = Math.max(.16, Math.min(.4, .28 + (s.height - .4) * .7))
      L.fine = [Math.cos(azimuth), Math.sin(azimuth), low]
      const flat = low / Math.hypot(1, low), deep = Math.min(1, .75 + s.bass) * this.intensity
      L.exposure = (.86 + .2 * .61) / (.86 + .2 * flat) * .99
      L.shadow = [.58 - .3 * deep, .66 - .26 * deep, .86 - .16 * deep]
    }
    const drift = s.turn * 2
    L.spot = [.5 + Math.sin(drift) * .3, .5 + Math.sin(drift * 2) * .18, s.spot]
  }

  /**
   * Unroll the scroll a little: the sand travels left a screen's width every 48 beats, pushed on each
   * beat and easing after it; a drop rushes it on, a breakdown all but stops it, silence lets it
   * drift. Everything on it travels with it; whole cells slide in the surface and fresh dunes come in
   * on the right, while the renderer slides smoothly across the cell in between. At the right edge
   * the river is drawn on into the new sand.
   */
  private scroll(hear: Hearing, dt: number) {
    const W = this.width, H = this.height, s = this.surface, quiet = hear.level < .03
    this.rush *= Math.exp(-dt * 1.1)
    const pace = W * Math.max(60, hear.bpm) / 60 / 48, push = .8 + .4 * (1 - hear.phase) ** 2
    const speed = pace * (this.calm ? .15 : quiet ? .3 : push) * (1 + this.rush)
    const d = speed * dt, cell = W / (s.width - 1)
    this.pan += d
    const total = this.pan / cell, n = Math.floor(total) - this.slid
    if (n > 0) { s.slide(n, (x, y) => this.ground(x, y)); this.slid += n }
    this.renderer.scroll.cells = total - this.slid; this.renderer.scroll.travel = this.pan
    // What is on the sand goes with it.
    const p = this.picture, b = this.build
    if (p) p.x -= d
    if (b) b.x -= d
    this.finger.x -= d; this.stone[0] -= d / W
    for (const sweep of this.sweeps) if (sweep.last) sweep.last[0] -= d
    // A theme's scenes carry their own ground and border, so the river rests while they play.
    if (p?.scene) { this.riverAt = null; return }
    // The river runs on under every scene, its bends deepening with the bass.
    this.bend += (hear.bands.bass * .045 - this.bend) * (1 - Math.exp(-dt / 2))
    const at = (this.pan + W - 6) / W, x = W - 6, y = H * (RIVER + Math.sin(at * 2.7) * .03 + Math.sin(at * 7.3 + 1.1) * this.bend)
    if (this.riverAt) {
      this.riverAt[0] -= d
      if (x - this.riverAt[0] > 3) { this.trace(this.riverAt[0], this.riverAt[1], x, y, 7, quiet ? .25 : .35, .4); this.riverAt = [x, y] }
    } else this.riverAt = [x, y]
  }

  /**
   * Wind smooths the sand back toward its dunes, faster in a breakdown, so marks become texture and
   * fade. On the scroll it wears hardest on the left: a work is crisp as it is drawn on the right and
   * nearly gone by the time it leaves.
   */
  private wind(dt: number) {
    const { levels, base, disturbed, compact } = this.surface, now = performance.now(), drawing = this.picture && this.picture.stroke < this.picture.strokes.length
    if (this.scrolling) {
      const w = this.surface.width
      for (let x = 0; x < w; x++) {
        const left = 1 - x / w, rate = 1 - Math.exp(-dt * ((this.calm ? .06 : .004) + .55 * left ** 4))
        for (let i = x; i < levels.length; i += w) { levels[i] += (base[i] - levels[i]) * rate; disturbed[i] *= 1 - rate * .5; compact[i] *= 1 - rate }
      }
      return
    }
    let strength = this.calm ? .3 : drawing ? .015 : .03
    if (now < this.blowUntil) {
      // Between works the wind rises and falls again; over the gust about one percent of the old work is left.
      const t = (now - this.blowFrom) / (this.blowUntil - this.blowFrom), seconds = (this.blowUntil - this.blowFrom) / 1000
      strength = Math.max(strength, 4.6 * Math.PI / 2 / seconds * Math.sin(Math.PI * t))
    }
    const rate = 1 - Math.exp(-dt * strength)
    if (this.fog) { this.window!.fog(rate); return }
    for (let i = 0; i < levels.length; i++) { levels[i] += (base[i] - levels[i]) * rate; disturbed[i] *= 1 - rate * .5; compact[i] *= 1 - rate }
  }
}

const SNOW_LOAD = .9, SNOW_DEPTH = 2.6
/** How steeply the sand mural leans (see SandSurface.gravity). */
const GRAVITY = .01
/** Where the river runs on the scroll, as a share of the height. */
const RIVER = .86
/** A fingertip on glass clears a wider line than it cuts in sand. */
const FOG_R = 2.2
const rand = (n: number) => (Math.random() * 2 - 1) * n
const between = (a: number, b: number) => a + Math.random() * (b - a)
