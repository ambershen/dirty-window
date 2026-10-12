export function terrainNoise(x: number, y: number): number {
  const hash = (a: number, b: number) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n) }
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
}

/** Heights are material units. Local downhill transfers conserve sand volume. */
export class SandSurface {
  readonly levels: Float32Array
  readonly base: Float32Array
  readonly compact: Float32Array
  readonly disturbed: Float32Array
  protected resting = 0
  protected pass = 0
  constructor(readonly width: number, readonly height: number, readonly snow = false) {
    this.levels = new Float32Array(width * height)
    this.base = new Float32Array(width * height)
    this.compact = new Float32Array(width * height)
    this.disturbed = new Float32Array(width * height)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      // Long smooth dunes leave the untouched surface quiet enough to draw on.
      const scale = Math.max(width, height)
      const u = x / scale, v = y / scale
      const broad = terrainNoise(u * 3.1 + 4.7, v * 3.1 + 2.3)
      const shoulder = terrainNoise(u * 5.2 + 11.2, v * 5.2 + 7.8)
      // Localized rounded hills, not continuous bands across the whole screen.
      const nx = x / width, ny = y / height
      const hill = (cx: number, cy: number, rx: number, ry: number, height: number) => {
        const a = (nx - cx) / rx, b = (ny - cy) / ry
        const curved = b + .22 * a * a
        return height * Math.exp(-(a * a + curved * curved) * 1.6)
      }
      this.base[y * width + x] = snow
        ? 1.25 + broad * .09
        : .94 + hill(.25, .31, .38, .38, 1.35)
          + hill(.78, .60, .35, .43, 1.45)
          + hill(.18, .95, .40, .29, .60)
          + hill(.51, .46, .26, .24, .16) + broad * .10 + shoulder * .025
    }
    this.reset()
  }
  reset() { this.levels.set(this.base); this.compact.fill(0); this.disturbed.fill(0); this.resting = 0 }
  touch(x: number, y: number, radius: number, load = .4, amount = .65, motionX = 0, motionY = 0) {
    const r = Math.max(1.5, radius), outer = r * 2.8
    let removed = 0, weights = 0
    const deposits: number[] = [], values: number[] = []
    const center = Math.min(this.levels.length - 1, Math.max(0, Math.round(y) * this.width + Math.round(x)))
    const depth = .13 + Math.min(1, load) * .20
    const motionLength = Math.hypot(motionX, motionY)
    const dirX = motionLength > .001 ? motionX / motionLength : 0
    const dirY = motionLength > .001 ? motionY / motionLength : 0
    for (let py = Math.max(0, Math.floor(y - outer)); py <= Math.min(this.height - 1, Math.ceil(y + outer)); py++) {
      for (let px = Math.max(0, Math.floor(x - outer)); px <= Math.min(this.width - 1, Math.ceil(x + outer)); px++) {
        const i = py * this.width + px, rough = terrainNoise(px * .8, py * .8)
        const d = Math.hypot(px - x, py - y) / (r * (.93 + rough * .14))
        if (d < 1) {
          // A firm shallow channel with a broad floor and softened narrow shoulders.
          const edge = Math.max(0, Math.min(1, (1 - d) / .30))
          const shape = edge * edge * (3 - 2 * edge), target = this.base[i] - depth * shape
          const take = Math.max(0, this.levels[i] - target) * Math.min(1, amount)
          this.levels[i] -= take; removed += take
          this.disturbed[i] = Math.min(1, this.disturbed[i] + shape * amount)
        } else if (d < 2.8) {
          // Most displaced sand piles at the sides; some is pushed ahead.
          // The downhill side receives more material, then relaxes under gravity.
          const length = Math.max(.001, Math.hypot(px - x, py - y))
          const along = ((px - x) * dirX + (py - y) * dirY) / length
          const side = motionLength > .001 ? .35 + (1 - along * along) * 1.4 + Math.max(0, along) * .45 : 1
          const downhill = Math.max(.35, Math.min(2.5, 1 + (this.base[center] - this.base[i]) * 5))
          const weight = Math.exp(-Math.pow((d - 1.75) / .60, 2)) * (.8 + rough * .4) * side * downhill
          deposits.push(i); values.push(weight); weights += weight
        }
      }
    }
    if (weights > 0) for (let k = 0; k < deposits.length; k++) {
      this.levels[deposits[k]] += removed * values[k] / weights
      this.disturbed[deposits[k]] = Math.min(1, this.disturbed[deposits[k]] + values[k] * .1)
    }
    this.resting = 4
  }
  settle(dt: number) {
    if (this.resting <= 0) return
    this.resting -= dt
    const rate = (1 - Math.exp(-Math.min(.05, dt) * (this.snow ? 14 : 11))) * .22
    const repose = this.snow ? .10 : .014
    const transfer = (a: number, b: number) => {
      const difference = this.levels[a] - this.levels[b]
      // Undisturbed hills are the resting bed. Only mobilized grains avalanche.
      if (!this.snow && Math.max(this.disturbed[a], this.disturbed[b]) < .015) return
      const bedSlope = this.snow ? 0 : Math.abs(this.base[a] - this.base[b])
      const excess = Math.abs(difference) - Math.max(repose, bedSlope * 1.05)
      if (excess <= 0) return
      const amount = Math.sign(difference) * excess * rate
      this.levels[a] -= amount; this.levels[b] += amount
      if (!this.snow) {
        const target = amount > 0 ? b : a
        this.disturbed[target] = Math.min(1, this.disturbed[target] + Math.abs(amount) * 3)
      }
    }
    const reverse = (this.pass++ % 2) !== 0
    for (let j = 0; j < this.levels.length; j++) {
      const i = reverse ? this.levels.length - j - 1 : j, x = i % this.width
      if (x + 1 < this.width) transfer(i, i + 1)
      if (i + this.width < this.levels.length) transfer(i, i + this.width)
    }
  }
}
