import type { Layer } from './Layer'
import type { GestureFeatures } from '../gestures/hand'
import type { LayerState } from '../state/LayerState'
import type { FogRenderer } from '../effects/FogRenderer'
import { WaterEffects } from '../effects/WaterEffects'
import { RainSound } from '../audio/SoundManager'

export class WeatherLayer implements Layer {
  readonly id = 'weather'
  private waterEffects: WaterEffects
  private rainSound: RainSound
  private state: LayerState
  private video: HTMLVideoElement

  constructor(video: HTMLVideoElement, state: LayerState, fogRenderer: FogRenderer) {
    this.video = video
    this.state = state
    this.waterEffects = new WaterEffects()
    this.waterEffects.appendTo(document.body)
    this.waterEffects.setFogRenderer(fogRenderer)
    this.waterEffects.hide()
    this.rainSound = new RainSound()
  }

  enable() {
    this.waterEffects.show()
    this.syncConfig()
  }

  disable() {
    this.waterEffects.hide()
    this.rainSound.stop()
    this.setDarkNight(false)
  }

  syncConfig() {
    const cfg = this.state.weather
    this.waterEffects.rainVolume = cfg.rainVolume
    this.waterEffects.splashColor = cfg.splashColor
    this.waterEffects.splashVolume = cfg.splashVolume
    this.rainSound.setVolume(cfg.soundVolume)
    this.setDarkNight(cfg.darkNight)
  }

  handleSplash(cx: number, cy: number) {
    this.waterEffects.emitSplash(cx, cy)
  }

  private setDarkNight(on: boolean) {
    this.video.style.filter = on ? 'brightness(0.4) saturate(0.5)' : ''
  }

  update(now: number, hands: GestureFeatures[]) {
    if (!this.state.weather.enabled) return
    this.waterEffects.update()
  }

  resize() {
    this.waterEffects.resize()
  }

  destroy() {
    this.waterEffects.hide()
    this.rainSound.stop()
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.waterEffects.getCanvas()
  }
}
