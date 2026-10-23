#!/usr/bin/env node
// Glue for the scroll: the strokes around the famous works that keep every scene full and carry the
// picture across scene edges: borders that run under the ground, arches, columns, clouds, birds,
// hills, islands and ripples. Each scene names its kit (scene.glue = "gallery" | "sea" | "land");
// the glue is fitted around the scene's anchor work and written into scene.draw as "glue:*" strokes,
// replacing any glue from an earlier run, so it can be re-run after the agent moves things.
//   node scripts/glue.mjs src/vj/scrolls/body-1.json [--scene i]
import { readFileSync, writeFileSync } from 'node:fs'
import { library, placedPoints, SCENE_W } from './scroll-lib.mjs'

const f = n => +n.toFixed(1), path = pts => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')
const arc = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] })
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280) }

// The pieces of glue, in scene coordinates (y down).
const G = {
  /** A battlement key border between two rules, x 0 → 200 so it joins the next scene's. */
  key: y => { const pts = []; for (let x = 0; x < SCENE_W; x += 10) pts.push([x, y + 5], [x, y], [x + 5, y], [x + 5, y + 5]); pts.push([SCENE_W, y + 5]); return [path([[0, y - 2], [SCENE_W, y - 2]]), path(pts), path([[0, y + 7], [SCENE_W, y + 7]])] },
  /** The running wave scroll of Greek borders, x 0 → 200. */
  waves: y => { const pts = []; for (let x = 0; x < SCENE_W; x += 12.5) pts.push([x, y + 5], [x + 3, y + 4.2], [x + 6, y + 2], [x + 8, y], [x + 10, y + .4], [x + 11, y + 2], [x + 10, y + 3.4], [x + 8.6, y + 3.4], [x + 8.2, y + 2.4], [x + 9.6, y + 4.6]); pts.push([SCENE_W, y + 5]); return [path(pts)] },
  arch: (cx, w, top, base) => { const r = w / 2, spring = top + r; return [path([[cx - r, base], [cx - r, spring], ...arc(cx, spring, r, Math.PI, Math.PI * 2, 16), [cx + r, base]]), path([[cx - r - 3, spring], [cx - r + 3, spring]]), path([[cx + r - 3, spring], [cx + r + 3, spring]])] },
  column: (x, top, base) => [path([[x - 2.5, base], [x - 2.5, top + 3], [x - 4, top + 3], [x - 4, top], [x + 4, top], [x + 4, top + 3], [x + 2.5, top + 3], [x + 2.5, base]])],
  cloud: (cx, cy, w) => { const a = w / 6, b = w / 4.5; return [path([[cx - w / 2, cy], ...arc(cx - w / 2 + a, cy, a, Math.PI, Math.PI * 1.9, 6), ...arc(cx, cy - a * .4, b, Math.PI * 1.15, Math.PI * 1.85, 8), ...arc(cx + w / 2 - a, cy, a, Math.PI * 1.1, Math.PI * 2, 6), [cx + w / 2 - a * .6, cy + a * .25], ...arc(cx + w / 2 - a * 1.1, cy - a * .1, a * .4, 0, Math.PI * 1.4, 6)])] },
  birds: (cx, cy, n, r) => Array.from({ length: n }, (_, i) => { const x = cx + (r() - .5) * 26, y = cy + (r() - .5) * 10, s = 2 + r() * 1.5; return path([[x - s, y - s * .5], [x, y], [x + s, y - s * .5]]) }),
  hill: (x0, x1, y, h) => [path(Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * h] }))],
  island: (cx, y, w, h) => [path([[cx - w / 2, y], [cx - w / 4, y - h * .7], [cx - w / 10, y - h], [cx + w / 8, y - h * .8], [cx + w / 3, y - h * .3], [cx + w / 2, y]])],
  ripple: (x, y) => [path([[x, y], [x + 3, y - 2], [x + 6, y - 1.5], [x + 7, y + .5], [x + 5, y + 1]])],
  tuft: (x, y) => [path([[x - 2, y], [x - 3, y - 4]]), path([[x, y], [x, y - 5]]), path([[x + 2, y], [x + 3, y - 4]])],
  sun: (cx, cy, r) => [path(arc(cx, cy, r, 0, Math.PI * 2, 20)), ...Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return path([[cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4], [cx + Math.cos(a) * r * 1.9, cy + Math.sin(a) * r * 1.9]]) })],
}

/** The ground's y at x (the ground line is M/L points). */
const groundAt = (scene, x) => { const p = scene.ground ? scene.ground.d.match(/-?\d+(\.\d+)?/g).map(Number) : [0, 84, 200, 84]; for (let i = 0; i + 3 < p.length; i += 2) if (x >= p[i] && x <= p[i + 2]) return p[i + 1] + (p[i + 3] - p[i + 1]) * (x - p[i]) / (p[i + 2] - p[i] || 1); return p[p.length - 1] }

