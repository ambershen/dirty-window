/**
 * The landing hero as one fogged window. Whatever view sits behind it, the glass behaves the same:
 * an unseen finger writes "Natural Effects" into the condensation, the fog slowly closes over the
 * words to a ghost and the title is written again; beads gather, grow heavy and run; a passing
 * pointer smears the glass, a drag writes, and holding still breathes fog back over it, bringing out
 * the ghosts of earlier writing. Built the way the Steam study and the simulate-natural-fog skill
 * describe: a blurred veil over the view, cleared by a mask.
 */
export interface HeroView {
  /** The fog's colour over this view. */
  readonly veil: string
  /** New beads per second per megapixel of glass, and how readily heavy ones run (rain is busier). */
  readonly condensation?: { rate: number; run: number; size?: number }
  resize(w: number, h: number, dpr: number): void
  draw(g: CanvasRenderingContext2D, now: number): void
  /** Where the viewer looks from, -1..1, for views with depth. */
  lookAt?(x: number, y: number): void
}

type Stroke = { x: number; y: number; px: number; py: number; r: number; alpha: number; born: number; hold: number; fade: number }
type Run = { x: number; y: number; points: number[]; speed: number; age: number; life: number; phase: number; born: number; title: boolean }
type Bead = { x: number; y: number; r: number; grow: number }

const VEIL = 4 // the veil is blurred at quarter resolution
const WRITE_MS = 2600, TITLE_HOLD = 13000, TITLE_FADE = 7000, TITLE_REST = 1800, GHOST = .1
const RUN_TRAIL = 14000 // a run's clear trail lasts this long before fogging over
const BREATH_AFTER = 420 // ms of holding still before a press becomes a breath

export class HeroGlass {
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private scene = document.createElement('canvas')
  private sctx = this.scene.getContext('2d')!
  private veil = document.createElement('canvas')
  private vctx = this.veil.getContext('2d')!
  private mask = document.createElement('canvas')
  private mctx = this.mask.getContext('2d')!
  private title = document.createElement('canvas')
  private ghosts = document.createElement('canvas')
  private gctx = this.ghosts.getContext('2d')!
  private mist = document.createElement('canvas')
  // The hover smear: an eased brush leaves one continuous, soft trail, drawn at quarter resolution.
  private smear = document.createElement('canvas')
  private trail: { x: number; y: number; t: number }[] = []
  private aim: { x: number; y: number } | null = null
  private brush: { x: number; y: number } | null = null
  private grain: CanvasPattern | null = null
  private glass = new Path2D()
  private strokes: Stroke[] = []
  private runs: Run[] = []
  private beads: Bead[] = []
  private haze = { level: 0, x: 0, y: 0, r: 0 }
  private w = 1; private h = 1; private dpr = 1
  private cycle = 0 // when the current writing began
  private written = false
  private visible = true
  private raf = 0
  private last = performance.now()
  private pointer: { x: number; y: number; down: boolean; id: number; since: number; moved: boolean } | null = null
  private still = matchMedia('(prefers-reduced-motion: reduce)').matches
  private titleBox = { top: 0, bottom: 0, size: 0 }
  onFirstTouch: (() => void) | null = null

