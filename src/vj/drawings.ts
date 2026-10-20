/**
 * Pictures drawn into the sand the way a sand artist works: broad, soft masses laid first with the
 * side of the palm, then flowing lines with a fingertip. Drawn after works and traditions in the
 * public domain (Hokusai, Van Gogh, Michelangelo, Klimt, classical sculpture, ink painting) and in
 * the manner of modern line drawing and sculpture, not copies. Path data sits in a 100 × 100 box
 * (y down); each "M" starts a new stroke, and the hand lifts between strokes.
 */
const circle = (cx: number, cy: number, r: number) => `M${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy}`

export type Drawing = { name: string; after?: string; palm?: string; finger: string }

export const DRAWINGS: Drawing[] = [
  { name: 'The great wave', after: 'Hokusai',
    palm: 'M6 82 C18 72 30 42 52 28 C66 20 80 24 86 34 M4 90 C24 84 44 92 64 88 C80 85 90 90 96 88',
    finger: `M86 34 C90 42 84 50 76 46 C70 43 72 36 78 36 M52 28 C50 22 54 18 58 20 M60 24 C60 18 65 16 68 20 M68 26 C70 19 75 19 77 23
      M18 74 C30 60 40 46 56 38 M28 80 C40 66 52 54 66 46 M57 84 L66 70 L75 84 M62 76 L66 74 L70 76` },
  { name: 'Starry night', after: 'Van Gogh',
    palm: 'M6 42 C22 28 40 48 56 36 C70 26 82 38 96 30 M26 84 C46 74 70 76 96 80',
    finger: `M42 34 C42 27 52 27 52 34 C52 41 40 41 40 32 C40 22 56 22 56 34 ${circle(78, 17, 4)} ${circle(20, 16, 3)} ${circle(62, 12, 2.5)}
      M90 12 A7 7 0 1 1 84 25 A5 5 0 1 0 90 12 M18 94 C13 72 22 58 19 38 C26 54 29 74 26 94
      M32 94 L32 86 L37 82 L42 86 L42 94 M47 94 L47 88 L52 84 L57 88 L57 94 M61 94 L67 76 L73 94` },
  { name: 'Venus', after: 'the Venus de Milo',
    palm: 'M36 74 C46 69 56 72 64 69 M37 83 C47 78 56 82 63 78 M38 91 C47 87 55 90 61 87',
    finger: `M41 8 C36 17 38 24 44 27 C40 32 34 39 34 49 C34 59 38 65 36 75 C34 85 38 92 43 97
      M59 8 C64 17 62 24 56 27 C62 31 66 40 64 50 C62 60 60 66 62 76 C64 86 60 92 56 97
      M40 40 C43 45 48 45 50 40 M50 40 C52 45 57 45 60 40 M50 54 L50 56` },
  { name: 'The creation of hands', after: 'Michelangelo',
    palm: 'M2 50 C14 47 26 47 36 49 M98 46 C86 45 74 46 64 49',
    finger: `M2 46 C18 44 30 45 39 48 C43 49 45 50 46.5 51 M39 48 C41 52 39 55 35 55 C29 55 22 55 2 57 M33 51 C36 50 39 51 41 52
      M98 40 C82 40 71 42 61 46 C57 47 55 48 53.5 49 M61 46 C59 50 61 54 65 54 C72 54 82 54 98 52 M67 49 C64 48 61 49 59 50` },
  { name: 'Tree of life', after: 'Klimt',
    palm: 'M18 94 C34 88 66 88 82 94',
    finger: `M50 94 C48 76 52 63 50 48 M50 61 C40 57 30 61 30 53 C30 46 38 46 38 52 M50 53 C62 49 72 55 70 45 C68 39 60 41 62 47
      M50 48 C46 36 52 26 44 20 C38 16 34 24 40 26 M50 48 C56 36 64 30 70 22 C74 16 81 22 76 26 M50 40 C52 30 48 20 52 12 C55 7 60 12 56 15
      M50 94 C40 92 34 89 28 93 M50 94 C60 92 66 89 72 93` },
  { name: 'Mountains in mist', after: 'ink painting',
    palm: 'M4 70 C14 50 22 40 30 44 C38 48 42 60 50 56 C58 52 64 30 74 28 C84 26 90 46 96 52 M4 82 C20 72 40 76 56 72 C70 68 84 74 96 72',
    finger: `M78 92 L78 62 M70 68 L86 66 M72 74 L84 72 M74 80 L82 78 ${circle(24, 20, 8)} M48 20 Q51 17 54 20 Q57 17 60 20 M60 26 Q62 24 64 26 Q66 24 68 26` },
  { name: 'One-line portrait',
    palm: 'M60 10 C80 12 92 30 85 52 C81 66 73 71 66 73',
    finger: `M60 10 C46 12 40 22 42 32 C43 38 40 42 36 46 L40 48 C40 52 38 54 40 56 C42 58 41 60 40 62 C44 64 46 68 44 72 C42 80 46 86 52 94
      M47 34 C50 37 54 37 56 34 M66 44 C70 42 72 48 68 52` },
  { name: 'Dove',
    palm: 'M42 42 C52 30 66 20 84 14 C72 26 66 34 64 42',
    finger: `M10 50 C20 46 30 40 42 42 C52 30 66 20 84 14 C72 26 66 34 64 42 C76 40 88 44 94 50 C80 52 70 54 62 56 C56 66 46 72 34 70 C26 68 20 62 18 56 C14 56 12 54 10 50
      M18 56 C14 62 10 66 6 70 M12 62 C10 60 8 60 6 62 M10 66 C8 64 6 66 6 68 M30 48 L31 49` },
  { name: 'Flight',
    palm: 'M50 22 C52 40 52 60 50 76',
    finger: 'M47 90 C46 84 44 80 46 74 C48 56 44 30 50 6 C56 30 54 56 56 74 C58 80 56 84 55 90 M40 92 L60 92 M42 96 L58 96' },
  { name: 'Reclining figure',
    palm: 'M10 70 C18 52 30 48 40 56 C50 64 60 40 74 38 C86 36 92 48 88 60 C84 72 70 74 58 70 C46 66 36 78 22 80 C14 80 8 76 10 70',
    finger: `${circle(70, 52, 6)} M30 60 C34 64 40 64 44 60 ${circle(18, 62, 5)} M8 86 C30 82 70 82 92 86` },
  { name: 'Dancer',
    palm: 'M34 50 C44 45 55 46 63 52 C56 59 44 59 34 50',
    finger: `M50 13 C46 13 44 17 46 21 C48 25 54 23 54 19 C54 15 52 13 50 13 M50 25 C48 33 46 39 46 45 M48 31 C40 27 30 21 22 12
      M50 31 C60 29 70 25 81 29 M46 45 C40 55 34 63 24 69 M46 45 C54 55 58 67 62 86 M24 69 L18 70 M62 86 L68 88` },
  { name: 'Nautilus',
    palm: 'M84 54 C84 30 64 14 44 16 C24 18 12 36 14 54 C16 76 36 88 56 86',
    finger: `M50 50 C50 46 56 46 56 50 C56 56 46 56 46 48 C46 40 60 40 60 50 C60 62 42 62 42 46 C42 32 66 30 68 50 C70 70 38 74 34 48 C30 24 72 18 80 48
      M56 50 L68 50 M60 50 L72 62 M56 46 L64 34 M46 48 L34 48 M42 46 L38 30` },
  { name: 'The eye',
    palm: 'M14 46 C34 30 66 30 86 46',
    finger: `M10 50 C30 26 70 26 90 50 C70 74 30 74 10 50 ${circle(50, 50, 14)} ${circle(50, 50, 5)} M24 38 L20 30 M36 32 L34 23 M50 30 L50 20 M64 32 L66 23 M76 38 L80 30` },
  { name: 'Koi',
    palm: 'M50 14 C74 14 86 34 80 50 M50 86 C26 86 14 66 20 50',
    finger: `M50 14 C72 16 84 34 76 50 C68 64 52 58 50 50 C48 42 30 36 24 50 M76 50 L84 58 L80 46 M24 50 L16 42 L20 54
      M50 86 C28 84 16 66 24 50 ${circle(62, 26, 2)} ${circle(38, 74, 2)}` },
]

/** Sample path data into strokes of points, in the 100 × 100 box, roughly `step` apart. */
export function strokesOf(d: string | undefined, step = 1.2): [number, number][][] {
  if (!d) return []
  // Path geometry is measured on a hidden SVG in the page; some browsers will not measure detached paths.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden'); svg.append(path); document.body.append(svg)
  try {
    return d.trim().split(/(?=M)/).map(part => {
      path.setAttribute('d', part)
      const total = path.getTotalLength(), n = Math.max(2, Math.ceil(total / step)), points: [number, number][] = []
      for (let i = 0; i <= n; i++) { const p = path.getPointAtLength(total * i / n); points.push([p.x, p.y]) }
      return points
    }).filter(s => s.length > 1)
  } finally { svg.remove() }
}
