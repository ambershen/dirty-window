import { ThreeApp } from './three/scene'
import { HandTracker } from './gestures/hand'
import { mapFeaturesToMaterial, mapTiltToRotation } from './gestures/mapping'
import { setupGUI, guiDebug } from './ui/gui'
import { WaterEffects } from './effects/WaterEffects'

const video = document.getElementById('camera') as HTMLVideoElement
const banner = document.getElementById('permission-banner') as HTMLDivElement
const btn = document.getElementById('request-permission') as HTMLButtonElement
const frostedGlass = document.getElementById('frosted-glass') as HTMLDivElement

const TRAIL_LENGTH = 12
const trail: { x: number; y: number; r: number }[] = Array(TRAIL_LENGTH).fill({ x: -200, y: -200, r: 0 })

const app = new ThreeApp()
const hand = new HandTracker(video)
const waterEffects = new WaterEffects()

let gesturesEnabled = false

async function bootstrap() {
  await app.initEnv()

  // Attempt to auto-start camera; fall back to banner on failure
  const ok = await hand.initCamera()
  if (!ok) {
    banner.classList.remove('hidden')
  } else {
    await hand.initLandmarker()
    gesturesEnabled = true
  }

  btn.addEventListener('click', async () => {
    const granted = await hand.initCamera()
    if (granted) {
      banner.classList.add('hidden')
      await hand.initLandmarker()
      gesturesEnabled = true
    }
  })

  setupGUI({
    getEnabled: () => gesturesEnabled,
    setEnabled: v => { gesturesEnabled = v },
    onStyleChange: (key, value) => {
      const suffix = key === '--blur-amt' ? 'px' : ''
      frostedGlass.style.setProperty(key, `${value}${suffix}`)
    },
    onWaterChange: (key, value) => {
      if (key === 'color') {
        waterEffects.splashColor = value
      } else if (key === 'volume') {
        waterEffects.splashVolume = value
      } else if (key === 'rain') {
        waterEffects.rainVolume = value
      }
    }
  })

  loop()
}

function loop() {
  const now = performance.now()
  waterEffects.update()
  
  if (gesturesEnabled) {
    hand.update(now)
    
    if (hand.hands.length > 0) {
      const h1 = hand.hands[0]
      const mat = mapFeaturesToMaterial(h1)
      app.updateGlass(mat)
      const { dx, dy } = mapTiltToRotation(h1)
      app.rotate(dx, dy)
      guiDebug.pinch = h1.pinch
      guiDebug.openness = h1.openness
      guiDebug.tiltX = h1.tiltX
      guiDebug.tiltY = h1.tiltY

      // Update frosted glass clear spot 1
      const cx = h1.x * window.innerWidth
      const cy = h1.y * window.innerHeight
      
      // Water Splash Effect (Hand Open)
      // Lowered threshold to 0.4 for easier triggering
      if (h1.openness > 0.4) {
        waterEffects.emitSplash(cx, cy)
      }

      // Ripple Effect (Pinch)
      // Lowered threshold to 0.5 for easier triggering
      if (h1.pinch > 0.5) {
        waterEffects.emitRipple(cx, cy, now)
      }
      
      // Map openness to radius (20px to 100px)
      const r = 20 + h1.openness * 80

      // Update trail
      trail.pop()
      trail.unshift({ x: cx, y: cy, r })
      
      trail.forEach((pos, i) => {
        frostedGlass.style.setProperty(`--tx-${i}`, `${pos.x}px`)
        frostedGlass.style.setProperty(`--ty-${i}`, `${pos.y}px`)
        
        // Tapering: decrease size by 5% per step
        const taper = Math.max(0, 1 - i * 0.05)
        const displayR = pos.r * taper
        const edge = displayR + 80

        frostedGlass.style.setProperty(`--tr-${i}`, `${displayR}px`)
        frostedGlass.style.setProperty(`--te-${i}`, `${edge}px`)
      })
    }

    // Update frosted glass clear spot 2
    if (hand.hands.length > 1) {
      const h2 = hand.hands[1]
      const cx2 = h2.x * window.innerWidth
      const cy2 = h2.y * window.innerHeight
      frostedGlass.style.setProperty('--x2', `${cx2}px`)
      frostedGlass.style.setProperty('--y2', `${cy2}px`)
    } else {
      frostedGlass.style.setProperty('--x2', '-200px')
      frostedGlass.style.setProperty('--y2', '-200px')
    }
  }
  app.render()
  requestAnimationFrame(loop)
}

bootstrap()