  constructor(private host: HTMLElement, private view: HeroView) {
    for (const [c, name] of [[this.scene, 'hero-view'], [this.canvas, 'hero-glass']] as const) { c.className = name; c.setAttribute('aria-hidden', 'true'); host.append(c) }
    new ResizeObserver(() => this.resize()).observe(host)
    new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; if (this.visible) this.loop() }, { threshold: .05 }).observe(host)
    host.addEventListener('pointermove', e => this.move(e))
    host.addEventListener('pointerdown', e => {
      if (e.button) return
      const { x, y } = this.local(e); this.pointer = { x, y, down: true, id: e.pointerId, since: performance.now(), moved: false }
      this.touched()
    })
    const up = (e: PointerEvent) => { if (this.pointer?.id === e.pointerId) this.pointer = { ...this.pointer, down: false } }
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up)
    host.addEventListener('pointerleave', () => { this.pointer = null; this.aim = null; this.brush = null; this.view.lookAt?.(0, 0) })
    host.addEventListener('contextmenu', e => e.preventDefault()) // a long press breathes; it does not open a menu
    this.resize(); this.cycle = performance.now() + 700
  }

  /** Show another view behind the same glass; writing, beads and ghosts stay where they are. */
  setView(view: HeroView) { this.view = view; view.resize(this.w, this.h, this.dpr) }

  private touched() { this.onFirstTouch?.(); this.onFirstTouch = null }
  private local(e: PointerEvent) { const box = this.host.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top } }

  private move(e: PointerEvent) {
    const { x, y } = this.local(e), now = performance.now()
    this.view.lookAt?.(x / this.w * 2 - 1, y / this.h * 2 - 1)
    if (!this.pointer || this.pointer.id !== e.pointerId) { this.pointer = { x, y, down: false, id: e.pointerId, since: now, moved: false }; return }
    const p = this.pointer, d = Math.hypot(x - p.x, y - p.y)
    if (d < 1.5) return
    // Dragging writes a narrow, clear line and leaves an oil ghost; a passing mouse leaves a faint,
    // broad smear that takes a few passes to clear, like the side of a hand brushing the glass.
    if (p.down) {
      if (!p.moved && d < 6 && now - p.since < BREATH_AFTER) return
      p.moved = true
      const r = e.pointerType === 'touch' ? 9 : 7
      this.strokes.push({ x, y, px: p.x, py: p.y, r, alpha: .95, born: now, hold: 6000, fade: 16000 })
      const g = this.gctx; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.globalAlpha = .9; g.lineCap = 'round'; g.strokeStyle = '#fff'; g.lineWidth = r * 1.4
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x, y); g.stroke()
      this.sweep(x, y, r + 2)
    } else if (e.pointerType === 'mouse') { this.aim = { x, y }; this.touched() }
    p.x = x; p.y = y
    if (this.strokes.length > 2400) this.strokes.splice(0, this.strokes.length - 2400)
  }

  /** A stroke picks up the beads it passes. */
  private sweep(x: number, y: number, r: number) { this.beads = this.beads.filter(b => Math.hypot(b.x - x, b.y - y) > r + b.r) }

  private resize() {
    const box = this.host.getBoundingClientRect()
    this.w = Math.max(1, box.width); this.h = Math.max(1, box.height); this.dpr = Math.min(1.5, devicePixelRatio)
    for (const c of [this.canvas, this.mask, this.title, this.scene, this.ghosts, this.mist]) { c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr) }
    for (const c of [this.canvas, this.scene]) { c.style.width = `${this.w}px`; c.style.height = `${this.h}px` }
    this.veil.width = this.smear.width = Math.ceil(this.w / VEIL); this.veil.height = this.smear.height = Math.ceil(this.h / VEIL)
    this.glass = new Path2D(); this.glass.rect(0, 0, this.w, this.h) // edge to edge; the page fades its top and bottom
    this.view.resize(this.w, this.h, this.dpr)
    this.beads = []; this.runs = this.runs.filter(r => r.title)
    this.paintTitle(); this.paintGrain()
  }

  /** The title as a clearing: soft-edged italic letters, the way a fingertip parts condensation. */
  private paintTitle() {
    const g = this.title.getContext('2d')!, s = this.dpr
    g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, this.w, this.h)
    const narrow = this.w < 560, size = Math.min(this.w * (narrow ? .25 : .17), this.h * .3)
    g.font = `italic 400 ${size}px Georgia, "Times New Roman", serif`; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'
    g.filter = `blur(${Math.max(1, size * .012)}px)`
    g.fillText('Natural', this.w * (narrow ? .04 : .1), this.h * .44)
    g.fillText('Effects', this.w * (narrow ? .16 : .33), this.h * .44 + size * .95)
    g.filter = 'none'
    this.titleBox = { top: this.h * .44 - size * .8, bottom: this.h * .44 + size * 1.05, size }
  }

  private paintGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 160
    const g = c.getContext('2d')!, img = g.createImageData(160, 160)
    for (let i = 0; i < img.data.length; i += 4) { const light = Math.random() > .5; img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 245 : 120; img.data[i + 3] = Math.random() * 10 }
    g.putImageData(img, 0, 0); this.grain = this.ctx.createPattern(c, 'repeat')
  }

  private loop = () => {
    cancelAnimationFrame(this.raf)
    if (!this.visible) return
    this.frame(performance.now())
    this.raf = requestAnimationFrame(this.loop)
  }

  private frame(now: number) {
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now
    const { ctx, w, h, dpr } = this

    // The view, crisp where the glass is clear; blurred and lightened at quarter resolution for the fog.
    this.view.draw(this.sctx, this.still ? 0 : now)
    const v = this.vctx, vw = this.veil.width, vh = this.veil.height
    v.setTransform(1, 0, 0, 1, 0, 0); v.clearRect(0, 0, vw, vh); v.filter = 'blur(5px)'
    v.drawImage(this.scene, -2, -2, vw + 4, vh + 4)
    v.filter = 'none'; v.fillStyle = this.view.veil; v.fillRect(0, 0, vw, vh)

    this.breathe(now, dt)
    if (!this.still) this.condense(now, dt)

    // The clearing mask: visitor strokes, the written title, and the runs of drops.
    const m = this.mctx
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, this.mask.width, this.mask.height); m.setTransform(dpr, 0, 0, dpr, 0, 0)
    m.lineCap = 'round'; m.lineJoin = 'round'; m.strokeStyle = '#fff'
    this.strokes = this.strokes.filter(s => now - s.born < s.hold + s.fade)
    for (const s of this.strokes) {
      const age = now - s.born, k = age < s.hold ? 1 : 1 - smooth((age - s.hold) / s.fade)
      m.globalAlpha = s.alpha * k; m.lineWidth = s.r * 2
      m.shadowColor = '#fff'; m.shadowBlur = s.r * .8
      m.beginPath(); m.moveTo(s.px, s.py); m.lineTo(s.x, s.y); m.stroke()
    }
    m.shadowBlur = 0; m.globalAlpha = 1; m.setTransform(1, 0, 0, 1, 0, 0)
    this.drawSmear(m, now, dt)
    this.drawTitle(m, now)
    this.drawRuns(m, now, dt)

    // Compose the fog inside the glass: veil and grain, a faint trace of old writing, the mask cut out.
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save(); ctx.clip(this.glass)
    ctx.drawImage(this.veil, 0, 0, w, h)
    if (this.grain) { ctx.fillStyle = this.grain; ctx.fillRect(0, 0, w, h) }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = .08; ctx.drawImage(this.ghosts, 0, 0)
    ctx.globalAlpha = .96; ctx.drawImage(this.mask, 0, 0)
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
    // Breath condenses evenly on clean glass but not on the oil of old writing, so ghosts stand out in it.
    if (this.haze.level > .01) {
      const g = this.mist.getContext('2d')!, { x, y, r, level } = this.haze
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, this.mist.width, this.mist.height)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Breath is the colour of this view's fog, a little denser.
      const tint = this.view.veil.replace(/rgba?\(([^,]+),([^,]+),([^,)]+).*/, '$1,$2,$3'), grad = g.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(${tint},${.8 * level})`); grad.addColorStop(.6, `rgba(${tint},${.55 * level})`); grad.addColorStop(1, `rgba(${tint},0)`)
      g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2)
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .85; g.drawImage(this.ghosts, 0, 0); g.globalAlpha = 1
      ctx.drawImage(this.mist, 0, 0)
    }
    ctx.restore()
    // Beads and the heads of runs catch the light.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const b of this.beads) this.bead(b.x, b.y, b.r, .75)
    for (const r of this.runs) if (r.age > 0 && r.age < r.life + .5) this.bead(r.x, r.y, 3.2, Math.min(1, (r.life + .5 - r.age) * 2) * .85)
    ctx.globalAlpha = 1
  }

  /**
   * A passing hand brushes the glass. The brush eases after the pointer, so even a jumpy mouse
   * leaves a smooth curve; the trail is stroked as continuous paths (no overlapping stamps to bead)
   * and blurred at quarter resolution, then fades: the newest part clearest, the oldest gone.
   */
  private drawSmear(m: CanvasRenderingContext2D, now: number, dt: number) {
    const HOLD = 1400, FADE = 6500, CLEAR = .34, STEPS = 24
    if (this.aim && !this.pointer?.down) {
      if (!this.brush) this.brush = { ...this.aim }
      const k = 1 - Math.exp(-dt * 12)
      this.brush.x += (this.aim.x - this.brush.x) * k; this.brush.y += (this.aim.y - this.brush.y) * k
      const last = this.trail[this.trail.length - 1]
      if (!last || Math.hypot(this.brush.x - last.x, this.brush.y - last.y) > 2.5) {
        this.trail.push({ x: this.brush.x, y: this.brush.y, t: now }); this.sweep(this.brush.x, this.brush.y, 14)
      }
    }
    while (this.trail.length && now - this.trail[0].t > HOLD + FADE) this.trail.shift()
    if (!this.trail.length) return
    const s = this.smear.getContext('2d')!
    s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, this.smear.width, this.smear.height)
    s.setTransform(1 / VEIL, 0, 0, 1 / VEIL, 0, 0); s.lineCap = 'round'; s.lineJoin = 'round'; s.strokeStyle = "#fff"; s.lineWidth = 40; s.filter = "blur(3.5px)"
    // Points of similar age share one path, so the trail fades in fine steps without seams.
    const level = (t: number) => { const age = now - t; return Math.round(STEPS * (age < HOLD ? 1 : 1 - smooth((age - HOLD) / FADE))) }
    let run: number[] = [], current = -1
    const flush = () => { if (run.length >= 4 && current > 0) { s.globalAlpha = CLEAR * current / STEPS; s.beginPath(); s.moveTo(run[0], run[1]); for (let i = 2; i < run.length; i += 2) s.lineTo(run[i], run[i + 1]); s.stroke() } }
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i], prev = this.trail[i - 1], step = level(p.t)
      const broken = !prev || p.t - prev.t > 400 || Math.hypot(p.x - prev.x, p.y - prev.y) > 90
      if (step !== current || broken) { flush(); run = broken ? [] : [prev.x, prev.y]; current = step }
      run.push(p.x, p.y)
    }
    flush(); s.filter = 'none'; s.globalAlpha = 1
    m.setTransform(1, 0, 0, 1, 0, 0); m.imageSmoothingQuality = 'high'; m.drawImage(this.smear, 0, 0, this.mask.width, this.mask.height)
  }

  private bead(x: number, y: number, r: number, alpha: number) {
    const c = this.ctx; c.globalAlpha = alpha
    const g = c.createRadialGradient(x - r * .25, y - r * .3, 0, x, y, r * 1.1)
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.45, 'rgba(226,232,228,.35)'); g.addColorStop(.85, 'rgba(48,56,54,.28)'); g.addColorStop(1, 'rgba(48,56,54,0)')
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.1, 0, Math.PI * 2); c.fill()
  }

  /** Holding still breathes on the glass: a haze grows there and fogs over what was cleared. */
  private breathe(now: number, dt: number) {
    const p = this.pointer, holding = !!p && p.down && !p.moved && now - p.since > BREATH_AFTER
    if (holding) {
      if (this.haze.level < .02) { this.haze.x = p.x; this.haze.y = p.y; this.haze.r = 40 }
      this.haze.level = Math.min(1, this.haze.level + dt * 1.6); this.haze.r = Math.min(Math.min(this.w, this.h) * .38, this.haze.r + dt * 180)
      for (const s of this.strokes) { const reach = 1 - Math.hypot(s.x - this.haze.x, s.y - this.haze.y) / this.haze.r; if (reach > 0) s.born -= dt * 1000 * reach * (s.hold + s.fade) / 1.6 }
      for (const p of this.trail) { const reach = 1 - Math.hypot(p.x - this.haze.x, p.y - this.haze.y) / this.haze.r; if (reach > 0) p.t -= dt * 1000 * reach * 5 }
    } else this.haze.level = Math.max(0, this.haze.level - dt * .35)
  }

  /** Beads gather slowly; the heaviest run, clearing a trail and picking up the beads below. */
  private condense(now: number, dt: number) {
    const c = this.view.condensation ?? { rate: 6, run: .2 }, area = this.w * this.h / 1e6
    const size = c.size ?? 1
    if (this.beads.length < area * 260 && Math.random() < c.rate * area * dt) this.beads.push({ x: Math.random() * this.w, y: Math.random() * this.h * .96, r: (.8 + Math.random() * 1.6) * size, grow: .03 + Math.random() * .12 })
    for (let i = this.beads.length - 1; i >= 0; i--) {
      const b = this.beads[i]; b.r = Math.min(4.6 * size, b.r + b.grow * dt)
      if (b.r > 3.6 * Math.max(1, size * .8) && Math.random() < dt * c.run && this.runs.length < 40) { this.beads.splice(i, 1); this.runs.push({ x: b.x, y: b.y, points: [b.x, b.y], speed: 26 + Math.random() * 40, age: 0, life: 1.4 + Math.random() * 3, phase: Math.random() * 6, born: now, title: false }) }
    }
  }

  /** Write the title left to right, hold it, let the fog close over it to a ghost, then write again. */
  private drawTitle(m: CanvasRenderingContext2D, now: number): void {
    const t = now - this.cycle
    if (t < 0) { m.globalAlpha = this.written ? GHOST : 0; if (this.written) m.drawImage(this.title, 0, 0); m.globalAlpha = 1; return }
    const total = WRITE_MS + TITLE_HOLD + TITLE_FADE + TITLE_REST
    if (t > total) { this.cycle = now; return this.drawTitle(m, now) }
    const writing = this.still ? 1 : Math.min(1, t / WRITE_MS)
    const fading = t > WRITE_MS + TITLE_HOLD ? smooth((t - WRITE_MS - TITLE_HOLD) / TITLE_FADE) : 0
    const alpha = Math.max(this.written ? GHOST : 0, .94 * (1 - fading) + GHOST * fading)
    if (writing >= 1) { this.written = true; if (!this.still && t < WRITE_MS + 200) this.spawnTitleRuns(now) }
    // The ghost of the previous writing stays under the fresh stroke.
    if (this.written && writing < 1) { m.globalAlpha = GHOST; m.drawImage(this.title, 0, 0) }
    // Reveal behind a soft edge sweeping right, one line after the other. The edge leans with the
    // italic and is feathered in steps, so it reads as a fingertip moving, not a straight wipe.
    const W = this.mask.width, H = this.mask.height, split = this.titleBox.bottom * this.dpr - this.titleBox.size * this.dpr * .9
    const reveal = (from: number, to: number, progress: number) => {
      if (progress <= 0) return
      const edge = W * Math.min(1.15, progress * 1.15), lean = (to - from) * .22, feather = 46 * this.dpr
      const band = (start: number, end: number, a: number) => {
        m.save(); m.beginPath(); m.moveTo(start + lean, from); m.lineTo(end + lean, from); m.lineTo(end, to); m.lineTo(start, to); m.closePath(); m.clip()
        m.globalAlpha = a; m.drawImage(this.title, 0, 0); m.restore()
      }
      band(-lean, edge, alpha)
      if (progress < 1) { band(edge, edge + feather, alpha * .45); band(edge + feather, edge + feather * 2, alpha * .15) }
    }
    reveal(0, split, Math.min(1, writing * 1.9))
    reveal(split, H, Math.max(0, writing * 1.9 - .9))
    m.globalAlpha = 1
    if (fading >= 1) this.runs = this.runs.filter(r => !r.title)
  }

  private spawnTitleRuns(now: number) {
    if (this.runs.some(r => r.title)) return
    const { top, bottom } = this.titleBox
    for (let i = 0; i < 6; i++) {
      const x = this.w * (.14 + Math.random() * .62), y = top + (bottom - top) * (.35 + Math.random() * .6)
      this.runs.push({ x, y, points: [x, y], speed: 18 + Math.random() * 30, age: -Math.random() * 2.5, life: 1.5 + Math.random() * 3, phase: Math.random() * 6, born: now, title: true })
    }
  }

  /** Runs surge and stall down the glass; each clears a thin trail that fogs over again later. */
  private drawRuns(m: CanvasRenderingContext2D, now: number, dt: number) {
    m.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); m.strokeStyle = '#fff'; m.lineCap = 'round'; m.lineJoin = 'round'
    this.runs = this.runs.filter(r => r.title || now - r.born < RUN_TRAIL + r.life * 1000)
    for (const r of this.runs) {
      r.age += dt
      if (r.age > 0 && r.age < r.life) {
        r.y += r.speed * (.3 + .7 * Math.max(0, Math.sin(r.age * 2.3 + r.phase))) * dt; r.x += Math.sin(r.age * 1.6 + r.phase) * 3 * dt
        const n = r.points.length; if (Math.hypot(r.x - r.points[n - 2], r.y - r.points[n - 1]) > 3) { r.points.push(r.x, r.y); this.sweep(r.x, r.y, 3) }
      }
      if (r.age <= 0) continue
      // Title runs last as long as the title; a bead's run fogs over after a while.
      m.globalAlpha = r.title ? .8 : .8 * (1 - smooth((now - r.born - r.life * 1000 - RUN_TRAIL * .4) / (RUN_TRAIL * .6)))
      m.lineWidth = r.title ? 3.2 : 2.6; m.beginPath(); m.moveTo(r.points[0], r.points[1])
      for (let i = 2; i < r.points.length; i += 2) m.lineTo(r.points[i], r.points[i + 1])
      m.lineTo(r.x, r.y + .01); m.stroke()
    }
    m.globalAlpha = 1; m.setTransform(1, 0, 0, 1, 0, 0)
  }
}

function smooth(x: number) { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }
