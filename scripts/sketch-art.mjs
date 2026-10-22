// Turn photographs of artworks into line sketches for the sand: crop to the subject, soften, find
// edges, link edge pixels into continuous strokes, keep the strongest, simplify, and write SVG path
// data in a 100 × 100 box to src/vj/artSketches.ts (plus a credits list).
//   node scripts/sketch-art.mjs scripts/art-sources [only-id]   (sources: sketch-art.json, credits: src/vj/ART-CREDITS.md)
// Preview them drawing themselves with the dev server at /?mode=sketches (not part of the public build).
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'

const [dir, only] = process.argv.slice(2)
const ARTS = JSON.parse(readFileSync(new URL('./sketch-art.json', import.meta.url), 'utf8'))

/** Grey pixels of the cropped, softened image, `height` tall. */
function pixels(art) {
  const [x0, y0, x1, y1] = art.crop ?? [0, 0, 1, 1], H = art.height ?? 320
  const filter = `crop=iw*${x1 - x0}:ih*${y1 - y0}:iw*${x0}:ih*${y0},scale=-2:${H},format=gray,gblur=sigma=${art.blur ?? 1.6},edgedetect=low=${art.low ?? .08}:high=${art.high ?? .2}`
  const probe = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', `${dir}/${art.id}.jpg`, '-vf', filter, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 })
  const size = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', `${dir}/${art.id}.jpg`, '-vf', filter, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 1 << 26 })
  const w = size.readUInt32BE(16), h = size.readUInt32BE(20)
  return { w, h, edge: Uint8Array.from(probe.subarray(0, w * h), v => v > 20 ? 1 : 0) } // edge strength is grey, not white
}

/** Walk edge pixels into chains, preferring to keep going straight. */
function chains({ w, h, edge }) {
  const seen = new Uint8Array(w * h), out = []
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && edge[y * w + x] && !seen[y * w + x]
  const around = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
  const degree = (x, y) => around.reduce((n, [dx, dy]) => n + (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && edge[(y + dy) * w + x + dx] ? 1 : 0), 0)
  const walk = (sx, sy) => {
    const chain = [[sx, sy]]; seen[sy * w + sx] = 1
    let x = sx, y = sy, dir = -1
    for (;;) {
      let next = -1, best = -Infinity
      for (let k = 0; k < 8; k++) { const [dx, dy] = around[k]; if (!at(x + dx, y + dy)) continue; const score = dir < 0 ? 0 : -Math.min(Math.abs(k - dir), 8 - Math.abs(k - dir)); if (score > best) { best = score; next = k } }
      if (next < 0) break
      x += around[next][0]; y += around[next][1]; dir = next; seen[y * w + x] = 1; chain.push([x, y])
    }
    return chain
  }
  // Ends first, so open lines are walked from one end; then whatever loops remain.
  for (const pass of [0, 1]) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!edge[y * w + x] || seen[y * w + x] || (pass === 0 && degree(x, y) > 1)) continue
    out.push(walk(x, y))
  }
  return out
}

/** Ramer–Douglas–Peucker simplification. */
function simplify(points, epsilon) {
  if (points.length < 3) return points
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1], len = Math.hypot(bx - ax, by - ay) || 1
  let far = 0, index = 0
  for (let i = 1; i < points.length - 1; i++) { const d = Math.abs((by - ay) * points[i][0] - (bx - ax) * points[i][1] + bx * ay - by * ax) / len; if (d > far) { far = d; index = i } }
  if (far <= epsilon) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)]
}
/** Chaikin corner cutting: a pixel polyline becomes a flowing, pencil-like curve. */
function smoothen(points, rounds = 2) {
  let p = points
  for (let r = 0; r < rounds && p.length > 2; r++) {
    const next = [p[0]]
    for (let i = 0; i < p.length - 1; i++) { const [ax, ay] = p[i], [bx, by] = p[i + 1]; next.push([ax * .75 + bx * .25, ay * .75 + by * .25], [ax * .25 + bx * .75, ay * .25 + by * .75]) }
    next.push(p.at(-1)); p = next
  }
  return p
}
const lengthOf = c => c.reduce((s, p, i) => i ? s + Math.hypot(p[0] - c[i - 1][0], p[1] - c[i - 1][1]) : 0, 0)

/** Join chains whose ends nearly meet, so a contour broken by the edge detector reads as one stroke. */
function join(list, gap) {
  const result = [...list]
  for (let merged = true; merged;) {
    merged = false
    outer: for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
      const a = result[i], b = result[j], ends = [[a.at(-1), b[0], () => [...a, ...b]], [a.at(-1), b.at(-1), () => [...a, ...b.slice().reverse()]], [a[0], b.at(-1), () => [...b, ...a]], [a[0], b[0], () => [...a.slice().reverse(), ...b]]]
      for (const [p, q, combine] of ends) if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= gap) { result[i] = combine(); result.splice(j, 1); merged = true; break outer }
    }
  }
  return result
}

/**
 * The subject's silhouette as one continuous closed line: soften the crop heavily, separate subject
 * from background by brightness (art.sil = 'light' or 'dark' subject, art.threshold optional, else
 * Otsu; art.silMix is an optional colour filter for subjects told apart by colour, not brightness), keep the region around the centre, and trace its outer boundary.
 */
function silhouette(art) {
  const [x0, y0, x1, y1] = art.crop ?? [0, 0, 1, 1], H = art.height ?? 320
  const filter = `crop=iw*${x1 - x0}:ih*${y1 - y0}:iw*${x0}:ih*${y0},scale=-2:${H},${art.silMix ? art.silMix + ',' : ''}format=gray,gblur=sigma=${art.silBlur ?? 4}`
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', `${dir}/${art.id}.jpg`, '-vf', filter, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 })
  const png = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', `${dir}/${art.id}.jpg`, '-vf', filter, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 1 << 26 })
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20), g = raw.subarray(0, w * h)
  // Otsu's threshold, unless the work names one.
  let t = art.threshold
  if (t === undefined) {
    const hist = new Array(256).fill(0); for (const v of g) hist[v]++
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]
    let wB = 0, sB = 0, best = 0; t = 128
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB || wB === g.length) continue; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / (g.length - wB), between = wB * (g.length - wB) * (mB - mF) ** 2; if (between > best) { best = between; t = i } }
  }
  const light = (art.sil ?? 'light') === 'light', on = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) on[i] = (light ? g[i] > t : g[i] < t) ? 1 : 0
  if (process.env.MASKS) { writeFileSync(`${process.env.MASKS}/${art.id}.pgm`, Buffer.concat([Buffer.from(`P5 ${w} ${h} 255\n`), Buffer.from(on.map(v => v * 255))])); console.log(art.id, "threshold", t) }
  // The subject is the region holding the most of the central third.
  const label = new Int32Array(w * h).fill(-1), score = []
  for (let i = 0; i < w * h; i++) {
    if (!on[i] || label[i] >= 0) continue
    const id = score.length, stack = [i]; label[i] = id; let central = 0
    while (stack.length) { const j = stack.pop(), x = j % w, y = (j / w) | 0; if (x > w / 3 && x < w * 2 / 3 && y > h / 3 && y < h * 2 / 3) central++
      for (const k of [j - 1, j + 1, j - w, j + w]) if (k >= 0 && k < w * h && Math.abs((k % w) - x) <= 1 && on[k] && label[k] < 0) { label[k] = id; stack.push(k) } }
    score.push(central)
  }
  const subject = score.indexOf(Math.max(...score)); if (subject < 0) return null
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === subject
  // Holes in the subject (art.holes, largest first) are outlined too: the space inside Matisse's
  // ring of dancers is as much the picture as the dancers are.
  const holes = [], seen = new Int32Array(w * h).fill(-1)
  for (let i = 0; i < w * h && (art.holes ?? 0) > 0; i++) {
    if (inside(i % w, (i / w) | 0) || seen[i] >= 0) continue
    const id = i, stack = [i], cells = []; seen[i] = id; let edge = false
    while (stack.length) { const j = stack.pop(), x = j % w, y = (j / w) | 0; cells.push(j); if (!x || !y || x === w - 1 || y === h - 1) edge = true
      for (const k of [j - 1, j + 1, j - w, j + w]) if (k >= 0 && k < w * h && Math.abs((k % w) - x) <= 1 && seen[k] < 0 && !inside(k % w, (k / w) | 0)) { seen[k] = id; stack.push(k) } }
    if (!edge && cells.length > w * h * .01) holes.push({ id, size: cells.length, start: Math.min(...cells) })
  }
  holes.sort((p, q) => q.size - p.size)
  let start = -1; for (let i = 0; i < w * h && start < 0; i++) if (label[i] === subject) start = i
  return { w, h, points: outline(inside, w, h, start), holes: holes.slice(0, art.holes ?? 0).map(q => outline((x, y) => x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x] === q.id, w, h, q.start)) }
}

/** Moore-neighbour boundary tracing of a region from its topmost-leftmost cell, softened into one closed line. */
function outline(inside, w, h, start) {
  // Moore-neighbour boundary tracing from the topmost-leftmost subject pixel.
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], contour = []
  let x = start % w, y = (start / w) | 0, d = 6
  for (let n = 0; n < w * h * 4; n++) {
    contour.push([x, y]); let moved = false
    for (let k = 0; k < 8; k++) { const dd = (d + 6 + k) % 8, nx = x + dirs[dd][0], ny = y + dirs[dd][1]; if (inside(nx, ny)) { x = nx; y = ny; d = dd; moved = true; break } }
    if (!moved || (x === start % w && y === ((start / w) | 0) && contour.length > 8)) break
  }
  // Soften the pixel staircase: a moving average, then simplify and round.
  const k = 4, soft = contour.map((_, i) => { let sx = 0, sy = 0; for (let j = -k; j <= k; j++) { const p = contour[(i + j + contour.length) % contour.length]; sx += p[0]; sy += p[1] } return [sx / (2 * k + 1), sy / (2 * k + 1)] })
  // Simplify the open loop, then close it: a closed polyline has no chord for Douglas–Peucker to measure from.
  const open = simplify(soft, 1.2)
  return smoothen([...open, open[0]])
}

/**
 * Works whose photographs give no readable line (the Starry Night is all brushwork) are drawn by
 * hand instead, from their essential motifs, in the same 100 × 100 box.
 */
const path = pts => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')
const spiral = (cx, cy, r0, r1, turns, a0 = 0, squash = 1) => Array.from({ length: Math.ceil(turns * 28) + 1 }, (_, i) => { const t = i / (turns * 28), a = a0 + t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash] })
const curve = (pts, n = 24) => {
  // A smooth line through the given points (Catmull–Rom).
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))) }
  }
  out.push(pts.at(-1)); return out
}
const HAND = {
  /** The sea as Greek painters drew it: a running scroll of waves, each curling over into a spiral. */
  sea() {
    const lines = []
    for (let i = 0; i < 4; i++) {
      const x = 4 + i * 24
      lines.push([...curve([[x, 66], [x + 8, 60], [x + 15, 46], [x + 20, 30]]), ...spiral(x + 11, 37, 9.5, 2, 1.2, -.25).slice(1)])
    }
    lines.push(curve([[2, 70], [30, 68], [55, 71], [80, 68], [98, 70]]), curve([[10, 78], [40, 76], [70, 79], [94, 77]]))
    return lines.map(path).join(' ')
  },
  /** Auspicious clouds (xiangyun): three curls on one soft body, trailing a tail. */
  clouds() {
    const lines = [
      [...curve([[2, 70], [12, 62], [20, 64], [24, 56]]), ...spiral(33, 48, 12, 2.5, 1.35, Math.PI * .95).slice(1)],
      spiral(56, 36, 13, 2.5, 1.35, Math.PI * .9), spiral(79, 48, 12, 2.5, 1.35, Math.PI * 1.05),
      curve([[22, 62], [40, 66], [56, 58], [70, 64], [88, 60], [98, 50]]),
    ]
    return lines.map(path).join(' ')
  },
  /** Mountains as in a Chinese landscape: three peaks, soft ridges, a few texture strokes. */
  peaks() {
    const lines = [
      curve([[2, 84], [12, 64], [20, 46], [28, 30], [33, 24], [38, 34], [44, 52], [50, 60], [58, 40], [64, 18], [70, 12], [75, 22], [80, 44], [88, 62], [98, 84]]),
      curve([[28, 34], [26, 48], [30, 62]]), curve([[66, 22], [62, 40], [66, 56], [62, 70]]), curve([[72, 30], [76, 48], [74, 62]]),
      curve([[14, 88], [30, 76], [44, 80], [56, 70], [72, 78], [90, 88]]),
    ]
    return lines.map(path).join(' ')
  },
  /** A pine leaning out from a rock, its needles in flat layered clusters. */
  pine() {
    const lines = [curve([[46, 96], [48, 80], [44, 62], [50, 44], [46, 26]]), curve([[54, 96], [55, 80], [52, 62], [57, 44], [52, 26]])]
    for (const [y, w, x] of [[22, 15, 49], [36, 22, 52], [52, 27, 48], [68, 30, 53]]) lines.push(curve([[x - w, y + 3], [x - w * .5, y - 4], [x, y - 2], [x + w * .5, y - 5], [x + w, y + 2], [x, y + 4], [x - w, y + 3]]))
    lines.push(curve([[30, 97], [50, 92], [72, 97]]))
    return lines.map(path).join(' ')
  },
  /** An olive tree of Ithaca: a twisted trunk and a round, open crown. */
  olive() {
    const crown = Array.from({ length: 72 }, (_, i) => { const a = i / 71 * Math.PI * 2, r = 30 + Math.sin(a * 5) * 3 + Math.sin(a * 3 + 1) * 2; return [50 + Math.cos(a) * r, 36 + Math.sin(a) * r * .72] })
    const lines = [crown, curve([[44, 96], [46, 80], [40, 66], [46, 54], [42, 46]]), curve([[56, 96], [54, 80], [60, 66], [54, 54], [58, 46]]), curve([[46, 60], [36, 50], [30, 44]]), curve([[54, 58], [66, 48], [72, 42]])]
    return lines.map(path).join(' ')
  },
  /** A crescent moon. */
  moon() {
    // The outer circle where the inner one does not cover it, then back along the inner circle's edge.
    const outer = [], inner = [], A = [50, 50, 32], B = [64, 40, 27], inB = ([x, y]) => Math.hypot(x - B[0], y - B[1]) < B[2], inA = ([x, y]) => Math.hypot(x - A[0], y - A[1]) < A[2]
    for (let i = 0; i <= 360; i++) { const a = (i / 360 + .2) * Math.PI * 2, p = [A[0] + Math.cos(a) * A[2], A[1] + Math.sin(a) * A[2]]; if (!inB(p)) outer.push(p) }
    for (let i = 0; i <= 360; i++) { const a = (i / 360 + .2) * Math.PI * 2, p = [B[0] + Math.cos(a) * B[2], B[1] + Math.sin(a) * B[2]]; if (inA(p)) inner.push(p) }
    // Rotate each arc so it runs unbroken (the sampling may start in its middle).
    const run = arc => { let k = 1; while (k < arc.length && Math.hypot(arc[k][0] - arc[k - 1][0], arc[k][1] - arc[k - 1][1]) < 3) k++; return k < arc.length ? [...arc.slice(k), ...arc.slice(0, k)] : arc }
    const o = run(outer), n = run(inner), back = Math.hypot(o.at(-1)[0] - n[0][0], o.at(-1)[1] - n[0][1]) < Math.hypot(o.at(-1)[0] - n.at(-1)[0], o.at(-1)[1] - n.at(-1)[1]) ? n : n.reverse()
    return path([...o, ...back, o[0]])
  },
  /** The sun, with short rays. */
  sun() { return [spiral(50, 50, 18, 18, 1), ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [[50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26], [50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36]] })].map(path).join(' ') },
  starry() {
    const wave = (x0, x1, y, amp, waves, phase = 0, tilt = 0) => Array.from({ length: 60 }, (_, i) => { const t = i / 59, x = x0 + (x1 - x0) * t; return [x, y + tilt * t + Math.sin(t * waves * Math.PI * 2 + phase) * amp] })
    const flame = []
    // The cypress: a tall flame, its edges flickering, rising from the left foreground.
    for (let i = 0; i <= 40; i++) { const t = i / 40, y = 96 - t * 82, w = 7.5 * (1 - t) ** .8 + .4; flame.push([16 + Math.sin(t * 19) * 1.4 * (1 - t) + (t > .9 ? (t - .9) * 20 : 0) - w, y]) }
    for (let i = 40; i >= 0; i--) { const t = i / 40, y = 96 - t * 82, w = 7.5 * (1 - t) ** .8 + .4; flame.push([16 + Math.sin(t * 17 + 1) * 1.6 * (1 - t) + (t > .9 ? (t - .9) * 20 : 0) + w, y]) }
    const lines = [
      // The great swirl across the sky, curling into two eddies.
      [...wave(4, 34, 36, 2.5, 1.2, 0, -4), ...spiral(44, 31, 9, 1.5, 1.6, Math.PI, .85).map(([x, y]) => [x, y])],
      [...spiral(60, 34, 1.5, 7, 1.4, 0, .8), ...wave(67, 98, 34, 2.2, 1.4, 1.4, 4)],
      flame,
      // The crescent moon in its halo.
      spiral(86, 14, 9.5, 9.5, 1), [...spiral(86, 14, 5.5, 5.5, .62, -2.1), ...spiral(84, 12.5, 4.2, 4.2, .62, -2.1 + 1.95 * Math.PI * .62).reverse()],
      // The stars, each a little eddy of light.
      ...[[30, 10, 4], [52, 9, 3.4], [68, 17, 3], [22, 24, 2.8], [76, 44, 3.4], [94, 46, 2.6], [37, 50, 2.4]].map(([x, y, r]) => spiral(x, y, r * .25, r, 1.7)),
      // Hills, then the village beneath them with its church spire.
      wave(26, 100, 60, 2.6, 1.6, .8, 6), wave(30, 100, 70, 1.8, 2.2, 2, 3),
      [[40, 84], [43, 80], [46, 84], [50, 84], [53, 79.5], [56, 84], [58, 84], [61, 52], [64, 84], [68, 84], [71, 80], [74, 84], [79, 84], [82, 79], [86, 84], [92, 84], [95, 80.5], [98, 84]],
      [[44, 90], [56, 90]], [[66, 90], [80, 90]], [[84, 90], [96, 90]],
    ]
    return lines.map(path).join(' ')
  },
}

const sketches = [], motifs = [], credits = []
// Motifs (art.set = "motif") are the pieces a scroll is composed from: figures, creatures, ships and
// scenery for the storylines, tagged with their story, their role and which way they face.
const entry = (art, d, sand) => art.set === 'motif'
  ? motifs.push({ id: art.id, name: art.name, after: art.after, d, sand, story: art.story ?? ['any'], role: art.role ?? 'scenery', ...(art.faces ? { faces: art.faces } : {}), ...(art.ground === false ? { ground: false } : {}) })
  : sketches.push({ id: art.id, name: art.name, after: art.after, d, sand, ...(art.full ? { full: true } : {}) })
for (const art of ARTS) {
  if (only && art.id !== only) continue
  if (art.hand) {
    const d = HAND[art.hand]()
    entry(art, d, d)
    credits.push(art.source ? `- ${art.name} (${art.after}): drawn by hand from the work's motifs, after ${art.source}, ${art.license}.` : `- ${art.name}: drawn by hand.`)
    continue
  }
  const image = pixels(art)
  let lines = join(chains(image).filter(c => c.length >= 4), art.gap ?? 4).filter(c => lengthOf(c) >= (art.min ?? 18))
  lines.sort((a, b) => lengthOf(b) - lengthOf(a))
  // Keep the strongest strokes until the budget of line is spent: a sketch, not a tracing.
  const budget = (art.budget ?? 2600) * Math.max(image.w, image.h) / 100
  let used = 0; lines = lines.filter(c => (used += lengthOf(c)) <= budget)
  const scale = 100 / Math.max(image.w, image.h), ox = (100 - image.w * scale) / 2, oy = (100 - image.h * scale) / 2
  const d = lines.map(c => smoothen(simplify(c, art.epsilon ?? 1.1))).filter(c => c.length > 1)
    .map(c => 'M' + c.map(([x, y]) => `${(ox + x * scale).toFixed(1)} ${(oy + y * scale).toFixed(1)}`).join(' L')).join(' ')
  // The cut for the sand: the silhouette as one line, then the longest inner lines that do not
  // retrace it (a line mostly within 3% of the outline is the outline again).
  const sil = art.sil === "none" ? null : silhouette(art); if (process.env.DEBUG && sil) { const xs = sil.points.map(p => p[0]), ys = sil.points.map(p => p[1]); console.log(art.id, "sil points", sil.points.length, "x", Math.round(Math.min(...xs)), "-", Math.round(Math.max(...xs)), "y", Math.round(Math.min(...ys)), "-", Math.round(Math.max(...ys)), "of", image.w, "x", image.h) }
  const toBox = ([x, y]) => `${(ox + x * scale).toFixed(1)} ${(oy + y * scale).toFixed(1)}`
  let sand = ''
  if (sil) {
    const near = (p) => sil.points.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.max(image.w, image.h) * .03)
    const inner = lines.filter(c => c.filter(near).length < c.length * .5).slice(0, art.inner ?? 6).map(c => smoothen(simplify(c, art.epsilon ?? 1.1)))
    sand = ['M' + sil.points.map(toBox).join(' L'), ...sil.holes.map(h => 'M' + h.map(toBox).join(' L')), ...inner.map(c => 'M' + c.map(toBox).join(' L'))].join(' ')
  } else sand = lines.slice(0, art.inner ?? 12).map(c => "M" + smoothen(simplify(c, art.epsilon ?? 1.1)).map(toBox).join(" L")).join(" ") // line drawings: their strongest lines
  entry(art, d, sand)
  credits.push(`- ${art.name} (${art.after}): ${art.source}, ${art.license}${art.author ? `, photo by ${art.author}` : ''}.`)
  console.log(`${art.id}: ${lines.length} strokes, ${Math.round(used * scale)} units of line, ${d.length} characters`)
}
if (!only) {
  writeFileSync(new URL('../src/vj/artSketches.ts', import.meta.url), `// Generated by scripts/sketch-art.mjs from photographs of the works; see ART-CREDITS.md.\nexport const ART_SKETCHES: { id: string; name: string; after: string; d: string; sand: string; full?: boolean }[] = ${JSON.stringify(sketches, null, 1)}\n`)
  writeFileSync(new URL('../src/vj/motifSketches.ts', import.meta.url), `// Generated by scripts/sketch-art.mjs (entries with set: "motif"); see ART-CREDITS.md.
/** Pieces a scroll is composed from, for the storylines: figures, creatures, ships and scenery. */
export type Motif = { id: string; name: string; after: string; d: string; sand: string; story: string[]; role: string; faces?: 'left' | 'right'; ground?: false }
export const MOTIFS: Motif[] = ${JSON.stringify(motifs, null, 1)}
`)
  writeFileSync(new URL('../src/vj/ART-CREDITS.md', import.meta.url), `# Art sketch sources\n\nLine sketches traced automatically from these images on Wikimedia Commons. The works are in the public domain; photographs under CC BY-SA are credited, and sketches derived from them are shared under the same licence.\n\n${credits.join('\n')}\n`)
} else console.log((sketches[0] ?? motifs[0]).d.slice(0, 300))
