/**
 * Touchable specimens: each effect card's window answers the pointer in its own material's way,
 * over the recorded demo. Water rings out, ice cracks if you linger, steam is wiped, sand is
 * furrowed, snow takes prints. Marks fade on each material's own time.
 */
type Kind = 'water' | 'ice' | 'steam' | 'sand' | 'snow'
type Mark = { x: number; y: number; px: number; py: number; born: number; seed: number }

const LIFE: Record<Kind, number> = { water: 1700, ice: 9000, steam: 6000, sand: 7000, snow: 9000 }

export function specimen(media: HTMLElement, kind: Kind) {
  const canvas = document.createElement('canvas'), g = canvas.getContext('2d')!
  canvas.className = 'specimen-touch'; canvas.setAttribute('aria-hidden', 'true'); media.append(canvas)
  let w = 1, h = 1, dpr = 1, raf = 0, last: { x: number; y: number; t: number } | null = null, still = 0
  const marks: Mark[] = [], cracks: { points: number[]; born: number }[] = []
  // Steam keeps its own fog layer that the pointer wipes and that slowly closes again.
  const fog = document.createElement('canvas'), f = fog.getContext('2d')!
  const size = () => {
    const box = media.getBoundingClientRect(); w = box.width; h = box.height; dpr = Math.min(2, devicePixelRatio)
    for (const c of [canvas, fog]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    if (kind === 'steam') { f.setTransform(dpr, 0, 0, dpr, 0, 0); f.fillStyle = 'rgb(226,231,228)'; f.fillRect(0, 0, w, h) }
  }
  new ResizeObserver(size).observe(media); size()

  const wake = () => { if (!raf) raf = requestAnimationFrame(frame) }
  media.addEventListener('pointermove', e => {
    const box = media.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top, now = performance.now()
    if (last && Math.hypot(x - last.x, y - last.y) < (kind === 'water' ? 18 : kind === 'snow' ? 26 : 2)) { if (kind === 'ice') { still += now - last.t; last.t = now; if (still > 380) grow(x, y, now) } wake(); return }
    still = 0
    marks.push({ x, y, px: last?.x ?? x, py: last?.y ?? y, born: now, seed: Math.random() })
    if (kind === 'steam') { f.globalCompositeOperation = 'destination-out'; f.lineCap = 'round'; f.lineWidth = 26; f.shadowColor = '#000'; f.shadowBlur = 10; f.beginPath(); f.moveTo(last?.x ?? x, last?.y ?? y); f.lineTo(x, y); f.stroke(); f.shadowBlur = 0; f.globalCompositeOperation = 'source-over' }
    last = { x, y, t: now }; wake()
  })
  media.addEventListener('pointerleave', () => { last = null; still = 0 })

  /** Ice: holding still grows a fine fracture outward in short, branching segments. */
  function grow(x: number, y: number, now: number) {
    let crack = cracks.find(c => Math.hypot(c.points[0] - x, c.points[1] - y) < 8 && now - c.born < 4000)
    if (!crack) { crack = { points: [x, y], born: now }; cracks.push(crack) }
    if (crack.points.length > 80) return
    const n = crack.points.length, px = crack.points[n - 2], py = crack.points[n - 1], angle = Math.atan2(py - y, px - x) + (Math.random() - .5) * 1.6 + (n < 4 ? Math.random() * 6.3 : 0)
    crack.points.push(px + Math.cos(angle) * (5 + Math.random() * 7), py + Math.sin(angle) * (5 + Math.random() * 7))
  }

  function frame(now: number) {
    raf = 0
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const life = LIFE[kind]
    for (let i = marks.length - 1; i >= 0; i--) if (now - marks[i].born > life) marks.splice(i, 1)
    for (let i = cracks.length - 1; i >= 0; i--) if (now - cracks[i].born > life) cracks.splice(i, 1)
    let busy = marks.length > 0 || cracks.length > 0
    for (const m of marks) {
      const age = (now - m.born) / life, k = 1 - age
      if (kind === 'water') {
        // Two light rings spread and thin, like a fingertip on still water.
        for (const lag of [0, .18]) {
          const a = Math.max(0, age - lag); if (a <= 0) continue
          g.strokeStyle = `rgba(214,240,238,${.5 * (1 - a) ** 2})`; g.lineWidth = 1.4 * (1 - a) + .3
          g.beginPath(); g.ellipse(m.x, m.y, 6 + a * 70, (6 + a * 70) * .62, 0, 0, Math.PI * 2); g.stroke()
        }
      } else if (kind === 'sand') {
        // A furrow: shaded floor, lit rim on the far side.
        g.lineCap = 'round'
        g.strokeStyle = `rgba(92,62,30,${.42 * k})`; g.lineWidth = 7; g.beginPath(); g.moveTo(m.px, m.py); g.lineTo(m.x, m.y); g.stroke()
        g.strokeStyle = `rgba(255,236,200,${.38 * k})`; g.lineWidth = 2.4; g.beginPath(); g.moveTo(m.px + 1.5, m.py - 4); g.lineTo(m.x + 1.5, m.y - 4); g.stroke()
      } else if (kind === 'snow') {
        // A soft print: cool shade inside, a bright crumb rim around it.
        const r = 9 + m.seed * 3, shade = g.createRadialGradient(m.x, m.y + 1, 0, m.x, m.y, r)
        shade.addColorStop(0, `rgba(120,140,158,${.32 * k})`); shade.addColorStop(.75, `rgba(150,168,182,${.18 * k})`); shade.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = shade; g.beginPath(); g.ellipse(m.x, m.y, r, r * .8, 0, 0, Math.PI * 2); g.fill()
        g.strokeStyle = `rgba(255,255,255,${.7 * k})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(m.x, m.y - .6, r * 1.05, r * .85, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke()
      }
    }
    if (kind === 'ice') for (const c of cracks) {
      const k = 1 - (now - c.born) / life
      g.lineJoin = 'round'
      for (const [color, width, dy] of [[`rgba(38,56,60,${.55 * k})`, 1.6, .8], [`rgba(255,255,252,${.95 * k})`, .8, -.4]] as const) {
        g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(c.points[0], c.points[1] + dy)
        for (let i = 2; i < c.points.length; i += 2) g.lineTo(c.points[i], c.points[i + 1] + dy)
        g.stroke()
      }
    }
    if (kind === 'steam') {
      // The fog closes again slowly over what was wiped.
      f.globalCompositeOperation = 'source-over'; f.fillStyle = 'rgba(226,231,228,.012)'; f.fillRect(0, 0, w, h)
      // The layer recovers toward opaque and is shown at 82%, so it always returns to the same density.
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .82; g.drawImage(fog, 0, 0); g.globalAlpha = 1; busy = true
    }
    if (busy && media.matches(':hover, :focus-within') || marks.length || cracks.length) raf = requestAnimationFrame(frame)
  }
  frame(performance.now())
}
