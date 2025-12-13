## Overview
- Implement a new interaction: "Wiping Enabled". When on, two hands can progressively clear the frosted glass across the window, and the cleared regions follow each hand’s movement.
- Use an offscreen canvas to accumulate an alpha mask that punches transparent holes in the overlay. Apply the canvas as the element’s `mask-image` / `-webkit-mask-image` so the frosted layer disappears where users have wiped.

## Current Architecture Context
- Frosted overlay is a CSS layer with mask gradients driven by per-frame CSS variables (`--tx-*`, `--ty-*`, `--tr-*`, `--te-*`, `--x2`, `--y2`) in `src/styles.css:35-86`.
- Hand tracking yields up to two hands (`hand.hands`), each providing screen-space `x/y` and `openness` in `src/gestures/hand.ts:26-28, 88-125`.
- The trail-based mask is updated per frame in `src/main.ts:97-115` and secondary clear spot for the second hand at `src/main.ts:118-128`.

## Files to Update
- `src/ui/gui.ts`: Add a new GUI folder "Wiping" with a toggle (Wiping Enabled) and a Reset button.
- `src/main.ts`: Integrate the wipe mode state, drive the canvas-based mask when enabled and two hands are present, and swap overlay masking to the canvas. Restore the original gradient mask when disabled.
- `src/effects/WipeMask.ts`: New lightweight module to manage the wipe canvas (allocate, resize, clear, erase circles/lines, and apply as `mask-image`).

## Implementation Steps
1. Create `WipeMask` class
   - Allocate an offscreen `HTMLCanvasElement` sized to `window.innerWidth/innerHeight`.
   - Initialize with a fully opaque black fill (mask blocks the overlay everywhere initially).
   - Provide methods:
     - `resize(w, h)`: resizes and refills black.
     - `clear()`: refills black to reset wiping.
     - `eraseCircle(x, y, r)`: uses `globalCompositeOperation = 'destination-out'` to punch transparent holes following hand movement.
     - `applyTo(el)`: sets `el.style.maskImage` and `el.style.webkitMaskImage` to `url(canvas.toDataURL('image/png'))`, with decimation (e.g., max 20 Hz) to avoid heavy data URL generation each frame.

2. Add GUI controls in `src/ui/gui.ts`
   - New folder "Wiping" with:
     - `wiping` boolean toggle.
     - `Reset Wipe` button.
   - Extend `setupGUI` signature to accept `onWipeToggle(v: boolean)` and `onWipeReset()` callbacks.

3. Wire mode in `src/main.ts`
   - Track `let wipingEnabled = false` and `const wipeMask = new WipeMask()` after DOM elements are available.
   - On window resize, call `wipeMask.resize(...)`.
   - In the render loop:
     - If `wipingEnabled` and `hand.hands.length >= 2`, for each hand compute screen coords (`cx = x*width`, `cy = y*height`) and brush radius (`r = 20 + openness*80`), call `wipeMask.eraseCircle(cx, cy, r)`.
     - After erasures, call `wipeMask.applyTo(frostedGlass)` (decimated).
     - While wiping is enabled, disable the gradient trail by temporarily overriding the element’s `mask-image` to the canvas (leave CSS variables untouched; they’re ignored because the inline style takes precedence).
   - When toggled off, remove inline `mask-image` overrides to restore the CSS-defined gradient mask; the trail behavior resumes.
   - Hook GUI callbacks:
     - `onWipeToggle`: set `wipingEnabled` and reset mask when toggling on.
     - `onWipeReset`: call `wipeMask.clear()` and reapply.

## Two-Hand Logic
- Require `hand.hands.length >= 2` to engage wiping. If fewer hands are present, do not erase; previously cleared areas remain until reset.
- Use both hands each frame to erase simultaneously.

## Performance & Quality
- Decimate `toDataURL` updates to ~20 Hz; accumulate erasures in canvas at the tracking rate.
- Use `requestAnimationFrame` timing already present (`src/main.ts:130-132`).
- Avoid DOM changes; canvas stays offscreen. Inline `mask-image` overrides only when mode is active.

## Verification
- Manual test: Toggle "Wiping Enabled", place two hands, move across screen; overlay should disappear along both paths and remain cleared.
- Toggle off: overlay reverts to trail gradient; clearing no longer accumulates.
- Reset Wipe: cleared regions vanish; overlay returns to fully frosted until hands move.
- Confirm that water splashes and ripple interactions still work (`src/main.ts:85-95`).

## Notes
- No `src/styles.css` changes are required; we override the `mask-image` inline during wipe mode and restore when disabled.
- This approach avoids adding hundreds of radial gradients and provides a smooth, persistent wipe effect driven by live hand tracking.