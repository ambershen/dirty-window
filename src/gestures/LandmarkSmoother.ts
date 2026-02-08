/**
 * One Euro Filter for adaptive landmark smoothing.
 * Reference: http://cristal.univ-lille.fr/~casiez/1euro/
 *
 * Smooths slow movements aggressively (eliminates jitter) while
 * preserving fast movements (low latency).
 */
class OneEuroFilter {
  private minCutoff: number
  private beta: number
  private dCutoff: number
  private xPrev = 0
  private dxPrev = 0
  private tPrev = -1
  private initialized = false

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff)
    return 1.0 / (1.0 + tau / dt)
  }

  filter(x: number, t: number): number {
    if (!this.initialized) {
      this.xPrev = x
      this.dxPrev = 0
      this.tPrev = t
      this.initialized = true
      return x
    }

    const dt = Math.max(1 / 120, t - this.tPrev)
    this.tPrev = t

    // Derivative estimation
    const dx = (x - this.xPrev) / dt
    const aD = this.alpha(this.dCutoff, dt)
    const dxSmoothed = aD * dx + (1 - aD) * this.dxPrev

    // Adaptive cutoff: faster movement → higher cutoff → less smoothing
    const cutoff = this.minCutoff + this.beta * Math.abs(dxSmoothed)
    const a = this.alpha(cutoff, dt)

    const xSmoothed = a * x + (1 - a) * this.xPrev
    this.xPrev = xSmoothed
    this.dxPrev = dxSmoothed
    return xSmoothed
  }

  reset() {
    this.initialized = false
  }
}

export class LandmarkSmoother {
  private filters = new Map<number, {
    ix: OneEuroFilter; iy: OneEuroFilter
    px: OneEuroFilter; py: OneEuroFilter
  }>()

  constructor(
    private minCutoff = 1.0,
    private beta = 0.007,
  ) {}

  smooth(
    handIndex: number,
    indexTipX: number, indexTipY: number,
    palmX: number, palmY: number,
    tSeconds: number,
  ): { indexTipX: number; indexTipY: number; x: number; y: number } {
    if (!this.filters.has(handIndex)) {
      this.filters.set(handIndex, {
        ix: new OneEuroFilter(this.minCutoff, this.beta),
        iy: new OneEuroFilter(this.minCutoff, this.beta),
        px: new OneEuroFilter(this.minCutoff, this.beta),
        py: new OneEuroFilter(this.minCutoff, this.beta),
      })
    }
    const f = this.filters.get(handIndex)!
    return {
      indexTipX: f.ix.filter(indexTipX, tSeconds),
      indexTipY: f.iy.filter(indexTipY, tSeconds),
      x: f.px.filter(palmX, tSeconds),
      y: f.py.filter(palmY, tSeconds),
    }
  }

  clearHand(handIndex: number) {
    this.filters.delete(handIndex)
  }

  clearAll() {
    this.filters.clear()
  }
}
