/** Cold-press paper grain, laid over a view with multiply so it reads as painted on paper. */
export function paperGrain(w: number, h: number, dpr: number, strength = 14) {
  const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
  const g = c.getContext('2d')!, img = g.createImageData(c.width, c.height)
  for (let i = 0; i < img.data.length; i += 4) { const n = Math.random(); img.data[i] = img.data[i + 1] = img.data[i + 2] = n > .5 ? 255 : 90; img.data[i + 3] = n * strength }
  g.putImageData(img, 0, 0)
  return c
}
