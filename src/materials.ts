/** The effects, in order (the collection is meant to grow). Shared by the landing page and the playground's material switcher. */
export type Material = { id: 'water' | 'ice' | 'steam' | 'sand' | 'snow'; name: string; state: string; href: string; note: string; gestures: string; memory: string }

export const MATERIALS: Material[] = [
  { id: 'water', name: 'Water', state: 'liquid', href: '/?mode=water', note: 'A night pond that carries every touch outward in wakes and slow rings.', gestures: 'Drag · Lift · Speak', memory: 'A few seconds' },
  { id: 'ice', name: 'Ice', state: 'solid', href: '/?mode=ice', note: 'A frozen sheet that takes a faint scratch, and cracks if you linger.', gestures: 'Slide · Hold · Squeeze', memory: 'Cracks, until it refreezes' },
  { id: 'steam', name: 'Steam', state: 'vapour', href: '/?mode=steam', note: 'A fogged window for writing and handprints; old words return as ghosts.', gestures: 'Write · Wipe · Breathe', memory: 'Half a minute, then a ghost' },
  { id: 'sand', name: 'Sand', state: 'grains', href: '/?mode=sand', note: 'Warm dunes that part around a fingertip and slowly settle back.', gestures: 'Trace · Sweep · Sink', memory: 'Until it is smoothed' },
  { id: 'snow', name: 'Snow', state: 'powder', href: '/?mode=snow', note: 'Fresh powder that keeps your prints until new snow covers them.', gestures: 'Trace · Press · Snowfall', memory: 'Until it snows again' },
]

/** The study a scene URL belongs to (steam is also reachable as fog). */
export function currentMaterial(mode: string | null) {
  return MATERIALS.find(m => m.id === (mode === 'fog' ? 'steam' : mode))
}
