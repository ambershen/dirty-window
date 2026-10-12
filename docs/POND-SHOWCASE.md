# Pond — mobile study 01

Saved: October 6, 2026. User accepted the current touchscreen interaction.

## Preserve this version

Checkpoint: checkpoints/pond-mobile-study-01-2026-10-06.tar.gz
Contains source, public assets, dependency lockfile, build configuration and the built dist directory. Extract into a new folder; keep the current working directory intact. Run npm ci, npm run build, then npm run preview. The built dist directory can also be hosted by a static HTTPS host.

The blue tiled pool photo is the default on touch devices. The query ?background=pool forces this background on any device. Tap, drag, pinch/spread and rotate drive the existing water interaction and natural recorded water sounds. Audio starts through a user gesture. Camera is optional. This is the accepted baseline; explore new versions separately.

The Cloudflare testing URL is temporary and depends on the Mac and local processes remaining running. The archive is local, not an off-device backup or permanent deployment. A permanent showcase requires static HTTPS hosting and an off-device copy of the checkpoint.

## Creative direction: a surface that remembers touch

Working concept: an ordinary surface becomes a responsive body of water. Small gestures have immediate, spatially aligned consequences; waves outlive the gesture and gradually settle. Preserve quietness, legibility and the pleasure of touching rather than adding unrelated effects.

### 1. Table pond — proposed next installation prototype

Project down onto a matte tabletop. An overhead camera observes hands; calibrate its coordinates to the projected rectangle with four corner points. Begin with one person and one fingertip. With an ordinary RGB camera, treat this as proximity interaction until contact detection is validated; a depth sensor or touch surface may be needed for reliable actual contact. Mask/compensate projected imagery during tracking and test shadows, ambient light and latency in the actual space. Put speakers close to the table.

Prototype acceptance: fingertip and ripple center align across the surface; no input while the person is absent; hand lift ends input; repeated sweeps remain continuous; two users can create intersecting waves without tracking IDs jumping. Progress from single touch to multi-user only after the first four pass.

### 2. Reflection wall

A wall-sized water reflection. Hand sweeps displace the image locally. Body silhouette can intentionally push broad, slow waves in this separate mode. Stillness restores a clear reflection. Distinguish this mapping from the existing hand-only behavior rather than silently changing it. Keep sound spatially near the action and subtle enough for a gallery.

### 3. Shared pond

Two people interact on opposite sides of a table; their waves cross. Explore interference and shared patterns without scores or instructions. Avoid promising reliable multi-person tracking before testing occlusion.

### 4. Floor water

Walking creates wakes rather than isolated circles. Test empty-floor calibration and safe, clearly visible floor boundaries. This is a later installation experiment requiring different tracking and space setup.

## Showcase package

- Preserve this playable mobile version as Study 01.
- Publish a stable HTTPS URL and a QR code once hosted.
- Capture a 30–45 second film: quiet surface, fingertip entry, continuous drag, two-finger interaction, release and settling.
- Photograph the physical interaction, not only the screen.
- Present the mobile piece as an interactive study and label projection imagery as a prototype until it is built.
- Keep asset/audio credits and confirm showcase rights for the user-supplied pool photograph before public release.

## Next experiment

Table pond: first use mouse input to validate the projection composition, then add camera calibration and a single fingertip. Test in the actual room before buying additional sensing hardware. Hardware planning needs the projector model, mounting options, surface size, ambient light and available camera/depth sensor.
