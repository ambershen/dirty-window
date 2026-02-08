# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

- `npm run dev` — Start Vite dev server (port 5173)
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npx tsc --noEmit` — Type-check without emitting (Vite handles compilation)
- `npx vite build` — Alternative direct build invocation

No test framework is configured. No linter is configured.

## Architecture

Interactive webcam app with hand-gesture-driven visual effects rendered as independently toggleable canvas layers on top of a mirrored camera feed. Uses MediaPipe for hand tracking, Vite + TypeScript (strict mode, ES2020 target), and zero UI frameworks.

### Layer System

Four combinable layers stack at different z-indices over the camera video (z:1):

| Layer | z-index | Gesture | Description |
|-------|---------|---------|-------------|
| Doodle | 5 | Pointing finger | Drawing canvas via `DrawingCanvas` |
| WindowTouch | 10 | Open hand | Frosted glass wiping via `FogRenderer` (simplex noise fog with eraseBlob/eraseStroke) |
| Weather | 15 | Open hand (splash) | Rain particles, splash effects, dark night mode via `WaterEffects` + `SoundManager` |
| PhotoBooth | — | None (UI only) | Photo capture / video recording by compositing all layer canvases |

Each layer implements `src/layers/Layer.ts` interface: `enable()`, `disable()`, `update(now, hands)`, `resize()`, `destroy()`, `getCanvas()`.

### State & Event Flow

`LayerState` (`src/state/LayerState.ts`) is the single source of truth with pub/sub via `onChange(callback)`. The main loop in `src/main.ts`:

```
HandTracker.update() → GestureRouter.dispatch() → each Layer.update() → RAF
```

`GestureRouter` resolves gesture conflicts with priority: Doodle (pointing) > WindowTouch (open hand) > Weather (splash, always independent). **Doodling completely freezes window wiping** — the two are mutually exclusive.

### Key Architectural Decisions

- Layers preserve state when toggled off (canvas hidden, not cleared)
- `FogRenderer` uses a mask canvas — white=fog, black=clear — applied via `destination-in` compositing
- `WaterEffects` references `FogRenderer` so rain drops erode fog (via `eraseBlob`)
- `PhotoBoothLayer` composites by drawing mirrored video + all visible layer canvases in z-order onto an offscreen canvas
- Hand tracking runs at 30Hz max on a downscaled canvas (160-320px) for performance
- `FaceTracker` (`src/gestures/face.ts`) exists but is not wired into the main loop

### TUI Panel

`src/ui/TuiPanel.ts` builds the retro-futuristic control panel entirely via DOM manipulation (no templates). Styled in `src/ui/tui.css` with CSS variables (`--tui-fg: #33ff66` phosphor green). Panel positions cycle through right → left → top via `[P]` key. Keyboard shortcuts: `[H]` toggle panel, `[1-4]` toggle layers.
