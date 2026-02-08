import type { Layer } from './Layer'
import type { GestureFeatures } from '../gestures/hand'
import type { LayerState } from '../state/LayerState'
import { DrawingCanvas } from '../effects/DrawingCanvas'

export class DoodleLayer implements Layer {
  readonly id = 'doodling'
  readonly drawingCanvas: DrawingCanvas
  private state: LayerState

  constructor(state: LayerState) {
    this.state = state
    this.drawingCanvas = new DrawingCanvas()
    this.drawingCanvas.appendTo(document.body)
    this.drawingCanvas.hide()
  }

  enable() {
    this.drawingCanvas.show()
  }

  disable() {
    this.drawingCanvas.stopDrawing()
    this.drawingCanvas.hide()
  }

  handlePointing(indexTipX: number, indexTipY: number) {
    const x = indexTipX * window.innerWidth
    const y = indexTipY * window.innerHeight
    if (this.drawingCanvas.isActive) {
      this.drawingCanvas.continueDrawing(x, y)
    } else {
      this.drawingCanvas.startDrawing(x, y)
    }
  }

  stopStroke() {
    this.drawingCanvas.stopDrawing()
  }

  update(now: number, hands: GestureFeatures[]) {
    // Drawing is event-driven via handlePointing/stopStroke from GestureRouter
  }

  resize() {
    this.drawingCanvas.resize()
  }

  destroy() {
    this.drawingCanvas.hide()
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.drawingCanvas.getCanvas()
  }
}
