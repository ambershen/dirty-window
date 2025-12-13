## Goal
Make wiping harder or easier based on a "dirtiness" level, and modulate erase strength with live hand movement (speed and openness). Address non-responsiveness when re-wiping the same area.

## Approach
- Use the existing "Glass Style → Dirtiness" slider (already mapped to `--dirt-opacity`) as the source of difficulty.
- Map dirtiness to wipe strength so higher dirtiness requires more repeated passes to clear, and lower dirtiness clears quickly.
- Factor in hand openness and speed to dynamically boost erase strength during fast or open-handed motions.
- Improve responsiveness by increasing mask application rate and by applying partial erasure even when repeatedly wiping the same spot.

## Technical Design
- Erase blending:
  - In the wipe canvas, switch from fully removing pixels to partial removal using `globalAlpha` with `destination-out`.
  - Compute per-stamp alpha: `alpha = lerp(0.15, 0.85, 1 - dirtiness)` and modulate by movement/openness: `alpha *= clamp(0.4 + 0.6 * max(speedNorm, openness), 0.05, 0.95)`.
  - Result: a dirty glass wipes slowly unless you move faster or open your hand more.
- Movement metrics:
  - Track previous hand positions to compute per-frame pixel speed; normalize by screen size (e.g., speedNorm = clamp(distancePx / 600, 0, 1)).
  - Use both hands when available; if only one hand is present, wiping still works.
- Responsiveness:
  - Increase canvas mask apply cadence to ~60 Hz using `canvas.toBlob` + `URL.createObjectURL` (already optimized); apply adaptively — fast movement keeps cadence high, idle lowers it.
  - Ensure repeated stamps at the same coordinates still reduce alpha (thanks to partial erasure), addressing non-responsiveness in re-wipe scenarios.

## Files to Change
- `src/effects/WipeMask.ts`:
  - Add `setDifficulty(d: number)` to store dirtiness (0..1).
  - Update `eraseBlob(x, y, r, alpha?)` to accept optional alpha or compute internally from difficulty.
  - Set `ctx.globalAlpha` before fill to achieve partial erasure.
  - Increase `maxApplyHz` to 60 and add adaptive throttling based on recent movement.
- `src/main.ts`:
  - Feed difficulty from the existing style dirt slider: when `onStyleChange('--dirt-opacity', v)` is invoked, also call `wipeMask.setDifficulty(v)`.
  - Track per-hand previous positions, compute speed, openness, and determine per-stamp alpha.
  - During wiping mode, call `eraseBlob` with computed radius and alpha; keep two-hand support, fall back to one-hand if needed.
  - Adjust application cadence: call `wipeMask.applyTo(frostedGlass)` every frame while wiping; internal throttling will adapt.
- No GUI changes required (reuse the current Dirtiness slider).

## Verification
- With dirtiness low, a light wipe quickly clears large regions; with dirtiness high, repeated passes are needed.
- Faster movement or increased openness produces stronger wiping even at higher dirtiness.
- Re-wiping the same area continues to clear (no dead spots).
- Ripple remains disabled in wiping mode; trail mask resumes when wiping is off.

## Rollback Safety
- Changes are locally scoped to the wipe mask and main loop; disabling wiping restores original trail-based gradients and leaves visual dirtiness (CSS overlay) untouched.