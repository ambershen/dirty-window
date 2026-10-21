/**
 * Buildings for the sand, pressed in piece by piece like sandcastle forms. Each is made fresh from
 * a few rules (a castle's towers, a temple's columns, a pagoda's tiers…), with its proportions,
 * counts and ornaments drawn at random, so no two are quite alike.
 *
 * A piece is a shape in a unit box (y down, the ground at 1) and how deep it presses (1 shallow …
 * 3 deep); details (doors, windows) are cut later, on the snares, and only show where they press
 * deeper than the piece around them.
 */
export type Shape = 'rect' | 'arch' | 'pointed' | 'tri' | 'taper' | 'roof' | 'dome' | 'disc'
export type Level = 1 | 2 | 3
export type Piece = [Shape, number, number, number, number, Level, boolean?]
export type Building = { name: string; aspect: number; pieces: Piece[] }

const between = (a: number, b: number) => a + Math.random() * (b - a)
const int = (a: number, b: number) => Math.floor(between(a, b + 1))
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const D = true
/** n positions for pieces of width w, spread evenly from x0 to x1. */
const spread = (n: number, x0: number, x1: number, w: number) => Array.from({ length: n }, (_, i) => x0 + (x1 - x0 - w) * (n > 1 ? i / (n - 1) : .5))
/** n pieces of width w spread evenly from x0 to x1. */
const row = (n: number, x0: number, x1: number, w: number, make: (x: number, i: number) => Piece): Piece[] => spread(n, x0, x1, w).map(make)
/** A crenellated top: merlons along y from x0 to x1. */
const merlons = (x0: number, x1: number, y: number, h: number, level: Level): Piece[] => {
  const n = Math.max(2, Math.round((x1 - x0) / (h * 1.6))), w = (x1 - x0) / (n * 2 - 1)
  return row(n, x0, x1, w, x => ['rect', x, y - h, x + w, y, level])
}

