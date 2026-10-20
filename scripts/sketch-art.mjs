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

const sketches = [], credits = []
for (const art of ARTS) {
  if (only && art.id !== only) continue
  const image = pixels(art)
  let lines = join(chains(image).filter(c => c.length >= 4), art.gap ?? 4).filter(c => lengthOf(c) >= (art.min ?? 18))
  lines.sort((a, b) => lengthOf(b) - lengthOf(a))
  // Keep the strongest strokes until the budget of line is spent: a sketch, not a tracing.
  const budget = (art.budget ?? 2600) * Math.max(image.w, image.h) / 100
  let used = 0; lines = lines.filter(c => (used += lengthOf(c)) <= budget)
  const scale = 100 / Math.max(image.w, image.h), ox = (100 - image.w * scale) / 2, oy = (100 - image.h * scale) / 2
  const d = lines.map(c => smoothen(simplify(c, art.epsilon ?? 1.1))).filter(c => c.length > 1)
    .map(c => 'M' + c.map(([x, y]) => `${(ox + x * scale).toFixed(1)} ${(oy + y * scale).toFixed(1)}`).join(' L')).join(' ')
  sketches.push({ id: art.id, name: art.name, after: art.after, d })
  credits.push(`- ${art.name} (${art.after}): ${art.source}, ${art.license}${art.author ? `, photo by ${art.author}` : ''}.`)
  console.log(`${art.id}: ${lines.length} strokes, ${Math.round(used * scale)} units of line, ${d.length} characters`)
}
if (!only) {
  writeFileSync(new URL('../src/vj/artSketches.ts', import.meta.url), `// Generated by scripts/sketch-art.mjs from photographs of the works; see ART-CREDITS.md.\nexport const ART_SKETCHES: { id: string; name: string; after: string; d: string }[] = ${JSON.stringify(sketches, null, 1)}\n`)
  writeFileSync(new URL('../src/vj/ART-CREDITS.md', import.meta.url), `# Art sketch sources\n\nLine sketches traced automatically from these images on Wikimedia Commons. The works are in the public domain; photographs under CC BY-SA are credited, and sketches derived from them are shared under the same licence.\n\n${credits.join('\n')}\n`)
} else console.log(sketches[0].d.slice(0, 300))
