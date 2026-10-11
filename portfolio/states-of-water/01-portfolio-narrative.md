# States of Water
## An interactive study of natural materials

What happens when a screen responds to your hand like water, ice, or a fogged window?

The project began with familiar effects from the natural world: drawing on a winter car window, watching moisture gather, and seeing a mark gradually lose its shape. These small experiences carry expectations about movement, texture, and time. I began translating them into creative coding experiments, exploring how a digital surface could respond to the same gestures.

*[Opening video — a personal observation of drawing on a fogged window and watching the trace change.]*

### Material studies

**Water — sound as part of movement**

Water explores gesture-driven sound synthesis alongside ripples and wakes. A fingertip and an open hand suggest different scales of contact, shaping both movement and its sonic character. Propagation, damping, and gesture-to-sound mappings become ways to explore continuity: how water responds to a sustained movement, changes direction, and settles after release.

*[Water demo — fingertip versus open-hand interaction, continuous movement, and synchronized sound.]*

**Ice — weight, resistance, and accumulation**

Ice explores how touch can suggest weight and resistance. Slow rubbing accumulates faint traces; sustained contact and two-finger compression build simulated load, spreading irregular cracks and triggering sound. Duration and movement act as proxies for pressure, exploring how the weight of a hand on physical ice can be translated into screen-based interaction. Mark visibility, fracture growth, and sound together shape the sense of a surface resisting and yielding.

*[Ice demo — light sliding, repeated rubbing, and compression with fracture sounds.]*

**Condensation — a temporary storytelling surface**

My initial *Dirty Window* experiments explored adding water, changing dirtiness, and requiring more persistent swiping to reveal what lay beneath. Condensation extends this into a temporary drawing board: gestures clear marks, while droplets and returning moisture gradually reshape them. Local changes in wetness and visibility give each trace a changing lifespan. Effort, revelation, and disappearance become ways to reveal an image, leave a message, or tell a story.

*[Condensation demo — drawing a temporary mark and its changing surface; earlier Dirty Window controls shown as a separate archival clip.]*

### From experiments to skills and tools

Each material develops through a cycle of observation, coding, interaction, and revision. I translate the decisions that emerge into reusable **skills**: structured instructions that capture a material's behavior, useful implementation patterns, sound mappings, and ways to check the result. The ice study is the first documented skill, preserving lessons such as faint friction writing, irregular pressure-driven fractures, and restrained, event-based sound.

These skills guide further development; reusable code modules implement the behaviors. The current prototypes contain separate components for hand tracking, water response, ice writing, fracture growth, and audio. I am working toward tools that expose their meaningful controls—propagation, resistance, accumulation, gravity-driven motion, recovery, and sound—so that a new experience can be composed from those behaviors.

A proposed material editor would let a creator replay the same gesture, adjust these controls, compare responses, and save a **material recipe**. Skills would carry the reasoning behind the simulation; tools would make it possible to explore and reshape the response. Together, they could support different interpretations of a natural experience across surfaces and input methods.

*[Process visual — observation → experiment → documented skill → behavior module → proposed material editor. Label existing components and future tools.]*

### Projection

The app currently offers desktop and touchpad interaction, alongside touchscreen experiences. Next, I want to develop a projection experience: bringing these materials onto a wall and exploring how scale, camera-tracked gestures, and body movement change the interaction.

*[Projection placeholder — future setup and interaction demo.]*

### Implementation

TypeScript · Canvas 2D / WebGL · MediaPipe hand tracking · Web Audio with sample-based sound synthesis · Pointer and touchscreen input. TouchDesigner supports a separate projection and reflection prototype.
