# After Hours: Midnight Train

A camera canvas organized around drawing, sound, and future touch interactions.

## Try it

Run `npm ci` and `npm run dev`. The default route opens Midnight Train; `?mode=classic` opens the original glass experiment.

- Choose Star, Fish, or Flower. Draw inside the window with a mouse or pointer. Pause for 1.4 seconds to release the sketch.
- Fingertip drawing enables the camera and MediaPipe. Point with one index finger; lower your hand to end the stroke. Your camera appears as a faint reflection.
- Enable sound to use microphone loudness locally. Louder sounds brighten sketches and speed up the passing scenery. Toggle again to release the microphone.
- Record captures a silent canvas video for up to 15 seconds, including the camera reflection if enabled.

## Prototype boundaries

The drawing choice selects an animation, not AI recognition. Original strokes are preserved. Stars rise, fish sway through the scene, and flowers grow stems. Drawings expire after one minute, with a maximum of 24 on screen.

The train uses layered 2D rendering for depth, not a reconstructed 3D room. Sound measures energy, not words or pitch. Microphone audio is neither uploaded nor recorded. MediaPipe downloads its model/runtime when camera tracking starts.

## Next experiments

1. Drawing: recognize a few shapes, then test freeform interpretation while preserving the original drawing.
2. Sound: distinguish a sustained hum from a clap, and give each a different response.
3. Touch: multi-finger pinch, twist, and spring-back distortion of the scene.
4. Depth: head-driven parallax, person segmentation, and refractive glass.

## Validation

Browser: scene renders; all three drawing choices release into animations; camera and microphone require an explicit click. Hardware interactions should be tested with a real hand and microphone.

For an uninterrupted camera session, use `npm run build` followed by `npm run preview -- --host 127.0.0.1`. The preview does not reload when filesystem watchers fire. Stop the dev server first because both commands use port 5173.

## Immersive interaction update

The scene fills the viewport. Controls use icons and fade after 2.2 seconds without pointer or keyboard activity; move the pointer or use Tab to reveal them. The expand icon requests browser fullscreen. Accessible labels and status announcements remain available to screen readers.

Midnight Train tracks one hand, requests up to 60 fps from the camera, skips duplicate video frames, and uses a more responsive One Euro filter (minimum cutoff 5, beta 3). Camera-to-canvas coordinates account for the centered cover crop. Actual frame rate depends on the camera and device; these changes do not make model inference asynchronous.

## Current direction: interactive photobooth

The fullscreen view now shows the unfiltered mirrored camera feed and user drawings only. Train scenery, stars, moon, rain, haze, and camera tint are removed. Sound affects drawings.

The camera is behind frosted glass again: soft blur, translucent frost, and cached grain. Fingertips clear narrow trails; an open palm wipes broader areas. Frost slowly returns. The fullscreen view still has no scenery or visible text.

Frost restoration now holds the wipe for 2 seconds after the last drawing/wiping input, then restores about 90% of the frost over the next 2.8 seconds (instead of the previous 18-second decay time constant).

## Current drawing behavior

Fingertip and mouse movement only erase the frost mask, like drawing on condensation. There is no colored ink, cursor ring, shape selection, moving sketch, or drawing animation. Cleared marks remain fixed on the glass until frost returns. The microphone control is removed because there is no sound-driven drawing animation in this mode.

Only an explicitly detected pointing index finger clears frost through camera input. Open-palm wiping is disabled; head and body movement have no clearing handler. Mouse/touch dragging remains available.

## Water alternative

The droplet icon switches to a WebGL water reflection of the live camera, inspired by the supplied X clip. The snowflake restores the existing frosted window. Quiet water has layered horizontal ripples; pointing fingertips or pointer drags generate expanding rings. The microphone icon opts into local Web Audio analysis: volume controls refraction strength, low frequencies strengthen broad waves, and high frequencies add fine ripples and highlights. Switching to frost stops the microphone. The waveform icon previews a synthetic sound pulse without microphone access. Recordings remain silent. No scenery images are added.

## Recorded water soundscape

