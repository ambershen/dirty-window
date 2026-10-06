export type PondPoint = { x: number; y: number }
export type PondStroke = PondPoint & { vx: number; vy: number; time: number }
/** Independent contacts: no lines or velocity jumps between different fingers. */
export class PondTouch {
  readonly contacts = new Map<number, PondStroke>()
  down(id: number, x: number, y: number, now: number) {
    this.contacts.set(id, { x, y, vx: 0, vy: 0, time: now })
  }
  move(id: number, x: number, y: number, now: number, aspect = 1) {
    const old = this.contacts.get(id)
    if (!old) return null
    const other = [...this.contacts.entries()].find(([key]) => key !== id)?.[1]
    const dt = Math.max(.008, (now - old.time) / 1000)
    const vx = Math.max(-2, Math.min(2, (x - old.x) / dt))
    const vy = Math.max(-2, Math.min(2, (y - old.y) / dt))
    let rotation = 0
    if (other) {
      const before = Math.atan2(old.y - other.y, (old.x - other.x)*aspect)
      const after = Math.atan2(y - other.y, (x - other.x)*aspect)
      rotation = Math.atan2(Math.sin(after - before), Math.cos(after - before))
    }
    const point = { x, y, vx, vy, time: now }
    this.contacts.set(id, point)
    return { point, previous: old, swirl: other ? {
      x: (x + other.x) / 2, y: (y + other.y) / 2, rotation,
      axisX:Math.hypot((x-other.x)*aspect,y-other.y)<.001?1:(x-other.x)*aspect/Math.hypot((x-other.x)*aspect,y-other.y),
      axisY:Math.hypot((x-other.x)*aspect,y-other.y)<.001?0:(y-other.y)/Math.hypot((x-other.x)*aspect,y-other.y),
      compression: Math.hypot((old.x-other.x)*aspect,old.y-other.y)-Math.hypot((x-other.x)*aspect,y-other.y),
      radius: Math.max(.06, Math.hypot((x - other.x)*aspect, y - other.y) / 2)
    } : null }
  }
  up(id: number) { this.contacts.delete(id) }
  clear() { this.contacts.clear() }
}
