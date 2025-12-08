import type { GestureFeatures } from './hand'

export type MaterialParams = {
  transmission: number
  thickness: number
  ior: number
  roughness: number
  specular: number
}

export function mapFeaturesToMaterial(f: GestureFeatures): MaterialParams {
  const transmission = clamp(0.4 + f.pinch * 0.6, 0, 1)
  const roughness = clamp(0.05 + (1 - f.openness) * 0.45, 0, 1)
  const ior = clamp(1.3 + f.pinch * 0.4, 1.0, 2.5)
  const thickness = clamp(0.8 + f.openness * 1.2, 0.2, 3.0)
  const specular = clamp(0.5 + f.openness * 0.5, 0, 1)
  return { transmission, roughness, ior, thickness, specular }
}

export function mapTiltToRotation(f: GestureFeatures): { dx: number; dy: number } {
  const dx = clamp(f.tiltY, -0.05, 0.05)
  const dy = clamp(f.tiltX, -0.05, 0.05)
  return { dx, dy }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
