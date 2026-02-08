import type { GestureFeatures } from './hand'
import type { LayerState } from '../state/LayerState'
import type { WindowTouchLayer } from '../layers/WindowTouchLayer'
import type { WeatherLayer } from '../layers/WeatherLayer'
import type { DoodleLayer } from '../layers/DoodleLayer'

export class GestureRouter {
  constructor(
    private state: LayerState,
    private windowTouch: WindowTouchLayer,
    private weather: WeatherLayer,
    private doodle: DoodleLayer,
  ) {}

  dispatch(hands: GestureFeatures[], now: number) {
    // Track whether each hand was claimed by doodling
    const claimedByDoodle = new Set<number>()

    // Priority 1: Doodling claims pointing gestures
    if (this.state.doodling.enabled) {
      for (let i = 0; i < hands.length; i++) {
        const h = hands[i]
        if (h.isPointing && !h.isFist && h.openness < 0.55) {
          this.doodle.handlePointing(h.indexTipX, h.indexTipY)
          claimedByDoodle.add(i)
        }
      }
      // If no hand is pointing, stop the stroke
      if (claimedByDoodle.size === 0) {
        this.doodle.stopStroke()
      }
    } else {
      this.doodle.stopStroke()
    }

    // Priority 2: Window Touch claims open-hand gestures
    // Wiping is fully frozen while doodling mode is active — the two
    // interactions conflict (open hand vs pointing), so we lock wiping out
    // entirely rather than trying per-hand arbitration.
    if (this.state.windowTouch.enabled && !this.state.doodling.enabled) {
      for (let i = 0; i < hands.length; i++) {
        const h = hands[i]
        if (h.openness > 0.3) {
          this.windowTouch.handleWipe(h, i)
        } else {
          this.windowTouch.clearPrev(i)
        }
      }
      this.windowTouch.trimPrev(hands.length)
    } else if (this.state.windowTouch.enabled && this.state.doodling.enabled) {
      // Doodling active — clear all prev positions so wiping doesn't jump
      // when doodling is turned off later
      this.windowTouch.trimPrev(0)
    }

    // Priority 3: Weather always gets splash events independently
    if (this.state.weather.enabled) {
      for (let i = 0; i < hands.length; i++) {
        const h = hands[i]
        if (h.openness > 0.4) {
          const cx = h.x * window.innerWidth
          const cy = h.y * window.innerHeight
          this.weather.handleSplash(cx, cy)
        }
      }
    }
  }
}
