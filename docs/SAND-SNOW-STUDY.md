# Sand and snow material revision

## References studied

- Sahara sand ripple photograph: https://wibnet.nl/natuur/bodem/wat-zit-er-onder-het-zand-van-de-sahara (photo inspected for directional ridges, fine grain, asymmetric light and shadow).
- Michael Mellinger, Erg Chebbi ripples: https://www.flickr.com/photos/theworldismycanvas/3212006676 (location-confirmed Sahara reference).
- Powder snow reference: https://www.rnz.co.nz/programmes/the-science-of/story/201823489/the-science-of-snow (photo inspected for clustered crystals and soft surface relief).

Reference photographs are studied, not redistributed as project assets. Rendering is procedural. These are artistic surface models, not validated physical simulations.

## Changes

- Full-resolution WebGL grain is independent of the bounded deformation grid. Sand begins with warped wind ripples and broad height variation. Snow has smaller powder relief and crystal shading, with darker compacted interiors.
- Sand displacement and downhill relaxation conserve the modeled volume. Snow contact reduces visible height through compaction, moving 28% of the removed height to the rim as loose powder. Steep snow edges now relax downhill instead of using an empty gravity update.
- A stationary hold ramps contact load over about two seconds; moving more quickly unloads it. Pen pressure supplements dwell when available. Ordinary touch and camera input do not measure actual force.
- Snowfall includes a moving foreground flake layer, local landing deposits, and gradual coverage of compressed tracks. Turning it off stops further deposition and clears airborne flakes.
- The material camera uses one hand, 640-pixel inference, one adaptive smoothing stage, direct mirrored normalized coordinates, gesture hysteresis, and jump rejection. The previous fog adapter applied a cover crop despite having no reflected background and compared raw coordinates with cropped coordinates during hand selection. The fog scene keeps its own adapter.
- A camera preview and contact cursor expose the tracked location. Live physical accuracy still requires user testing. The in-app browser returned `Could not start video source` during this session's camera test.
- Sand sound uses a real CC0 sand-on-sand pour. A continuous middle section (8–15 seconds) is crossfaded at the loop seam, low-pass filtered, and driven by movement speed and brush area. It fades to silence when motion stops; mute and interruption cleanup are supported. See `public/audio/CREDITS.md`.

## Verification

Browser checks: visible sand ridges and granular strokes; deep held snow contact versus a shallow moving trace; visible snowfall toggle; no material runtime errors in the console. Automated calculations check volume conservation, increasing depth with dwell, similar hold depth at 30 and 60 Hz, downhill snow redistribution, snowfall coverage, and reset. TypeScript and production build checks also run.

Entry points: `?mode=sand` and `?mode=snow`.
