# Pond — live water reflection

Saved component: `Pond.tox`; live path: `/project1/pond`.

## View and interact

The Pond window shows a mirrored live Logitech StreamCam image refracted through a 640 × 360 floating-point water simulation. Output is 1280 × 720 (16:9). There is no pool tile overlay. Mouse dragging pushes the surface; release lets waves propagate and decay.

For hand tracking, run `node touchdesigner/controller/server.mjs` from the repository root, open `http://127.0.0.1:5180/?mode=td-controller` in Chrome and enable the camera. Keep that tab open. The camera controller uses local MediaPipe assets and relays only normalized hand coordinates and gesture labels to UDP 127.0.0.1:9982. The browser control page is separate from the Pond output. Pointing makes small ripples; an open palm pushes a wider area; fist and stale input stop new force. Camera images use an aspect-preserving center crop, including when capture switches to 4:3. The receiver maps tracking coordinates through the same crop. Ripple-local shading and bounded refraction keep waves visible while leaving the resting reflection undistorted. Mouse input takes priority.

## Record

Click the Pond window to focus it. Press **R** to start recording; press **R** again to stop and finalize. The window title displays REC while recording; the title is not part of the recorded image. Escape stops recording before closing the window. A recording is limited to 10 minutes.

Each recording gets a unique timestamped `.mov` filename in `recordings/`. Video: 1280 × 720, 60 fps, Motion JPEG. Audio: PCM water mix. The installed Non-Commercial TD license rejects hardware H.264, so MOV is used. Files can be converted to MP4 afterward with ffmpeg or a video editor.

Verified a finalized MOV has 1280 × 720 video at 60 fps and PCM audio; a deliberate recorded water-entry test had an audio peak of -18.4 dBFS. Keyboard start/stop was tested in the actual Pond window. Recording is currently stopped.

## Audio and source

Original-speed outdoor water recordings provide a quiet contact sound, overlapping 1.2-second movement clips every 0.9 seconds, and a release tail. Stop motion to fade audio. See `assets/CREDITS.md` for CC0 sources. Toggle `speakers` Active off to mute playback; recording reads `water_mix` directly.

Shaders and Python callback source files are adjacent to the .tox and embedded in it. Loose edits must be loaded into their DATs and the .tox saved. Camera, asset and recording paths currently target this machine. Old pool photo is retained as an unused source asset.
