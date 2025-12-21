import GUI from 'lil-gui'

export const guiDebug = {
  pinch: 0,
  openness: 0.5,
  tiltX: 0,
  tiltY: 0
}

let guiVisible = true
let _gui: GUI | null = null
let toggleBtn: HTMLDivElement | null = null

function setGuiVisible(v: boolean) {
  guiVisible = v
  if (_gui) {
    const el = (_gui as any).domElement as HTMLElement
    if (el) el.style.display = guiVisible ? '' : 'none'
  }
  if (!toggleBtn) {
    toggleBtn = document.createElement('div')
    toggleBtn.id = 'gui-toggle'
    toggleBtn.textContent = 'Controls'
    toggleBtn.onclick = () => setGuiVisible(true)
    document.body.appendChild(toggleBtn)
  }
  toggleBtn.style.display = guiVisible ? 'none' : 'block'
}

export function setupGUI(opts: { 
  getEnabled: () => boolean; 
  setEnabled: (v: boolean) => void;
  onStyleChange: (key: string, value: number) => void;
  onWaterChange?: (key: string, value: any) => void;
  onWipeToggle?: (v: boolean) => void;
  onWipeReset?: () => void;
  onRainingModeToggle?: (v: boolean) => void;
  onDarkModeToggle?: (v: boolean) => void;
  initialWiping?: boolean;
}) {
  const gui = new GUI({ title: 'Controls' })
  _gui = gui

  const params = { gestures: opts.getEnabled() }
  gui.add(params, 'gestures').name('Gestures Enabled').onChange((v: boolean) => opts.setEnabled(!!v))

  if (opts.onWaterChange) {
    const waterFolder = gui.addFolder('Water Effects')
    const waterParams = {
      color: '#64c8ff',
      volume: 0
    }
    console.log('Water params initialized:', waterParams)
    waterFolder.addColor(waterParams, 'color').name('Splash Color').onChange((v: string) => opts.onWaterChange!('color', v))
    waterFolder.add(waterParams, 'volume', 0, 20, 1).name('Splash Volume').onChange((v: number) => opts.onWaterChange!('volume', v))
  }

  const styleFolder = gui.addFolder('Glass Style')
  const styleParams = {
    blur: 24,
    grain: 0.15,
    dirt: 0.0,
    rain: 0.0
  }
  
  styleFolder.add(styleParams, 'blur', 0, 60).name('Blur Amount (px)').onChange((v: number) => opts.onStyleChange('--blur-amt', v))
  styleFolder.add(styleParams, 'grain', 0, 1).name('Granularity').onChange((v: number) => opts.onStyleChange('--grain-opacity', v))
  styleFolder.add(styleParams, 'dirt', 0, 1).name('Dirtiness').onChange((v: number) => opts.onStyleChange('--dirt-opacity', v))
  styleFolder.add(styleParams, 'rain', 0, 1).name('Rain Drops').onChange((v: number) => opts.onWaterChange!('rain', v))
  
  if (opts.onRainingModeToggle) {
    styleFolder.add({ rainingMode: false }, 'rainingMode').name('Raining Mode').onChange((v: boolean) => opts.onRainingModeToggle!(v))
  }

  if (opts.onDarkModeToggle) {
    styleFolder.add({ darkMode: false }, 'darkMode').name('Dark Night Effect').onChange((v: boolean) => opts.onDarkModeToggle!(v))
  }

  const f = gui.addFolder('Debug (read-only)')
  f.add(guiDebug, 'pinch', 0, 1).listen()
  f.add(guiDebug, 'openness', 0, 1).listen()
  f.add(guiDebug, 'tiltX', -0.1, 0.1).listen()
  f.add(guiDebug, 'tiltY', -0.1, 0.1).listen()

  if (opts.onWipeToggle || opts.onWipeReset) {
    const wipeFolder = gui.addFolder('Wiping')
    const wipeParams = { wiping: !!opts.initialWiping }
    wipeFolder.add(wipeParams, 'wiping').name('Wiping Enabled').onChange((v: boolean) => opts.onWipeToggle && opts.onWipeToggle(!!v))
    if (opts.onWipeReset) {
      wipeFolder.add({ reset: () => opts.onWipeReset!() }, 'reset').name('Reset Wipe')
    }
  }

  const panelFolder = gui.addFolder('Panel')
  panelFolder.add({ hide: () => setGuiVisible(false) }, 'hide').name('Hide Controls')

  window.addEventListener('keydown', e => {
    const isG = e.code === 'KeyG' || e.key.toLowerCase() === 'g'
    if (e.shiftKey && isG) setGuiVisible(!guiVisible)
  })

  return gui
}
