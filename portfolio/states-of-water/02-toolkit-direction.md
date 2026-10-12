# From material studies to an authoring tool

## Intended user and task

An artist or creative coder wants to turn a gesture into a material response, compare variations, and reuse a successful behavior in another scene.

The first tool should support one concrete task: **replay one recorded gesture against several behavior recipes, adjust a few parameters, and save the result.** This makes comparisons reproducible and reduces the need to repeat a camera gesture identically.

## Existing building blocks

| Building block | Current code | Current status |
|---|---|---|
| Camera gesture features | `src/gestures/hand.ts` | Shared tracker; fog-specific draw/pause mapping remains separate |
| Water surface response | `src/effects/WaterSurface.ts` | Existing effect module |
| Ice friction writing | `src/effects/IceWriting.ts` | Existing effect module |
| Irregular fractures | `src/effects/IceFractures.ts` | Existing effect module |
| Recorded sound playback | `src/audio/IceSound.ts`, `src/audio/WaterSoundscape.ts` | Material-specific implementations |
| Condensation | `src/fog.ts` | Scene logic; needs extraction before reuse |

These modules are a starting point. They do not yet form a documented, unified toolkit.

## Proposed interaction vocabulary

Input adapters would translate touch, pointer, camera, or recorded input into a common contact stream:

- begin / move / end
- contact ID, timestamp, normalized position
- velocity
- estimated load with its origin explicitly identified: dwell, pinch movement, or reported pen pressure

A material consumes that stream and emits visual and audio events. Camera tracking loss must end contact; replay must preserve timestamps. Pressure proxies should remain distinguishable from sensor measurements.

## Proposed behavior controls

| Family | Candidate controls | What to compare |
|---|---|---|
| Gravity | acceleration, pinning threshold, release delay | Constant slide versus gather-and-release |
| Motion | propagation speed, damping, persistence | Brief disturbance versus lingering response |
| Trace | opacity, accumulation, edge softness, recovery | Easy writing versus effortful marking |
| Wet surface | dirtiness, added water, clearing effort, trace duration | Reveal an image gradually or obscure a message |
| Fracture | load threshold, branching, growth rate | Sparse splitting versus dense breakage |
| Sound | hand configuration mapping, motion/load response, gain, event threshold, tail | Fingertip versus open hand; continuous motion versus pressure release |

Expose controls that make a perceptible difference. Avoid requiring the artist to understand every rendering parameter.

## First deliverable — proposed, not implemented

1. Extract condensation into a material module.
2. Record/replay a timestamped pointer gesture.
3. Add a side-by-side comparison of two recipes using the same gesture.
4. Save/load a versioned JSON recipe, including material and audio asset references.
5. Provide one small example showing how to embed a recipe in a new scene.

A browser editor, broader plugin system, and projector calibration interface can follow only if these simpler tools prove useful.

## Evaluation questions

Can another artist predict what each control will change? Can they create two recognizably different responses? Can they transfer a recipe from touch to camera input without rewriting the material? Which controls need direct manipulation rather than sliders?

Record task attempts, confusion, parameter choices, and the resulting sketches. Treat a small exploratory study as qualitative evidence rather than proof of general usability.
