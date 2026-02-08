import { HandTracker } from './gestures/hand'
import { GestureRouter } from './gestures/GestureRouter'
import { LayerState } from './state/LayerState'
import { WindowTouchLayer } from './layers/WindowTouchLayer'
import { WeatherLayer } from './layers/WeatherLayer'
import { DoodleLayer } from './layers/DoodleLayer'
import { PhotoBoothLayer } from './layers/PhotoBoothLayer'
import { TuiPanel } from './ui/TuiPanel'

const video = document.getElementById('camera') as HTMLVideoElement
const banner = document.getElementById('permission-banner') as HTMLDivElement
const btn = document.getElementById('request-permission') as HTMLButtonElement

const state = new LayerState()
const hand = new HandTracker(video)

// Create layers
const windowTouch = new WindowTouchLayer(video, state)
const weather = new WeatherLayer(video, state, windowTouch.fogRenderer)
const doodle = new DoodleLayer(state)
const photoBooth = new PhotoBoothLayer(video, state, [
  () => windowTouch.getCanvas(),
  () => doodle.getCanvas(),
  () => weather.getCanvas(),
])

// Gesture routing
const router = new GestureRouter(state, windowTouch, weather, doodle)

// Sync fog visibility: show fog when windowTouch OR doodling is active
function syncFogVisibility() {
  const needsFog = state.windowTouch.enabled || state.doodling.enabled
  if (needsFog) {
    windowTouch.fogRenderer.show()
  } else {
    windowTouch.fogRenderer.hide()
  }
}

// Enable/disable layers when state changes
state.onChange((key, config) => {
  if (key === 'windowTouch') {
    // Don't hide fog directly — let syncFogVisibility handle it
    if (config.enabled) windowTouch.enable()
    else if (!state.doodling.enabled) windowTouch.disable()
    syncFogVisibility()
  } else if (key === 'weather') {
    config.enabled ? weather.enable() : weather.disable()
  } else if (key === 'doodling') {
    config.enabled ? doodle.enable() : doodle.disable()
    syncFogVisibility()
  } else if (key === 'photoBooth') {
    config.enabled ? photoBooth.enable() : photoBooth.disable()
  }
})

// TUI panel
const tui = new TuiPanel({
  state,
  photoBooth,
  weather,
  doodle,
  fogRenderer: windowTouch.fogRenderer,
  onWipeReset: () => windowTouch.fogRenderer.resetMask(),
})

async function bootstrap() {
  const ok = await hand.initCamera()
  if (!ok) {
    banner.classList.remove('hidden')
    tui.setStatus('CAMERA DENIED')
  } else {
    await hand.initLandmarker()
    banner.classList.add('hidden')
    tui.setStatus('SYSTEM READY')
  }

  btn.addEventListener('click', async () => {
    const granted = await hand.initCamera()
    if (granted) {
      banner.classList.add('hidden')
      await hand.initLandmarker()
      tui.setStatus('SYSTEM READY')
    }
  })

  window.addEventListener('resize', () => {
    windowTouch.resize()
    weather.resize()
    doodle.resize()
  })

  loop()
}

function loop() {
  const now = performance.now()
  hand.update(now)

  // Dispatch gestures to active layers
  if (hand.hands.length > 0) {
    router.dispatch(hand.hands, now)
  } else {
    // No hands detected: stop doodle stroke
    doodle.stopStroke()
    windowTouch.trimPrev(0)
  }

  // Update each active layer
  windowTouch.update(now, hand.hands)
  weather.update(now, hand.hands)
  doodle.update(now, hand.hands)
  photoBooth.update(now, hand.hands)

  requestAnimationFrame(loop)
}

bootstrap()