/** Fit a kit around the scene's anchor (its largest placed piece). */
function dress(scene, i, pieces) {
  const r = rng(i + 7), out = []
  const boxes = (scene.place || []).map(p => { const pts = placedPoints(pieces.get(p.id), p), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } })
  const a = boxes.sort((p, q) => (q.x1 - q.x0) * (q.y1 - q.y0) - (p.x1 - p.x0) * (p.y1 - p.y0))[0] ?? { x0: 90, x1: 110, y0: 40, y1: 80 }
  const L = [6, a.x0 - 6], R = [a.x1 + 6, SCENE_W - 6], free = ([x0, x1]) => x1 - x0, mid = ([x0, x1]) => (x0 + x1) / 2
  const g = (what, strokes) => strokes.forEach(d => out.push({ what: `glue:${what}`, d }))
  const base = Math.max(groundAt(scene, 0), groundAt(scene, SCENE_W))
  if (scene.glue === 'gallery') {
    const floor = groundAt(scene, 100)
    if (a.x1 - a.x0 < 120 && !(scene.draw || []).some(d => d.what === 'frame')) g('arch', G.arch(100, Math.min(150, a.x1 - a.x0 + 26), Math.max(6, a.y0 - 8), floor - 0.5))
    g('column', G.column(8, 14, groundAt(scene, 8))); g('column', G.column(192, 14, groundAt(scene, 192)))
  } else if (scene.glue === 'sea') {
    for (const side of [L, R]) {
      if (free(side) < 18) continue
      const cx = mid(side), w = Math.min(34, free(side) - 4)
      g('cloud', G.cloud(cx, 14 + r() * 10, w))
      if (free(side) > 26 && r() > .3) g('birds', G.birds(cx, 40 + r() * 8, 3, r))
      const gy = groundAt(scene, cx); if (free(side) > 30 && gy >= base - .5) g('island', G.island(cx + (r() - .5) * 8, gy - 1.5, Math.min(26, w), 4 + r() * 3))
    }
  } else if (scene.glue === 'land') {
    for (const side of [L, R]) {
      if (free(side) < 18) continue
      const cx = mid(side)
      g('hill', G.hill(side[0], side[1], groundAt(scene, cx) - .5, Math.min(14, free(side) * .25)))
      g('cloud', G.cloud(cx, 16 + r() * 8, Math.min(30, free(side) - 4)))
      for (let k = 0; k < 2; k++) { const x = side[0] + 4 + r() * (free(side) - 8); g('tuft', G.tuft(x, groundAt(scene, x))) }
    }
  }
  // A low, wide work leaves the sky above it empty: a sun and a cloud there.
  if ((scene.glue === 'sea' || scene.glue === 'land') && a.y0 > 36) { g('sun', G.sun(Math.min(a.x1 - 15, 180), 20, 6)); g('cloud', G.cloud(Math.max(a.x0 + 25, 30), 18, 30)) }
  // One border under the ground, at one height for every scene, so it runs on across scene edges.
  // A scroll keeps one border throughout (scene.border overrides the kit's).
  const border = scene.border ?? { gallery: 'key', sea: 'waves', land: 'key' }[scene.glue]
  if (border === 'key') g('key border', G.key(91)); else if (border === 'waves') g('wave border', G.waves(91))
  return out
}

/** Empty quarters: columns of the scene with no ink above the ground except the ground itself. */
export function emptyQuarters(scene, pieces) {
  const pts = [...(scene.place || []).flatMap(p => pieces.get(p.id) ? placedPoints(pieces.get(p.id), p) : []), ...(scene.draw || []).flatMap(d => (d.d.match(/-?\d+(\.\d+)?/g) || []).map(Number).reduce((a, v, i, n) => (i % 2 ? a : [...a, [v, n[i + 1]]]), []))]
  return [0, 1, 2, 3].filter(q => !pts.some(([x, y]) => x >= q * 50 && x < q * 50 + 50 && y < groundAt(scene, x) - 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), file = args.find(a => a.endsWith('.json')), only = args.includes('--scene') ? Number(args[args.indexOf('--scene') + 1]) : undefined
  const scroll = JSON.parse(readFileSync(file, 'utf8')), pieces = library()
  scroll.scenes.forEach((scene, i) => {
    if (only !== undefined && i !== only) return
    const keep = (scene.draw || []).map((d, k) => [d, k]).filter(([d]) => !d.what?.startsWith('glue:'))
    const remap = new Map(keep.map(([, k], n) => [`draw:${k}`, `draw:${n}`]))
    const order = (scene.strokeOrder || []).filter(k => !k.startsWith('draw:') || remap.has(k)).map(k => remap.get(k) ?? k)
    const glue = scene.glue ? dress(scene, i, pieces) : []
    scene.draw = [...keep.map(([d]) => d), ...glue]
    // Glue is drawn after the ground and the anchor: the work first, then the world around it.
    scene.strokeOrder = [...order, ...glue.map((_, n) => `draw:${keep.length + n}`)]
    const empty = emptyQuarters(scene, pieces)
    console.log(`scene ${i} (${scene.episode}): ${glue.length} glue strokes${empty.length ? `  ! empty quarters: ${empty.join(',')}` : ''}`)
  })
  writeFileSync(file, JSON.stringify(scroll, null, 1) + '\n')
}
