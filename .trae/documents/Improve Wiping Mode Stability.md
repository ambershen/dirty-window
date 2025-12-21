## Diagnosis

* Wipe mode uses a canvas mask updated as a `blob`/data URL and swapped into `#frosted-glass` every frame (`src/effects/WipeMask.ts:66-105`).

* Swapping URLs at \~30 Hz can race with image decoding and URL revocation, causing intermittent blank masks or flicker.

* The CSS `mask-composite` in the stylesheet (`src/styles.css:84-86`) differs from inline values set during wipe, which may lead to inconsistent blending.

* Per-frame updates are throttled but still applied unconditionally (`src/main.ts:148-166`), which can stutter when the hand is stationary.

## Root Causes

* Asynchronous `toBlob` decoding + immediate style swap creates a brief gap before the new image is ready.

* Aggressive revocation (`deferRevoke` at 250 ms, pool length <= 3) may reclaim URLs while the compositor still references them.

* Edge jagginess from polygonal eraser (`eraseBlob`) accentuates visual jitter during swaps.

* Reapplying mask style properties on every update can trigger unnecessary style recalculations.

## Fix Plan

### Safe image swap

* Preload the new mask image before swapping:

  * Create an `Image`, set `src` to the new blob/data URL, await `img.decode()` (fallback to `onload`).

  * Only after decode, set `el.style.webkitMaskImage`/`maskImage` to the new URL.

* Keep the prior URL active until the decoded image is applied.

### URL lifecycle

* Increase the URL pool size to \~8–12 and delay revocation to \~1000–1500 ms to avoid races.

* Revoke URLs in a background timer, never during the same frame as a swap.

### Apply scheduling

* Guard `applyTo` calls in `src/main.ts` by movement threshold:

  * Compute hand movement distance (`src/main.ts:155-161`) and only apply when `dist > 2–3 px` or every 100–150 ms.

* Maintain the 30 Hz cap but skip redundant applies when stationary.

### Edge smoothing

* In `eraseBlob`, add slight smoothing to the eraser:

  * Use `ctx.filter = 'blur(1.5px)'` around the fill or draw a rounded stroke pass with low alpha to soften polygon edges.

  * Keep `globalCompositeOperation = 'destination-out'`.

### Style stability

* Set `willChange` and `transform` once on first `applyTo` for the element, not every swap.

* Align composites: remove inline `maskComposite` overrides and rely on stylesheet defaults, or explicitly match them (`source-in` for WebKit if needed) for consistency.

## Files to Update

* `src/effects/WipeMask.ts`

  * Implement decode-before-swap logic.

  * Expand URL pool and revocation delay.

  * Add edge smoothing in `eraseBlob`.

  * Set per-element initialization to avoid resetting style each update.

  * Optional: expose `setMaxApplyHz(hz)` if we need to tune later.

* `src/main.ts`

  * Apply scheduling: only call `wipeMask.applyTo(...)` when movement or a minimum interval has elapsed.

  * Keep resize handling unchanged.

* `src/styles.css`

  * Ensure mask composite semantics are consistent; either remove inline overrides from `WipeMask.applyTo` or match stylesheet values.

## Validation

* Run the app, enable Wiping, sweep slowly and fast:

  * Expect no flicker when stationary; smooth erasure edges; reduced stutter at normal motion.

* Toggle wipe on/off and resize; confirm stability.

* Test with two hands simultaneously; verify decoding swap holds up.

* Measure update cadence via logs to ensure \~30 Hz effective applies only under motion.

## Next Steps

* After approval, implement the changes, verify visually using the running dev server, and iterate if any residual jitter remains. Confirm once fixed.