const MAKERS: (() => Building)[] = [
  function castle() {
    const towers = int(2, 4), tw = between(.13, .2), wall = between(.4, .56), roofs = pick(['crenel', 'cone', 'mixed'])
    const pieces: Piece[] = [['rect', tw / 2, wall, 1 - tw / 2, 1, 1]]
    pieces.push(...merlons(tw, 1 - tw, wall, .05, 1))
    spread(towers, 0, 1, tw).forEach((x, i) => {
      const top = between(.14, wall - .12) + (towers > 2 && i > 0 && i < towers - 1 ? -.06 : 0), cone = roofs === 'cone' || (roofs === 'mixed' && i % 2 === 1)
      pieces.push(['rect', x, top, x + tw, 1, 2])
      if (cone) pieces.push(['tri', x - tw * .12, Math.max(0, top - tw * 1.3), x + tw * 1.12, top, 2])
      else pieces.push(...merlons(x, x + tw, top, .045, 2))
      pieces.push(['arch', x + tw * .35, top + .08, x + tw * .65, top + .2, 3, D])
      if (1 - top > .55) pieces.push(['arch', x + tw * .35, top + .3, x + tw * .65, top + .42, 3, D])
    })
    const gate = between(.12, .18)
    pieces.push(['arch', .5 - gate / 2, 1 - gate * 2.1, .5 + gate / 2, 1, 3, D])
    if (Math.random() < .5) pieces.push(['rect', .5 - gate * .7, 1 - gate * 2.4, .5 + gate * .7, 1 - gate * 2.1, 3, D])
    return { name: 'a castle', aspect: between(1.15, 1.6), pieces }
  },
  function temple() {
    const columns = pick([4, 6, 6, 8]), steps = int(2, 4), round = Math.random() < .25
    const pieces: Piece[] = [], stepH = .05
    for (let i = 0; i < steps; i++) pieces.push(['rect', i * .035, 1 - stepH * (i + 1), 1 - i * .035, 1 - stepH * i, (i % 2 + 1) as Level])
    const floor = 1 - stepH * steps, top = round ? .42 : between(.3, .38), cw = .7 / (columns * 1.6)
    pieces.push(...row(columns, .1, .9, cw, x => ['rect', x, top + .04, x + cw, floor, 2]))
    pieces.push(...row(columns, .1, .9, cw, x => ['rect', x - cw * .2, top, x + cw * 1.2, top + .04, 1]))
    pieces.push(['rect', .05, top - .09, .95, top, 1], ['rect', .05, top - .12, .95, top - .09, 2])
    if (round) pieces.push(['dome', .14, .02, .86, top - .12, 1], ['disc', .46, .12, .54, .2, 3, D])
    else pieces.push(['tri', .03, top - .12 - between(.13, .22), .97, top - .12, 1], ['tri', .2, top - .12 - .11, .8, top - .14, 3, D])
    pieces.push(...row(columns, .1, .9, cw, x => ['rect', x + cw * .35, top + .07, x + cw * .65, floor - .03, 3, D]))
    return { name: round ? 'a tholos' : 'a temple', aspect: between(1.1, 1.5), pieces }
  },
  function ziggurat() {
    const tiers = int(3, 6), smooth = Math.random() < .35, pieces: Piece[] = []
    if (smooth) {
      pieces.push(['tri', 0, 0, 1, 1, 1], ['tri', .3, .3, .7, .7, 2])
      const courses = int(4, 7)
      for (let i = 1; i <= courses; i++) { const y = i / (courses + 1), half = y * .5; pieces.push(['rect', .5 - half + .02, y - .006, .5 + half - .02, y + .006, 3, D]) }
      pieces.push(['arch', .46, .84, .54, 1, 3, D])
      return { name: 'a pyramid', aspect: between(1.4, 1.8), pieces }
    }
    for (let i = 0; i < tiers; i++) { const inset = i * (.42 / tiers), h = 1 / tiers; pieces.push(['rect', inset, 1 - h * (i + 1), 1 - inset, 1 - h * i, (i % 2 + 1) as Level]) }
    for (let i = 0; i < tiers * 2; i++) pieces.push(['rect', .45, 1 - (i + 1) / (tiers * 2) + .015, .55, 1 - i / (tiers * 2) - .015, 3, D])
    return { name: 'a ziggurat', aspect: between(1.3, 1.7), pieces }
  },
  function arcade() {
    const tiers = int(1, 3), pieces: Piece[] = []
    for (let t = 0; t < tiers; t++) {
      const y0 = .1 + t * (.9 / tiers), y1 = .1 + (t + 1) * (.9 / tiers), n = int(4, 6) + t * 2 - (tiers - 1), w = .9 / (n * 1.35)
      pieces.push(['rect', 0, y0, 1, y1, (t % 2 + 1) as Level])
      pieces.push(...row(n, .04, .96, w, x => ['arch', x, y0 + (y1 - y0) * .18, x + w, y1, 3, D]))
    }
    pieces.push(['rect', 0, 0, 1, .1, 1], ...merlons(0, 1, .02, .02, 1))
    return { name: tiers > 1 ? 'a colosseum' : 'an aqueduct', aspect: between(1.6, 2.2), pieces }
  },
  function pagoda() {
    const tiers = int(3, 5), pieces: Piece[] = [], spire = .14, h = (1 - spire) / tiers
    for (let i = 0; i < tiers; i++) {
      const y1 = 1 - h * i, body = .32 - i * (.14 / tiers), eave = body + .14
      pieces.push(['rect', .5 - body, y1 - h * .55, .5 + body, y1, 2])
      pieces.push(['roof', .5 - eave, y1 - h, .5 + eave, y1 - h * .55, 1])
      pieces.push(['arch', .47, y1 - h * .5, .53, y1 - h * .05, 3, D])
    }
    pieces.push(['rect', .485, 0, .515, spire + .02, 2], ...row(3, .45, .55, .1, (x, i) => ['disc', x, .03 + i * .035, x + .1, .06 + i * .035, 3, D]))
    return { name: 'a pagoda', aspect: between(.6, .8), pieces }
  },
  function domed() {
    const minarets = pick([0, 2, 2, 4]), pieces: Piece[] = [], inner = minarets ? .14 : 0
    pieces.push(['rect', inner, .55, 1 - inner, 1, 1], ['rect', inner + .16, .42, 1 - inner - .16, .55, 2], ['dome', inner + .14, .1, 1 - inner - .14, .43, 1], ['rect', .49, .02, .51, .11, 2])
    for (const mx of minarets === 4 ? [0, .07, .87, .94] : minarets ? [0, .94] : [])
      pieces.push(['rect', mx, .14, mx + .06, 1, 2], ['dome', mx - .005, .08, mx + .065, .15, 2], ['tri', mx + .02, .02, mx + .04, .08, 2], ['rect', mx - .01, .4, mx + .07, .43, 1])
    pieces.push(['pointed', .44, .68, .56, 1, 3, D], ...row(4, inner + .06, 1 - inner - .06, .06, x => ['pointed', x, .66, x + .06, .86, 3, D]), ...row(3, .38, .62, .04, x => ['arch', x, .45, x + .04, .53, 3, D]))
    return { name: minarets ? 'a mosque' : 'a domed hall', aspect: between(1.2, 1.6), pieces }
  },
  function lighthouse() {
    const pieces: Piece[] = [['taper', .3, .3, .7, .92, 1], ['rect', .22, .24, .78, .3, 2], ['rect', .34, .1, .66, .24, 2], ['dome', .32, 0, .68, .1, 1], ['rect', 0, .92, 1, 1, 2]]
    if (Math.random() < .6) pieces.push(['rect', .62, .72, .98, .92, 1], ['tri', .6, .6, 1, .72, 2])
    const bands = int(2, 4)
    for (let i = 1; i <= bands; i++) { const y = .3 + i * (.62 / (bands + 1)); const half = .2 * (.6 + .4 * (y - .3) / .62); pieces.push(['rect', .5 - half + .02, y - .02, .5 + half - .02, y + .02, 3, D]) }
    pieces.push(['rect', .4, .13, .6, .21, 3, D], ['arch', .45, .8, .55, .92, 3, D])
    return { name: 'a lighthouse', aspect: between(.55, .75), pieces }
  },
  function cathedral() {
    const pieces: Piece[] = [], tw = .22, spires = Math.random() < .6
    pieces.push(['rect', tw, .35, 1 - tw, 1, 1], ['tri', tw, .18, 1 - tw, .36, 1])
    for (const x of [0, 1 - tw]) {
      pieces.push(['rect', x, .2, x + tw, 1, 2])
      if (spires) pieces.push(['tri', x + .02, 0, x + tw - .02, .2, 2]); else pieces.push(...merlons(x, x + tw, .2, .04, 2))
      pieces.push(['pointed', x + .07, .3, x + tw - .07, .5, 3, D], ['pointed', x + .07, .58, x + tw - .07, .78, 3, D])
    }
    pieces.push(['disc', .4, .4, .6, .55, 3, D], ['pointed', .41, .68, .59, 1, 3, D], ['pointed', tw + .04, .76, tw + .12, 1, 3, D], ['pointed', 1 - tw - .12, .76, 1 - tw - .04, 1, 3, D])
    return { name: 'a cathedral', aspect: between(.85, 1.1), pieces }
  },
  function stones() {
    const n = int(3, 5), pieces: Piece[] = [], w = 1 / (n * 1.25)
    spread(n, 0, 1, w).forEach((x, i) => {
      const top = between(.12, .3), post = w * .34
      pieces.push(['rect', x, top + .1, x + post, 1, (i % 2 + 1) as Level], ['rect', x + w - post, top + .1 + between(-.03, .03), x + w, 1, (i % 2 + 1) as Level])
      if (Math.random() < .8) pieces.push(['rect', x - .01, top, x + w + .01, top + .1, 2])
    })
    // Sometimes a fallen stone lies in front.
    if (Math.random() < .6) { const x = between(.1, .7); pieces.push(['rect', x, .91, x + .2, .98, 1]) }
    return { name: 'a stone circle', aspect: between(1.7, 2.2), pieces }
  },
  function pyramids() {
    const pieces: Piece[] = [], n = int(2, 3)
    const sizes = [1, between(.7, .85), between(.45, .6)].slice(0, n)
    let x = 0
    const total = sizes.reduce((s, v) => s + v * 1.6, 0)
    sizes.forEach((s, i) => { const w = s * 1.6 / total, h = s; pieces.push(['tri', x, 1 - h, x + w, 1, (i % 2 + 1) as Level], ['tri', x + w * .25, 1 - h * .5, x + w * .75, 1 - h * .02, 3, D]); x += w * .88 })
    return { name: 'the pyramids', aspect: between(1.9, 2.3), pieces }
  },
]

