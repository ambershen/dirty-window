## Project Goals
- Create a minimal, production-ready scaffold for a Three.js interactive web app
- Capture live camera input and run real-time hand gesture detection
- Map gestures to visual effects (e.g., "glass" material parameters) in the 3D scene

## Tech Stack
- Build tooling: `Vite` + `TypeScript`
- 3D engine: `three`
- Gesture detection: `@mediapipe/tasks-vision` (HandLandmarker)
- UI controls: `lil-gui`

## Folder Structure
- `index.html` — app shell with `<canvas>` and permission UI
- `src/main.ts` — bootstrap, renderer loop, wiring modules
- `src/three/scene.ts` — camera, lights, env map, glass material sphere
- `src/three/loaders.ts` — `RGBELoader` for environment map
- `src/gestures/hand.ts` — camera stream, hand detection, gesture features
- `src/gestures/mapping.ts` — map gesture features → effect parameters
- `src/ui/gui.ts` — runtime toggles and debugging values
- `src/styles.css` — basic layout
- `public/assets/env/royal_esplanade_1k.hdr` — HDR environment map

## Dependencies to Add
- `three`
- `@mediapipe/tasks-vision`
- `lil-gui`
- Dev: `vite`, `typescript`

## Initialization Steps
1. Initialize Vite + TS project and scripts: `dev`, `build`, `preview`
2. Add `index.html` with `<canvas id="webgl">` and a hidden `<video id="camera">`
3. Implement `src/three/scene.ts`:
   - Create `WebGLRenderer`, `PerspectiveCamera`, `Scene`
   - Load HDR env with `RGBELoader`; set `scene.environment`
   - Add a sphere using `MeshPhysicalMaterial` with `transmission`, `thickness`, `ior` for glass effect
   - Add directional + ambient lights
4. Implement `src/gestures/hand.ts`:
   - Request camera via `getUserMedia({ video: { facingMode: "user" } })`
   - Initialize `HandLandmarker` with GPU acceleration
   - Per frame: run inference → extract landmarks → compute features (hand openness, pinch strength, palm normal)
5. Implement `src/gestures/mapping.ts`:
   - Map features to material parameters: `transmission`, `roughness`, `ior`, and object rotation
   - Example: pinch increases `transmission`; open palm lowers `roughness`; palm tilt rotates sphere
6. Wire in `src/main.ts`:
   - Start render loop; call `hand.update()` on `requestAnimationFrame`
   - Pass mapped values into the material and scene objects
7. Add `lil-gui` controls for toggling camera/gestures and clamping ranges

## Key Implementation Details
- Use `WebGLRenderer({ antialias: true })`; set `renderer.outputColorSpace = SRGBColorSpace`
- Set `camera` at `fov=50`, `near=0.1`, `far=100`, positioned at `z=4`
- Use `MeshPhysicalMaterial` parameters: `transmission`, `thickness`, `ior`, `roughness`, `specularIntensity`
- Normalize hand landmarks to viewport; gracefully degrade when no hand detected (freeze last values or revert defaults)
- Ensure `HandLandmarker` runs on WebGL backend; batch size 1; run at ~30fps

## Permissions & Privacy
- Prompt user to allow camera access; show a non-blocking banner if denied
- Do not store video frames; process in-memory only

## Performance Considerations
- Run gesture inference at a capped rate (e.g., 30Hz) independent from render loop
- Use a reduced-size `OffscreenCanvas` or downscale video for inference
- Avoid blocking on model loads; show a lightweight loading UI until ready

## Verification Plan
- Local run: `npm run dev` and open preview URL
- Validate: sphere renders with glass effect; moving hand updates material parameters
- Debug: enable GUI pane to inspect raw gesture features

## Optional Enhancements (Later)
- Add post-processing (Bloom/SSR) via `EffectComposer`
- Support multiple hands and discrete gesture classification (open, fist, pinch)
- Implement mobile layout and fallback to tap gestures when no camera

If you approve, I’ll scaffold the project, install dependencies, and implement the modules. 