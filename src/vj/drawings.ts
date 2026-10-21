/** Path data → strokes of points, for the pictures pressed into the sand (see artSketches.ts). */
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