Speaker icon enables real hand-in-water foley, replacing all oscillators, musical pitches, and filtered noise. Short varied excerpts play at original speed and pitch: fingertips trigger small splashes; palm/body motion triggers quieter, longer sloshes with pauses. Playback is limited to three overlapping excerpts. Fists fade the sounds; frost mutes them. Camera motion remains a frame-difference estimate and may include background movement. Speaker and microphone modes are mutually exclusive. Recordings remain silent.

Source: “Water, Gentle Movement.wav” by Daen23, CC0, https://freesound.org/people/Daen23/sounds/431627/ (26-second stereo recording of gentle hand movement in water). The bundled MP3 is the author's high-quality preview. See public/audio/CREDITS.md.

### Pond contact revision

Playback now uses outdoor pond and lake recordings (sources and limitations in public/audio/CREDITS.md). Finger entry triggers one quiet surface break; stationary contact is silent; dragging requires accumulated travel and scales gently with speed; withdrawal plays a quiet settling tail. A 180 ms hand-tracking grace period avoids repeated entry sounds during brief occlusion. Pointer release is immediate. Body and open-palm motion affect visuals only. Fist, reset, camera stop, and mode switching cancel contact and fade voices. No synthetic tones, noise bed, pitch shifting, or perpetual splash loop. Pond impact is a small-stone recording, not a literal fingertip recording; this remains an approximation to audition.

### Continuous hand movement audio

Pointing and open-palm movement now both drive a continuous layer of overlapping outdoor lake excerpts. Removed the 650 ms drag cooldown and large travel gate. Motion controls volume with a quick attack, a 100 ms hold over direction reversals, and a short decay when still. Excerpts overlap by 300 ms at original pitch, without synthesizers or a noise wash. Body movement remains visual only. Tracking loss releases after 220 ms; fists, mute, and reset fade both audio layers.

### Touchscreen pond

Camera-off water is now a procedural teal pond with normal-based highlights and caustic patterns; no background images or camera permissions are required. Up to five independent pointer contacts push directional wakes. Two-finger rotation adds a decaying vortex. Released wakes continue moving and decay; rotation lasts a little longer. Audio uses combined finger speed so rotating around a stationary center still makes water sound. The first canvas touch attempts to unlock sound; the speaker button can mute it. Pointer cancellation, lost capture, blur, and backgrounding clear active input. Coarse-pointer controls have 44px height and horizontal overflow on narrow screens.

Phone testing: run Vite preview with --host 0.0.0.0 on the trusted local network and open the printed Network URL on a phone connected to the same Wi-Fi. Touch and audio work without camera permissions. Camera/mic generally require HTTPS on phones; localhost exceptions do not extend to LAN HTTP URLs. No public deployment is needed for touch testing.

### Phone audio and pinch correction

Canvas input now directly starts audio rather than forwarding a synthetic button click. A native touchend resumes suspended/interrupted contexts, startup failures remain retryable, and supported browsers select a playback audio session. Output gain increased moderately. Inward/outward finger separation is computed in aspect-corrected coordinates, separately from rotation, and drives a damped central mound/trough with surrounding compensation. This is an approximate shallow-water response, not a full incompressible fluid solver.

### Pond feel refinement

Reduced idle motion to make finger disturbances legible. Ripple strength now follows aspect-corrected stroke speed and is throttled per finger, so one contact no longer suppresses another. Fast strokes leave elongated downstream wakes; slow strokes make narrow disturbances. Active wake origins remain under the finger; released wakes advect in their last direction and decay. Pinch displacement is elliptical and aligned between the two fingers. Vortex phase is integrated over time rather than multiplied by absolute time, preventing reversal/jumping as rotation slows. Existing iPhone audio startup remains unchanged.

### Image sources

Photo picker decodes locally into a canvas capped at 2048px; there is no image upload endpoint. Photo/camera sources are cover-cropped under the same water shader. Camera defaults to rear/environment, front camera is mirrored, and switching stops the previous stream. On touchscreen devices, camera preview does not load hand inference. Source controls include photo selection, camera flip, and return to plain pond. Failed photo decoding keeps the previous source. Phone camera requires an HTTPS preview; the LAN HTTP address remains usable for photos and touch.
