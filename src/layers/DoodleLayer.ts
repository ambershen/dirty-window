import type { Layer } from './Layer'
import type { GestureFeatures } from '../gestures/hand'
import type { LayerState } from '../state/LayerState'
import { DrawingCanvas } from '../effects/DrawingCanvas'
import { DoodleCursor } from '../effects/DoodleCursor'

export class DoodleLayer implements Layer {
  readonly id = 'doodling'
  readonly drawingCanvas: DrawingCanvas
  private cursor: DoodleCursor
  private state: LayerState

  constructor(state: LayerState) {
    this.state = state
    this.drawingCanvas = new DrawingCanvas()
    this.drawingCanvas.appendTo(document.body)
    this.drawingCanvas.hide()
    this.cursor = new DoodleCursor()
    this.cursor.appendTo(document.body)
    this.cursor.hide()
  }

  enable() {
    this.drawingCanvas.show()
    this.cursor.show()
  }

  disable() {
    this.drawingCanvas.stopDrawing()
    this.drawingCanvas.hide()
    this.cursor.clear()
    this.cursor.hide()
  }

  handlePointing(indexTipX: number, indexTipY: number) {
    const x = indexTipX * window.innerWidth
    const y = indexTipY * window.innerHeight
    this.cursor.render(x, y, this.drawingCanvas.brushSize, this.drawingCanvas.getColor(), this.drawingCanvas.eraserMode)
    if (this.drawingCanvas.isActive) {
      this.drawingCanvas.continueDrawing(x, y)
    } else {
      this.drawingCanvas.startDrawing(x, y)
    }
  }

  stopStroke() {
    this.drawingCanvas.stopDrawing()
    this.cursor.clear()
  }

  update(now: number, hands: GestureFeatures[]) {
    // Drawing is event-driven via handlePointing/stopStroke from GestureRouter
  }

  resize() {
    this.drawingCanvas.resize()
    this.cursor.resize()
  }

  destroy() {
    this.drawingCanvas.hide()
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.drawingCanvas.getCanvas()
  }
}