let last = -1
/** A new building, never the same kind twice in a row. */
export function nextBuilding(): Building {
  let i = Math.floor(Math.random() * MAKERS.length)
  if (i === last) i = (i + 1) % MAKERS.length
  last = i
  const b = MAKERS[i]()
  return { ...b, pieces: b.pieces.filter(p => p[3] > p[1] && p[4] > p[2]) }
}

/** Whether a point (in screen pixels) lies inside a piece pressed into the box x0..x1, y0..y1. */
export function inside(shape: Shape, x0: number, y0: number, x1: number, y1: number): (x: number, y: number) => boolean {
  const cx = (x0 + x1) / 2, half = (x1 - x0) / 2, h = Math.max(1, y1 - y0)
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const t = (y - y0) / h, dx = Math.abs(x - cx)
    switch (shape) {
      case 'arch': return y >= y0 + half || Math.hypot(x - cx, y - (y0 + half)) <= half
      case 'pointed': { const w = x1 - x0, spring = y0 + w * .87; return y >= spring || (Math.hypot(x - x0, y - spring) <= w && Math.hypot(x - x1, y - spring) <= w) }
      case 'tri': return dx <= t * half
      case 'taper': return dx <= half * (.6 + .4 * t)
      case 'roof': return dx <= half * (.35 + .65 * t ** 2.2)
      case 'dome': return (dx / half) ** 2 + ((y1 - y) / h) ** 2 <= 1
      case 'disc': return (dx / half) ** 2 + ((y - (y0 + y1) / 2) / (h / 2)) ** 2 <= 1
      default: return true
    }
  }
}
