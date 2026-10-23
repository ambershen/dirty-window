---
name: sand-compose
description: Compose a sand scroll, a continuous handscroll of scenes telling one story, from the motif library and a story file. Use when asked to compose, draw or generate a scroll or scenes for the VJ sand deck, e.g. "/sand-compose odyssey 6".
---

# Compose a sand scroll

You are the drawing agent from `docs/DRAWING-AGENT.md`. You decide **what** is drawn and how the scenes connect. The deck decides when each stroke lands. Arguments: `<story id> [scene count, default 6]`.

## Curator first (the default)
Hand-drawn figures look far cheaper than the traced famous works. When they share a scroll, the scroll reads as clip-art. So:
- **Each scene is anchored by one traced work.** Use a famous work (`role artwork`), or a motif of quality 4 or more, placed large: 55–75 units tall for figures, 70–120 wide for full pictures.
- **Your own strokes are glue only.** Ground, floor, sea surface, plinths, ripples, and a shore rising into an island. Never draw figures, faces, animals or buildings yourself.
- **Theme scrolls** (`stories/*.json` with `kind: "theme"`, e.g. `body`, `sea`) link works by a thread: era, motif, place or influence. You choose the order and the transitions. Make the ground change meaning along the way: the gallery floor rising into Matisse's hill, the sea rising into an island.
- If no traced work fits a beat, skip the beat rather than draw it yourself. Note what's missing for `/sand-library`.

## Inputs (read these, nothing else)
- `src/vj/stories/<story>.json` for the episodes, moods, key images and tone.
- `node scripts/catalog.mjs <story>` for the pieces you can place. **Never read `artSketches.ts` or `motifSketches.ts`**, because they are hundreds of KB of path data.
- `node scripts/render-scene.mjs --piece a,b,c` to see pieces before using them. Check the result PNG in `.scratch/`.
- `scripts/exemplars/*.json` for accepted scenes from earlier runs. Read up to 3 that match the mood you are drawing.

## Scroll format (`src/vj/scrolls/<story>-<n>.json`)
```json
{ "id": "odyssey-1", "story": "odyssey", "title": "…", "scenes": [
  { "episode": "sirens", "mood": "climax", "caption": "Bound to the mast, he hears them sing.",
    "ground": { "kind": "sea", "d": "M0 78 L40 76 L80 79 L120 77 L160 78 L200 77" },
    "place": [ { "id": "ship", "x": 95, "y": 80, "h": 34 }, { "id": "moon", "x": 170, "y": 8, "h": 14 } ],
    "draw": [ { "d": "M30 70 L34 52 …", "what": "siren on a rock" } ],
    "strokeOrder": ["ground", "place:0", "draw:0", "place:1"] } ] }
```
- Each scene is **200 × 100** units, with y pointing down. The scroll lays scenes side by side.
- `place`:
  - `x, y` is where the piece's bottom centre lands. For pieces marked `hangs`, it is the top centre.
  - `h` is the piece's height in units.
  - `mirror: true` flips the piece so it faces the other way.
- `draw` holds your own strokes as M/L path data in scene coordinates. Use them for props, gestures, rocks, waves, connective lines, and figures the library lacks.
- `ground` must run from x 0 to x 200. It must start at the y where the previous scene's ground ended.
- `strokeOrder` is the order the fingertip draws in. Ground comes first, then silhouettes from back to front, then details.

## Rubric (the aesthetic standard)
1. **One ground.** The ground, sea or river line is continuous across every scene edge and is varied by gentle rises and falls, never flat.
2. **One scale.** Figures (`character`) share one height, about 30–38 units, within ±15%. Ships and creatures are scaled to match the figures.
3. **Silhouette first.** Each element reads as one clear outline. Your own strokes are few and long. Aim for 3–12 strokes per drawn element, with no scribbles or hatching.
4. **One focal point per scene.** One episode and one key image, and the rest stays quiet. Leave at least 30% of the scene empty.
5. **Profile and direction.** The journey moves left to right, because the scroll travels left. Travellers face right unless the story turns them back.
6. **Rhythm across the scroll.** Alternate dense and sparse scenes, and follow the mood curve you planned. Don't put two climaxes in a row unless the story demands it.
7. **Readable at a glance.** Someone who knows the story should name the episode within 3 seconds.
8. **No overlaps that merge.** Keep at least 3 units between elements, unless one deliberately rides on another, like a figure in a ship.

## Loop
1. **Plan.** Pick episodes (fewer than the story has is fine) and write a mood curve. State in one line per scene its key image and which pieces and own strokes it needs.
2. **Draft.** For each scene in order, write the scene into the scroll file. Begin with the previous scene's ground end y.
2b. **Glue.** Give each scene a `glue` kit: `gallery` (arches, columns, frames), `sea` (clouds, birds, islands) or `land` (hills, tufts, clouds). Optionally set `border` (`key` | `waves`) to keep one border through the whole scroll. Then run `node scripts/glue.mjs <scroll>.json`. It fits the glue around the anchor work and reports `! empty quarters`. No quarter of a scene may be empty: the deck can stop on any beat, and an empty shot looks broken. Re-run it whenever you move the anchor.
3. **Render.** Run `node scripts/render-scene.mjs src/vj/scrolls/<file>.json --scene <i>` and check the PNG. Fix every `!` warning it prints.
4. **Critique.** Spawn a critic subagent (general-purpose) with only the PNG path, the episode's key image and the rubric above. Ask it for a 1–5 score per rubric line, an overall score, and the 3 most important fixes. It must not see your plan.
5. **Revise.** Apply the fixes, re-render, and stop after 2 revisions or once the score is 4 or more.
6. **Accept.** Keep the scene. If the overall score is 4 or more, also copy it to `scripts/exemplars/<story>-<episode>-<n>.json` with its score.
7. When all scenes are done, render the whole scroll with `node scripts/render-scene.mjs <file>`. Check the seams between scenes, and fix any discontinuity.

## Report (for the experiment)
At the end, append a short log to `docs/DRAWING-AGENT.md` under **Notes**. Include:
- the scenes and their scores before and after critique;
- the share of strokes that came from the library versus your own;
- which rubric lines failed most;
- pieces the library lacked;
- how many render and critique rounds were needed.
