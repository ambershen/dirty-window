import type { GestureFeatures } from '../gestures/hand'

export interface Layer {
  readonly id: string
  enable(): void
  disable(): void
  update(now: number, hands: GestureFeatures[]): void
  resize(): void
  destroy(): void
  getCanvas(): HTMLCanvasElement | null
}
