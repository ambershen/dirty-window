import GUI from 'lil-gui'

export const guiDebug = {
  pinch: 0,
  openness: 0.5,
  tiltX: 0,
  tiltY: 0
}

export function setupGUI(opts: { 
  getEnabled: () => boolean; 
  setEnabled: (v: boolean) => void;
  onStyleChange: (key: string, value: number) => void;
  onWaterChange?: (key: string, value: any) => void;
}) {
  const gui = new GUI({ title: 'Controls' })

  const params = { gestures: opts.getEnabled() }
  gui.add(params, 'gestures').name('Gestures Enabled').onChange((v: boolean) => opts.setEnabled(!!v))

  if (opts.onWaterChange) {
    const waterFolder = gui.addFolder('Water Effects')
    const waterParams = {
      color: '#64c8ff',
      volume: 5
    }
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

  const f = gui.addFolder('Debug (read-only)')
  f.add(guiDebug, 'pinch', 0, 1).listen()
  f.add(guiDebug, 'openness', 0, 1).listen()
  f.add(guiDebug, 'tiltX', -0.1, 0.1).listen()
  f.add(guiDebug, 'tiltY', -0.1, 0.1).listen()
}
