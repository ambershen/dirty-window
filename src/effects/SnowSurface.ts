import { SandSurface, terrainNoise } from './SandSurface'

export class SnowSurface extends SandSurface {
  constructor(width: number, height: number) { super(width, height, true) }
  override touch(x: number, y: number, radius: number, load = .15, amount = .3) {
    const r = Math.max(2, radius) * (1 + load * .22), outer = r * 1.9
    const deposits: number[] = [], weights: number[] = []
    let loose = 0, weightSum = 0
    for (let py = Math.max(0, Math.floor(y - outer)); py <= Math.min(this.height - 1, Math.ceil(y + outer)); py++) {
      for (let px = Math.max(0, Math.floor(x - outer)); px <= Math.min(this.width - 1, Math.ceil(x + outer)); px++) {
        const i = py * this.width + px, rough = terrainNoise(px * .7, py * .7)
        const d = Math.hypot(px - x, py - y) / (r * (.95 + rough * .10))
        if (d < 1) {
          const shape = Math.pow(1 - d * d, 1.1), target = this.base[i] - (.14 + Math.min(1, load) * .96) * shape
          const removed = Math.max(0, this.levels[i] - target) * Math.min(1, amount)
          this.levels[i] -= removed; loose += removed * .28
          this.compact[i] = Math.min(1, this.compact[i] + removed * 1.3)
          this.disturbed[i] = Math.min(1, this.disturbed[i] + shape * amount)
        } else if (d < 1.9) {
          const weight = Math.exp(-Math.pow((d - 1.18) / .28, 2)) * (.5 + rough)
          deposits.push(i); weights.push(weight); weightSum += weight
        }
      }
    }
    if (weightSum > 0) for (let k = 0; k < deposits.length; k++) this.levels[deposits[k]] += loose * weights[k] / weightSum
    this.resting = 3
  }
  cover(dt: number) {
    const gain = 1 - Math.exp(-dt * .075)
    for (let i = 0; i < this.levels.length; i++) {
      this.levels[i] += (this.base[i] - this.levels[i]) * gain
      this.compact[i] *= 1 - gain; this.disturbed[i] *= 1 - gain
    }
  }
  deposit(x: number, y: number, radius = 2) {
    for (let py = Math.max(0, Math.floor(y - radius)); py <= Math.min(this.height - 1, Math.ceil(y + radius)); py++) {
      for (let px = Math.max(0, Math.floor(x - radius)); px <= Math.min(this.width - 1, Math.ceil(x + radius)); px++) {
        const i = py * this.width + px, weight = Math.max(0, 1 - Math.hypot(px - x, py - y) / radius)
        this.levels[i] += Math.max(0, this.base[i] - this.levels[i]) * .06 * weight
        this.compact[i] *= 1 - .08 * weight
      }
    }
  }
}
