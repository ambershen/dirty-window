#!/usr/bin/env node
// The drawing agent's view of the library: one line per piece, never the path data.
//   node scripts/catalog.mjs [story]
import { library, bbox } from './scroll-lib.mjs'

const story = process.argv[2]
for (const p of library().values()) {
  if (story && !p.story.includes(story) && !p.story.includes('any') && p.role !== 'artwork') continue
  const b = bbox(p.sand || p.d), t = p.tags || {}
  const bits = [p.id.padEnd(12), p.role.padEnd(9), `aspect ${(b.w / b.h).toFixed(2)}`, p.faces ? `faces ${p.faces}` : '', p.ground === false ? 'hangs' : '', p.story.join('/'), t.quality ? `q${t.quality}` : '', t.depicts || p.name]
  console.log(bits.filter(Boolean).join('  '))
}
