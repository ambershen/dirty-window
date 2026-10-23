#!/usr/bin/env node
// The drawing agent's eyes: renders a scene, a whole scroll, or library pieces to PNG, and checks
// the rules that can be measured (ground continuity, one figure scale, pieces that exist).
//   node scripts/render-scene.mjs scroll.json [--scene 3] [--out file.png] [--paper]
//   node scripts/render-scene.mjs --piece sirens,ship [--out file.png]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { library, sceneSvg, bbox, SCENE_W } from './scroll-lib.mjs'

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1] }
const pieces = library()
mkdirSync('.scratch', { recursive: true })

let scenes, out = opt('--out')
if (opt('--piece')) {
  // Each piece alone on a square, side by side, at its native box.
  scenes = opt('--piece').split(',').map(id => {
    const piece = pieces.get(id), b = piece ? bbox(piece.sand || piece.d) : { w: 1, h: 1 }, h = Math.min(85, 180 * b.h / b.w)
    return { place: [{ id, x: 100, y: piece?.ground === false ? 10 : 95, h }], episode: id }
  })
  out ??= `.scratch/piece-${opt('--piece').replace(/,/g, '_')}.png`
} else {
  const file = args.find(a => a.endsWith('.json'))
  if (!file) { console.error('usage: render-scene.mjs <scene|scroll>.json [--scene n] | --piece id[,id]'); process.exit(1) }
  const data = JSON.parse(readFileSync(file, 'utf8'))
  scenes = data.scenes ?? [data]
  if (opt('--scene') !== undefined) scenes = [scenes[Number(opt('--scene'))]]
  out ??= `.scratch/${file.split('/').pop().replace(/\.json$/, '')}${opt('--scene') !== undefined ? `-${opt('--scene')}` : ''}.png`
}

const { svg, errors } = sceneSvg(scenes, pieces, { width: scenes.length > 3 ? 600 : 1000, sand: !args.includes('--paper') })
writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng())
console.log(`wrote ${out}`)

// Measurable rules.
const warn = [...errors]
const ends = d => { const n = d.match(/-?\d+(\.\d+)?/g).map(Number); return { x0: n[0], y0: n[1], x1: n[n.length - 2], y1: n[n.length - 1] } }
let prevEnd
scenes.forEach((s, i) => {
  if (s.ground?.d) {
    const e = ends(s.ground.d)
    if (Math.abs(e.x0) > 1 || Math.abs(e.x1 - SCENE_W) > 1) warn.push(`scene ${i}: ground should run x 0 → ${SCENE_W} (runs ${e.x0} → ${e.x1})`)
    if (prevEnd !== undefined && Math.abs(prevEnd - e.y0) > 1.5) warn.push(`scene ${i}: ground starts at y ${e.y0}, previous scene ended at y ${prevEnd}`)
    prevEnd = e.y1
  } else if (!args.includes('--piece')) warn.push(`scene ${i}: no ground line`)
  for (const p of s.place || []) {
    const piece = pieces.get(p.id); if (!piece) continue
    const b = bbox(piece.sand || piece.d), w = b.w * p.h / b.h
    if (p.x - w / 2 < -2 || p.x + w / 2 > SCENE_W + 2) warn.push(`scene ${i}: ${p.id} crosses the scene edge`)
  }
})
const figures = scenes.flatMap(s => (s.place || []).filter(p => pieces.get(p.id)?.role === 'character').map(p => p.h))
if (figures.length > 1 && Math.max(...figures) / Math.min(...figures) > 1.35) warn.push(`figure heights vary ${Math.min(...figures)}–${Math.max(...figures)}: keep one scale (±15%)`)
console.log(warn.length ? warn.map(w => `! ${w}`).join('\n') : 'checks ok')
