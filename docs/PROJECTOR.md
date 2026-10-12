# Pond — wall prototype

## Run

`npm ci`, `npm run build`, then `npm run preview -- --host 127.0.0.1 --port 5174`.
Open http://127.0.0.1:5174/?mode=projector in Chrome.

1. Connect the projector as an extended Mac display.
2. Click Open projector window. Move that window onto the projector and click Enter projection.
3. Keep the controller visible on the Mac, in the same browser profile and origin as the output.
4. Click Start camera and allow local camera access. Aim the camera toward the participant.
5. Click Enable sound. Sound plays from the controller through the Mac's selected audio output.
6. Adjust hand reach, horizontal/vertical alignment and mirror direction for the participant's position.

The pad supports mouse dragging without a camera. Point for small ripples, open the palm for broader waves, and make a fist to stop new input. Lost input expires after 300 ms. Downward flow adds short accelerating water trails after a gesture; this is a stylized gravity effect, not a fluid dynamics solver. Settle water clears active waves and trails. Esc exits fullscreen.

## Architecture

This first projector version is browser based and reuses the accepted mobile WaterSurface and recorded water soundscape. It does not require TouchDesigner. The existing TouchDesigner prototype remains separate and unchanged. BroadcastChannel sends gesture coordinates between same-origin windows on one computer; it is not a phone remote or network relay. Video stays in the controller; it is not projected or uploaded. MediaPipe model/WASM files are served locally from public.

Alignment controls map air gestures into the image; they do not detect actual wall contact or correct projector keystone. Use the projector's own geometry controls for a rectangular image.

## Verification and remaining physical checks

TypeScript and production build pass. Browser output renders the pool, the popup opens, and the controller receives output heartbeats. Mouse input path exercised. Camera startup timed out during automated testing; successful live hand tracking in this new mode has not yet been verified. Check camera permission/device availability from the visible controller. Test hand alignment, gesture latency, audio routing and shadows with the actual projector before presenting this as a finished installation.

The accepted mobile checkpoint remains checkpoints/pond-mobile-study-01-2026-10-06.tar.gz. Open the default route for mobile touch, or ?background=pool to force the pool image.
