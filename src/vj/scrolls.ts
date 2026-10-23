/// <reference types="vite/client" />
import { ART_SKETCHES } from './artSketches'
import { MOTIFS } from './motifSketches'
import type { Mood } from './storylines'
import { strokesOf } from './drawings'

/**
 * Scrolls composed by the drawing agent (see docs/DRAWING-AGENT.md and the sand-compose skill):
 * scenes of 200 × 100 units side by side, each a ground line, placed library pieces and the
 * agent's own strokes, in the order the fingertip should draw them.
 */
export type Placed = { id: string; x: number; y: number; h: number; mirror?: boolean }
export type Scene = { episode: string; mood: Mood; caption?: string; ground?: { kind?: string; d: string }; place?: Placed[]; draw?: { d: string; what?: string }[]; strokeOrder?: string[] }
export type Scroll = { id: string; story: string; title?: string; scenes: Scene[] }

export const SCENE_W = 200, SCENE_H = 100
export const SCROLLS: Scroll[] = Object.values(import.meta.glob<Scroll>('./scrolls/*.json', { eager: true, import: 'default' }))

const PIECES = new Map<string, { d: string; sand: string; ground?: false }>([...ART_SKETCHES, ...MOTIFS].map(p => [p.id, p]))

function bbox(d: string) {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]) }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

type Element = { d: string; transform?: string; scale: number; at: (x: number, y: number) => [number, number] }
const same = (x: number, y: number): [number, number] => [x, y]

/** A scene's elements in drawing order: path data plus the transform that puts it in place (same rule as scripts/scroll-lib.mjs). */
export function sceneElements(scene: Scene): Element[] {
  const all = new Map<string, Element>()
  if (scene.ground) all.set('ground', { d: scene.ground.d, scale: 1, at: same })
  scene.place?.forEach((p, i) => {
    const piece = PIECES.get(p.id); if (!piece) return
    const d = piece.sand || piece.d, b = bbox(d), s = p.h / b.h, ay = piece.ground === false ? b.y : b.y + b.h, cx = b.x + b.w / 2, flip = p.mirror ? -1 : 1
    all.set(`place:${i}`, { d, scale: s, transform: `translate(${p.x} ${p.y}) scale(${flip * s} ${s}) translate(${-cx} ${-ay})`, at: (x, y) => [p.x + flip * s * (x - cx), p.y + s * (y - ay)] })
  })
  scene.draw?.forEach((p, i) => all.set(`draw:${i}`, { d: p.d, scale: 1, at: same }))
  const order = (scene.strokeOrder ?? []).filter(k => all.has(k))
  return [...order, ...[...all.keys()].filter(k => !order.includes(k))].map(k => all.get(k)!)
}

/** A scene as strokes of points in scene coordinates (200 × 100), in drawing order, about `step` apart. */
export function sceneStrokes(scene: Scene, step = 1.2): [number, number][][] {
  return sceneElements(scene).flatMap(el => strokesOf(el.d, step / el.scale).map(s => s.map(([x, y]) => el.at(x, y))))
}
