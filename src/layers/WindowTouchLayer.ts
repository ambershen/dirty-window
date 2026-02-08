import type { Layer } from './Layer'
import type { GestureFeatures } from '../gestures/hand'
import type { LayerState } from '../state/LayerState'
import { FogRenderer } from '../effects/FogRenderer'

export class WindowTouchLayer implements Layer {
  readonly id = 'windowTouch'
  readonly fogRenderer: FogRenderer
  private video: HTMLVideoElement
  private state: LayerState
  private prevPos: { x: number; y: number }[] = [{ x: -1, y: -1 }, { x: -1, y: -1 }]

  constructor(video: HTMLVideoElement, state: LayerState) {
    this.video = video
    this.state = state
    this.fogRenderer = new FogRenderer()
    this.fogRenderer.appendTo(document.body)
    this.fogRenderer.hide()
  }

  enable() {
    this.fogRenderer.show()
  }

  disable() {
    this.fogRenderer.hide()
  }

  handleWipe(hand: GestureFeatures, handIndex: number) {
    const x = hand.x * window.innerWidth
    const y = hand.y * window.innerHeight
    const r = 30 + hand.openness * 120
    const p = this.prevPos[handIndex] || { x: -1, y: -1 }

    let dist = 0
    if (p.x >= 0 && p.y >= 0) {
      dist = Math.hypot(x - p.x, y - p.y)
    }

    const speedNorm = Math.min(1, dist / 60)
    const movementBoost = Math.max(speedNorm, hand.openness)
    const alpha = Math.max(0.05, Math.min(0.95, 0.4 + 0.6 * movementBoost))

    if (p.x >= 0 && dist < 300) {
      this.fogRenderer.eraseStroke(p.x, p.y, x, y, r, alpha)
    } else {
      this.fogRenderer.eraseBlob(x, y, r, alpha)
    }

    this.prevPos[handIndex] = { x, y }
  }

  clearPrev(handIndex: number) {
    if (this.prevPos[handIndex]) {
      this.prevPos[handIndex] = { x: -1, y: -1 }
    }
  }

  trimPrev(activeCount: number) {
    for (let i = activeCount; i < this.prevPos.length; i++) {
      this.prevPos[i] = { x: -1, y: -1 }
    }
  }

  update(now: number, hands: GestureFeatures[]) {
    // Render fog when windowTouch is enabled OR doodling is enabled (frosted glass backdrop)
    if (!this.state.windowTouch.enabled && !this.state.doodling.enabled) return
    this.fogRenderer.render(this.video)
    this.fogRenderer.restoreFog(this.state.windowTouch.difficulty)
  }

  resize() {
    this.fogRenderer.resize()
  }

  destroy() {
    this.fogRenderer.destroy()
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.fogRenderer.getCanvas()
  }
}
