// Shared by the drawing agent's tools (catalog.mjs, render-scene.mjs): the sketch library read
// straight from the generated TS files, and a scene laid out as SVG in scroll coordinates.
import { readFileSync, existsSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const readArray = file => { const s = readFileSync(new URL(file, root), 'utf8'); return JSON.parse(s.slice(s.indexOf('= [') + 2).trim().replace(/;?\s*$/, '')) }

/** Every piece the agent can place, by id: motifs first, then the famous works (role "artwork"). */
export function library() {
  const pieces = new Map()
  for (const a of readArray('src/vj/artSketches.ts')) pieces.set(a.id, { ...a, story: [], role: 'artwork' })
  for (const m of readArray('src/vj/motifSketches.ts')) pieces.set(m.id, m)
  const tags = new URL('src/vj/motifCatalog.json', root)
  if (existsSync(tags)) for (const t of JSON.parse(readFileSync(tags, 'utf8'))) if (pieces.has(t.id)) Object.assign(pieces.get(t.id), { tags: t })
  return pieces
}

/** Bounding box of M/L path data. */
export function bbox(d) {
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]) }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export const SCENE_W = 200, SCENE_H = 100

/**
 * A placed piece as an SVG transform. The piece's box is scaled to height `h`; its bottom centre
 * lands at (x, y) in scene coordinates (its top centre for pieces with ground: false, so skies hang).
 */
export function placement(piece, p) {
  const b = bbox(piece.sand || piece.d), s = p.h / b.h, cx = b.x + b.w / 2, ay = piece.ground === false ? b.y : b.y + b.h
  const flip = p.mirror ? -1 : 1
  return { transform: `translate(${p.x} ${p.y}) scale(${flip * s} ${s}) translate(${-cx} ${-ay})`, scale: s }
}

/** A placed piece's points in scene coordinates (same rule as placement()). */
export function placedPoints(piece, p) {
  const d = piece.sand || piece.d, b = bbox(d), s = p.h / b.h, cx = b.x + b.w / 2, ay = piece.ground === false ? b.y : b.y + b.h, flip = p.mirror ? -1 : 1
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number), pts = []
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([p.x + flip * s * (n[i] - cx), p.y + s * (n[i + 1] - ay)])
  return pts
}
export const pointsOf = d => { const n = d.match(/-?\d+(\.\d+)?/g).map(Number), pts = []; for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]); return pts }

/** One scene, or a whole scroll of scenes side by side, as an SVG string. */
export function sceneSvg(scenes, pieces, { width = 1600, sand = true } = {}) {
  const list = Array.isArray(scenes) ? scenes : [scenes]
  const W = SCENE_W * list.length, stroke = sand ? '#5c4226' : '#2a2620', bg = sand ? '#e7cf9f' : '#fbfaf6'
  const errors = []
  const body = list.map((scene, i) => {
    const parts = []
    for (const g of scene.ground ? [scene.ground] : []) parts.push(`<path d="${g.d}" stroke-width="1"/>`)
    for (const p of scene.place || []) {
      const piece = pieces.get(p.id)
      if (!piece) { errors.push(`scene ${i}: unknown piece "${p.id}"`); continue }
      const { transform, scale } = placement(piece, p)
      parts.push(`<path d="${process.env.FULL ? piece.d : piece.sand || piece.d}" transform="${transform}" stroke-width="${(1 / scale).toFixed(3)}"/>`)
    }
    for (const d of scene.draw || []) parts.push(`<path d="${d.d ?? d}" stroke-width="1"/>`)
    const label = scene.episode ? `<text x="3" y="7" font-size="4" fill="${stroke}" stroke="none" opacity=".55" font-family="Georgia">${i + 1}. ${scene.episode} · ${scene.mood || ''}</text>` : ''
    return `<g transform="translate(${SCENE_W * i} 0)"><rect width="${SCENE_W}" height="${SCENE_H}" fill="none" stroke="${stroke}" stroke-opacity=".12" stroke-width=".3" stroke-dasharray="2 2"/>${parts.join('')}${label}</g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${SCENE_H}" width="${width * list.length}" height="${width * SCENE_H / SCENE_W}"><rect width="${W}" height="${SCENE_H}" fill="${bg}"/><g fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
  return { svg, errors }
}
