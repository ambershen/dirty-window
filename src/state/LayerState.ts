export interface WindowTouchConfig {
  enabled: boolean
  difficulty: number    // 0..1 fog restoration speed
  blurAmount: number    // fog blur intensity (2..12)
}

export interface WeatherConfig {
  enabled: boolean
  rainVolume: number    // 0..1
  splashColor: string   // hex color
  splashVolume: number  // 0..20
  darkNight: boolean
  soundVolume: number   // 0..1
}

export interface DoodlingConfig {
  enabled: boolean
  brushSize: number     // 5..40
  colorIndex: number    // index into color palette
  eraserMode: boolean
}

export interface PhotoBoothConfig {
  enabled: boolean
}

export interface LayerConfigs {
  windowTouch: WindowTouchConfig
  weather: WeatherConfig
  doodling: DoodlingConfig
  photoBooth: PhotoBoothConfig
}

export type LayerKey = keyof LayerConfigs
type ChangeCallback = (key: LayerKey, config: LayerConfigs[LayerKey]) => void

export class LayerState {
  private listeners: ChangeCallback[] = []

  readonly windowTouch: WindowTouchConfig = {
    enabled: false,
    difficulty: 0.2,
    blurAmount: 6,
  }

  readonly weather: WeatherConfig = {
    enabled: false,
    rainVolume: 0.3,
    splashColor: '#64c8ff',
    splashVolume: 4,
    darkNight: false,
    soundVolume: 0,
  }

  readonly doodling: DoodlingConfig = {
    enabled: false,
    brushSize: 15,
    colorIndex: 0,
    eraserMode: false,
  }

  readonly photoBooth: PhotoBoothConfig = {
    enabled: false,
  }

  onChange(cb: ChangeCallback) {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  private emit(key: LayerKey) {
    const config = this[key]
    for (const cb of this.listeners) cb(key, config)
  }

  setEnabled(key: LayerKey, enabled: boolean) {
    (this[key] as any).enabled = enabled
    this.emit(key)
  }

  update<K extends LayerKey>(key: K, partial: Partial<LayerConfigs[K]>) {
    Object.assign(this[key], partial)
    this.emit(key)
  }

  isEnabled(key: LayerKey): boolean {
    return this[key].enabled
  }
}
