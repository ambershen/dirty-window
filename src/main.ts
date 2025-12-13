import { ThreeApp } from './three/scene'
import { HandTracker } from './gestures/hand'
import { mapFeaturesToMaterial, mapTiltToRotation } from './gestures/mapping'
import { setupGUI, guiDebug } from './ui/gui'
import { WaterEffects } from './effects/WaterEffects'
import { WipeMask } from './effects/WipeMask'

const video = document.getElementById('camera') as HTMLVideoElement
const banner = document.getElementById('permission-banner') as HTMLDivElement
const btn = document.getElementById('request-permission') as HTMLButtonElement
const frostedGlass = document.getElementById('frosted-glass') as HTMLDivElement

// Popup elements
const wipePopup = document.getElementById('wipe-popup') as HTMLDivElement
const wipeYesBtn = document.getElementById('wipe-yes') as HTMLButtonElement
const wipeNoBtn = document.getElementById('wipe-no') as HTMLButtonElement
const backBtn = document.getElementById('back-button') as HTMLButtonElement

const TRAIL_LENGTH = 12
const trail: { x: number; y: number; r: number }[] = Array(TRAIL_LENGTH).fill({ x: -200, y: -200, r: 0 })

const app = new ThreeApp()
const hand = new HandTracker(video)
const waterEffects = new WaterEffects()
const wipeMask = new WipeMask(window.innerWidth, window.innerHeight)

let gesturesEnabled = false
let wipingEnabled = false
let lastWipeApply = 0
let guiInstance: any = null // Keep track of GUI instance to update it

const prevPos: { x: number; y: number }[] = [{ x: -1, y: -1 }, { x: -1, y: -1 }]

async function waitForWipeChoice(): Promise<boolean> {
  return new Promise(resolve => {
    const cleanup = () => {
      wipePopup.classList.add('hidden')
      wipeYesBtn.removeEventListener('click', onYes)
      wipeNoBtn.removeEventListener('click', onNo)
    }
    const onYes = () => {
      cleanup()
      resolve(true)
    }
    const onNo = () => {
      cleanup()
      resolve(false)
    }
    wipeYesBtn.addEventListener('click', onYes)
    wipeNoBtn.addEventListener('click', onNo)
  })
}

function updateWipeState(isWiping: boolean) {
  wipingEnabled = isWiping
  wipeMask.clear()
  if (wipingEnabled) {
    wipeMask.applyTo(frostedGlass)
  } else {
    wipeMask.removeFrom(frostedGlass)
  }
  // Try to update GUI if it exists
  if (guiInstance) {
    // This is a bit of a hack to find the controller and update it
    // In a real app we might want to expose the controller cleaner
    try {
      const folders = guiInstance.folders
      const wipingFolder = folders.find((f: any) => f._title === 'Wiping')
      if (wipingFolder) {
        const wipingCtrl = wipingFolder.controllers.find((c: any) => c.property === 'wiping')
        if (wipingCtrl) wipingCtrl.setValue(wipingEnabled)
      }
    } catch (e) {
      console.warn('Could not update GUI', e)
    }
  }
}

async function bootstrap() {
  await app.initEnv()
  
  // Show popup and wait for choice
  wipePopup.classList.remove('hidden')
  backBtn.classList.add('hidden')
  
  const wantWipe = await waitForWipeChoice()
  wipingEnabled = wantWipe

  // Show back button once mode is selected
  backBtn.classList.remove('hidden')
  backBtn.addEventListener('click', () => {
    // Reset state and show popup again
    backBtn.classList.add('hidden')
    wipePopup.classList.remove('hidden')
    
    // Clear mask completely (so it looks like a fresh start)
    wipeMask.clear()
    wipeMask.removeFrom(frostedGlass)

    waitForWipeChoice().then(newChoice => {
      updateWipeState(newChoice)
      backBtn.classList.remove('hidden')
    })
  })

  if (wipingEnabled) {
    wipeMask.applyTo(frostedGlass)
  }

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

  guiInstance = setupGUI({
    getEnabled: () => gesturesEnabled,
    setEnabled: v => { gesturesEnabled = v },
    initialWiping: wipingEnabled,
    onStyleChange: (key, value) => {
      const suffix = key === '--blur-amt' ? 'px' : ''
      frostedGlass.style.setProperty(key, `${value}${suffix}`)
      if (key === '--dirt-opacity') {
        wipeMask.setDifficulty(Number(value))
      }
    },
    onWaterChange: (key, value) => {
      if (key === 'color') {
        waterEffects.splashColor = value
      } else if (key === 'volume') {
        waterEffects.splashVolume = value
      } else if (key === 'rain') {
        waterEffects.rainVolume = value
      }
    },
    onWipeToggle: v => {
      wipingEnabled = !!v
      wipeMask.clear()
      if (wipingEnabled) {
        wipeMask.applyTo(frostedGlass)
      } else {
        wipeMask.removeFrom(frostedGlass)
      }
    },
    onWipeReset: () => {
      wipeMask.clear()
      if (wipingEnabled) wipeMask.applyTo(frostedGlass)
    }
  })

  window.addEventListener('resize', () => {
    wipeMask.resize(window.innerWidth, window.innerHeight)
    if (wipingEnabled) wipeMask.applyTo(frostedGlass)
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
      
      const cx = h1.x * window.innerWidth
      const cy = h1.y * window.innerHeight
      
      if (h1.openness > 0.4) {
        waterEffects.emitSplash(cx, cy)
      }

      if (!wipingEnabled && h1.pinch > 0.5) {
        waterEffects.emitRipple(cx, cy, now)
      }
      
      const r = 20 + h1.openness * 80

      if (!wipingEnabled) {
        trail.pop()
        trail.unshift({ x: cx, y: cy, r })
        trail.forEach((pos, i) => {
          frostedGlass.style.setProperty(`--tx-${i}`, `${pos.x}px`)
          frostedGlass.style.setProperty(`--ty-${i}`, `${pos.y}px`)
          const taper = Math.max(0, 1 - i * 0.05)
          const displayR = pos.r * taper
          const edge = displayR + 80
          frostedGlass.style.setProperty(`--tr-${i}`, `${displayR}px`)
          frostedGlass.style.setProperty(`--te-${i}`, `${edge}px`)
        })
      }
    }

    if (!wipingEnabled) {
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

    if (wipingEnabled) {
      const count = Math.min(2, hand.hands.length)
      let moved = false
      for (let i = 0; i < count; i++) {
        const h = hand.hands[i]
        const x = h.x * window.innerWidth
        const y = h.y * window.innerHeight
        const r = 30 + h.openness * 120
        const p = prevPos[i]
        const dx = p.x < 0 ? 0 : x - p.x
        const dy = p.y < 0 ? 0 : y - p.y
        const dist = Math.hypot(dx, dy)
        const speedNorm = Math.min(1, dist / 600)
        const movementBoost = Math.max(speedNorm, h.openness)
        const alpha = Math.max(0.05, Math.min(0.95, 0.4 + 0.6 * movementBoost))
        wipeMask.eraseBlob(x, y, r, alpha)
        prevPos[i] = { x, y }
        if (dist > 3) moved = true
      }
      const applyInterval = 120
      if (moved || now - lastWipeApply > applyInterval) {
        wipeMask.applyTo(frostedGlass)
        lastWipeApply = now
      }
    }
  }
  app.render()
  requestAnimationFrame(loop)
}

bootstrap()
