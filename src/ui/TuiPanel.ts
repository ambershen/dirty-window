import type { LayerState, LayerKey } from '../state/LayerState'
import type { PhotoBoothLayer } from '../layers/PhotoBoothLayer'
import type { WeatherLayer } from '../layers/WeatherLayer'
import type { DoodleLayer } from '../layers/DoodleLayer'
import type { FogRenderer } from '../effects/FogRenderer'

interface TuiDeps {
  state: LayerState
  photoBooth: PhotoBoothLayer
  weather: WeatherLayer
  doodle: DoodleLayer
  fogRenderer: FogRenderer
  onWipeReset: () => void
}

type PanelPosition = 'right' | 'left' | 'top'
const POSITIONS: PanelPosition[] = ['right', 'left', 'top']

export class TuiPanel {
  private panel: HTMLDivElement
  private tab: HTMLDivElement
  private visible = true
  private deps: TuiDeps
  private statusEl!: HTMLSpanElement
  private position: PanelPosition = 'right'

  constructor(deps: TuiDeps) {
    this.deps = deps

    // Create panel toggle tab
    this.tab = document.createElement('div')
    this.tab.className = 'tui-tab tui-tab-hidden tui-tab-right'
    this.tab.textContent = 'CTRL'
    this.tab.onclick = () => this.show()
    document.body.appendChild(this.tab)

    // Create main panel
    this.panel = document.createElement('div')
    this.panel.className = 'tui-panel tui-pos-right'
    this.panel.innerHTML = '<div class="tui-scanlines"></div>'

    const content = document.createElement('div')
    content.className = 'tui-content'
    this.panel.appendChild(content)

    // Header
    content.appendChild(this.buildHeader())

    // Layer sections
    const layers = document.createElement('div')
    layers.className = 'tui-layers'
    layers.appendChild(this.buildWindowTouchSection())
    layers.appendChild(this.buildWeatherSection())
    layers.appendChild(this.buildDoodleSection())
    layers.appendChild(this.buildPhotoBoothSection())
    content.appendChild(layers)

    // Footer
    this.panel.appendChild(this.buildFooter())

    document.body.appendChild(this.panel)

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (deps.state.doodling.enabled && deps.doodle.drawingCanvas.undo()) {
          this.setStatus('UNDO')
        }
        return
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (deps.state.doodling.enabled && deps.doodle.drawingCanvas.redo()) {
          this.setStatus('REDO')
        }
        return
      }

      if (e.key === 'h' || e.key === 'H') {
        if (this.visible) this.hide(); else this.show()
      }
      if (e.key === 'p' || e.key === 'P') this.cyclePosition()
      if (e.key === '1') this.toggleLayer('windowTouch')
      if (e.key === '2') this.toggleLayer('weather')
      if (e.key === '3') this.toggleLayer('doodling')
      if (e.key === '4') this.toggleLayer('photoBooth')

      // Eraser toggle: E key
      if (e.key === 'e' || e.key === 'E') {
        if (deps.state.doodling.enabled) {
          const on = deps.doodle.drawingCanvas.toggleEraser()
          deps.state.update('doodling', { eraserMode: on })
          this.setStatus(on ? 'ERASER ON' : 'ERASER OFF')
        }
      }
    })

    // Listen for state changes
    deps.state.onChange((key) => {
      this.syncToggle(key)
    })
  }

  private buildHeader(): HTMLDivElement {
    const header = document.createElement('div')
    header.className = 'tui-header'

    const title = document.createElement('pre')
    title.className = 'tui-title'
    title.textContent =
` ┌────────────────────────┐
 │   GLASS EFFECT  v2.0   │
 │   ════════════════════  │
 └────────────────────────┘`
    header.appendChild(title)

    const status = document.createElement('div')
    status.className = 'tui-status-bar'
    const blink = document.createElement('span')
    blink.className = 'tui-blink'
    blink.textContent = '█'
    this.statusEl = document.createElement('span')
    this.statusEl.textContent = ' SYSTEM READY'
    status.appendChild(blink)
    status.appendChild(this.statusEl)
    header.appendChild(status)

    return header
  }

  setStatus(text: string) {
    this.statusEl.textContent = ' ' + text
  }

  // ── Window Touch Section ─────────────────
  private buildWindowTouchSection(): HTMLDivElement {
    const { state } = this.deps
    return this.buildLayerSection('windowTouch', 'WINDOW TOUCH', '1', (controls) => {
      // Dirtiness — how grimy the window looks (maps to fog difficulty)
      controls.appendChild(this.sliderRow('DIRTINESS', 0, 1, 0.01, state.windowTouch.difficulty, (v) => {
        state.update('windowTouch', { difficulty: v })
      }))

      // Restore Speed
      controls.appendChild(this.sliderRow('RESTORE', 0, 1, 0.01, state.windowTouch.difficulty, (v) => {
        state.update('windowTouch', { difficulty: v })
      }))

      // Reset button
      const btnRow = document.createElement('div')
      btnRow.className = 'tui-control-row'
      const resetBtn = document.createElement('button')
      resetBtn.className = 'tui-btn'
      resetBtn.textContent = '[ RESET FOG ]'
      resetBtn.onclick = () => {
        this.deps.onWipeReset()
        this.setStatus('FOG RESET')
      }
      btnRow.appendChild(resetBtn)
      controls.appendChild(btnRow)
    })
  }

  // ── Weather Section ──────────────────────
  private buildWeatherSection(): HTMLDivElement {
    const { state, weather } = this.deps
    return this.buildLayerSection('weather', 'WEATHER FX', '2', (controls) => {
      // Rain Intensity
      controls.appendChild(this.sliderRow('RAIN', 0, 1, 0.01, state.weather.rainVolume, (v) => {
        state.update('weather', { rainVolume: v })
        weather.syncConfig()
      }))

      // Splash Volume
      controls.appendChild(this.sliderRow('SPLASH', 0, 20, 1, state.weather.splashVolume, (v) => {
        state.update('weather', { splashVolume: v })
        weather.syncConfig()
      }))

      // Sound Volume
      controls.appendChild(this.sliderRow('SOUND', 0, 1, 0.01, state.weather.soundVolume, (v) => {
        state.update('weather', { soundVolume: v })
        weather.syncConfig()
      }))

      // Dark Night Toggle
      const darkRow = document.createElement('div')
      darkRow.className = 'tui-control-row'
      const darkLabel = document.createElement('span')
      darkLabel.className = 'tui-label'
      darkLabel.textContent = 'DARK NIGHT'
      const darkBtn = document.createElement('button')
      darkBtn.className = 'tui-sub-toggle'
      darkBtn.dataset.active = String(state.weather.darkNight)
      darkBtn.textContent = state.weather.darkNight ? '[X]' : '[ ]'
      darkBtn.onclick = () => {
        const next = !state.weather.darkNight
        state.update('weather', { darkNight: next })
        darkBtn.dataset.active = String(next)
        darkBtn.textContent = next ? '[X]' : '[ ]'
        weather.syncConfig()
      }
      darkRow.appendChild(darkLabel)
      darkRow.appendChild(darkBtn)
      controls.appendChild(darkRow)
    })
  }

  // ── Doodle Section ───────────────────────
  private buildDoodleSection(): HTMLDivElement {
    const { state, doodle } = this.deps
    const canvas = doodle.drawingCanvas

    return this.buildLayerSection('doodling', 'DOODLING', '3', (controls) => {
      // Glass Dirtiness — controls fog opacity while doodling
      controls.appendChild(this.sliderRow('DIRTINESS', 0, 1, 0.01, state.windowTouch.difficulty, (v) => {
        state.update('windowTouch', { difficulty: v })
      }))

      // Reset fog button
      const resetRow = document.createElement('div')
      resetRow.className = 'tui-control-row'
      const resetBtn = document.createElement('button')
      resetBtn.className = 'tui-btn'
      resetBtn.textContent = '[ RESET FOG ]'
      resetBtn.onclick = () => {
        this.deps.fogRenderer.resetMask()
        this.setStatus('FOG RESET')
      }
      resetRow.appendChild(resetBtn)
      controls.appendChild(resetRow)

      // Brush Size
      controls.appendChild(this.sliderRow('BRUSH', 5, 40, 1, state.doodling.brushSize, (v) => {
        state.update('doodling', { brushSize: v })
        canvas.brushSize = v
      }))

      // Eraser toggle
      const eraserRow = document.createElement('div')
      eraserRow.className = 'tui-control-row'
      const eraserLabel = document.createElement('span')
      eraserLabel.className = 'tui-label'
      eraserLabel.textContent = 'ERASER'
      const eraserBtn = document.createElement('button')
      eraserBtn.className = 'tui-sub-toggle'
      eraserBtn.dataset.active = 'false'
      eraserBtn.textContent = '[ ]'
      eraserBtn.onclick = () => {
        const on = canvas.toggleEraser()
        eraserBtn.dataset.active = String(on)
        eraserBtn.textContent = on ? '[X]' : '[ ]'
        state.update('doodling', { eraserMode: on })
        this.setStatus(on ? 'ERASER ON' : 'ERASER OFF')
      }
      eraserRow.appendChild(eraserLabel)
      eraserRow.appendChild(eraserBtn)
      controls.appendChild(eraserRow)

      // Color display + next button
      const colorRow = document.createElement('div')
      colorRow.className = 'tui-control-row'
      const colorLabel = document.createElement('span')
      colorLabel.className = 'tui-label'
      colorLabel.textContent = 'COLOR'

      const colorDot = document.createElement('span')
      colorDot.className = 'tui-color-dot'
      colorDot.style.backgroundColor = canvas.getColor()
      colorDot.style.color = canvas.getColor()

      const colorName = document.createElement('span')
      colorName.className = 'tui-value'
      colorName.textContent = canvas.getColorName()
      colorName.style.minWidth = '48px'
      colorName.style.textAlign = 'left'

      const nextBtn = document.createElement('button')
      nextBtn.className = 'tui-btn'
      nextBtn.textContent = 'NEXT'
      nextBtn.onclick = () => {
        const result = canvas.setNextColor()
        colorDot.style.backgroundColor = result.color
        colorDot.style.color = result.color
        colorName.textContent = result.name
        state.update('doodling', { colorIndex: canvas.colorIndex })
      }

      colorRow.appendChild(colorLabel)
      colorRow.appendChild(colorDot)
      colorRow.appendChild(colorName)
      colorRow.appendChild(nextBtn)
      controls.appendChild(colorRow)

      // Undo / Redo row
      const undoRow = document.createElement('div')
      undoRow.className = 'tui-btn-row'
      const undoBtn = document.createElement('button')
      undoBtn.className = 'tui-btn'
      undoBtn.textContent = '[ UNDO ]'
      undoBtn.onclick = () => {
        if (canvas.undo()) this.setStatus('UNDO')
        else this.setStatus('NOTHING TO UNDO')
      }
      const redoBtn = document.createElement('button')
      redoBtn.className = 'tui-btn'
      redoBtn.textContent = '[ REDO ]'
      redoBtn.onclick = () => {
        if (canvas.redo()) this.setStatus('REDO')
        else this.setStatus('NOTHING TO REDO')
      }
      undoRow.appendChild(undoBtn)
      undoRow.appendChild(redoBtn)
      controls.appendChild(undoRow)

      // Clear button
      const clearRow = document.createElement('div')
      clearRow.className = 'tui-control-row'
      const clearBtn = document.createElement('button')
      clearBtn.className = 'tui-btn tui-btn-accent'
      clearBtn.textContent = '[ CLEAR CANVAS ]'
      clearBtn.onclick = () => {
        canvas.clear()
        this.setStatus('CANVAS CLEARED')
      }
      clearRow.appendChild(clearBtn)
      controls.appendChild(clearRow)

      // Sync TUI controls when state changes from gestures
      const brushSlider = controls.querySelector('.tui-slider') as HTMLInputElement | null
      const brushValue = controls.querySelector('.tui-value') as HTMLSpanElement | null
      state.onChange((key) => {
        if (key === 'doodling') {
          if (brushSlider && brushValue) {
            brushSlider.value = String(state.doodling.brushSize)
            brushValue.textContent = String(state.doodling.brushSize)
          }
          canvas.setColorIndex(state.doodling.colorIndex)
          colorDot.style.backgroundColor = canvas.getColor()
          colorDot.style.color = canvas.getColor()
          colorName.textContent = canvas.getColorName()
          canvas.brushSize = state.doodling.brushSize
          canvas.eraserMode = state.doodling.eraserMode
          eraserBtn.dataset.active = String(state.doodling.eraserMode)
          eraserBtn.textContent = state.doodling.eraserMode ? '[X]' : '[ ]'
        }
      })
    })
  }

  // ── Photo Booth Section ──────────────────
  private buildPhotoBoothSection(): HTMLDivElement {
    const { state, photoBooth } = this.deps

    return this.buildLayerSection('photoBooth', 'PHOTO BOOTH', '4', (controls) => {
      // Timer selector
      const timerRow = document.createElement('div')
      timerRow.className = 'tui-control-row'
      const timerLabel = document.createElement('span')
      timerLabel.className = 'tui-label'
      timerLabel.textContent = 'TIMER'
      const timerGroup = document.createElement('div')
      timerGroup.className = 'tui-radio-group'
      let selectedTimer = 3
      for (const val of [0, 3, 5]) {
        const btn = document.createElement('button')
        btn.className = 'tui-radio' + (val === selectedTimer ? ' tui-selected' : '')
        btn.textContent = val === 0 ? 'OFF' : `${val}s`
        btn.onclick = () => {
          selectedTimer = val
          timerGroup.querySelectorAll('.tui-radio').forEach(b => b.classList.remove('tui-selected'))
          btn.classList.add('tui-selected')
        }
        timerGroup.appendChild(btn)
      }
      timerRow.appendChild(timerLabel)
      timerRow.appendChild(timerGroup)
      controls.appendChild(timerRow)

      // Take Photo button
      const photoRow = document.createElement('div')
      photoRow.className = 'tui-btn-row'
      const photoBtn = document.createElement('button')
      photoBtn.className = 'tui-btn'
      photoBtn.textContent = '[ TAKE PHOTO ]'
      photoBtn.onclick = () => {
        this.setStatus('CAPTURING...')
        photoBooth.takePhoto(selectedTimer).then(() => {
          this.setStatus('PHOTO SAVED')
        })
      }
      photoRow.appendChild(photoBtn)
      controls.appendChild(photoRow)

      // Record buttons
      const recRow = document.createElement('div')
      recRow.className = 'tui-btn-row'
      const startRecBtn = document.createElement('button')
      startRecBtn.className = 'tui-btn'
      startRecBtn.textContent = '[ REC START ]'

      const stopRecBtn = document.createElement('button')
      stopRecBtn.className = 'tui-btn tui-btn-accent'
      stopRecBtn.textContent = '[ REC STOP ]'
      stopRecBtn.style.display = 'none'

      const recIndicator = document.createElement('span')
      recIndicator.className = 'tui-rec'
      recIndicator.textContent = ''

      startRecBtn.onclick = () => {
        photoBooth.startRecording()
        startRecBtn.style.display = 'none'
        stopRecBtn.style.display = ''
        recIndicator.textContent = ' ● REC'
        this.setStatus('RECORDING...')
      }

      stopRecBtn.onclick = () => {
        photoBooth.stopRecording()
        stopRecBtn.style.display = 'none'
        startRecBtn.style.display = ''
        recIndicator.textContent = ''
        this.setStatus('VIDEO SAVED')
      }

      recRow.appendChild(startRecBtn)
      recRow.appendChild(stopRecBtn)
      recRow.appendChild(recIndicator)
      controls.appendChild(recRow)
    })
  }

  // ── Helpers ──────────────────────────────

  private buildLayerSection(
    key: LayerKey,
    name: string,
    hotkey: string,
    buildControls: (container: HTMLDivElement) => void
  ): HTMLDivElement {
    const section = document.createElement('div')
    section.className = 'tui-layer'
    section.dataset.layer = key

    const header = document.createElement('div')
    header.className = 'tui-layer-header'

    const toggle = document.createElement('button')
    toggle.className = 'tui-toggle'
    toggle.dataset.active = String(this.deps.state[key].enabled)
    toggle.textContent = this.deps.state[key].enabled ? '[X]' : '[ ]'

    const nameEl = document.createElement('span')
    nameEl.className = 'tui-layer-name'
    nameEl.textContent = `> ${name}`

    const keyEl = document.createElement('span')
    keyEl.className = 'tui-layer-key'
    keyEl.textContent = hotkey

    header.appendChild(toggle)
    header.appendChild(nameEl)
    header.appendChild(keyEl)

    const controls = document.createElement('div')
    controls.className = 'tui-layer-controls'
    buildControls(controls)

    header.onclick = () => {
      this.toggleLayer(key)
    }

    section.appendChild(header)
    section.appendChild(controls)

    return section
  }

  private toggleLayer(key: LayerKey) {
    const enabled = !this.deps.state[key].enabled
    this.deps.state.setEnabled(key, enabled)
  }

  private syncToggle(key: LayerKey) {
    const section = this.panel.querySelector(`[data-layer="${key}"]`)
    if (!section) return
    const enabled = this.deps.state[key].enabled
    const toggle = section.querySelector('.tui-toggle') as HTMLButtonElement
    const controls = section.querySelector('.tui-layer-controls') as HTMLDivElement
    if (toggle) {
      toggle.dataset.active = String(enabled)
      toggle.textContent = enabled ? '[X]' : '[ ]'
    }
    if (controls) {
      controls.classList.toggle('tui-expanded', enabled)
    }
    section.classList.toggle('tui-active', enabled)
  }

  private sliderRow(
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    onChange: (v: number) => void
  ): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'tui-control-row'

    const labelEl = document.createElement('span')
    labelEl.className = 'tui-label'
    labelEl.textContent = label

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.className = 'tui-slider'
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String(step)
    slider.value = String(initial)

    const valueEl = document.createElement('span')
    valueEl.className = 'tui-value'
    valueEl.textContent = Number(initial).toFixed(step < 1 ? 2 : 0)

    slider.oninput = () => {
      const v = parseFloat(slider.value)
      valueEl.textContent = v.toFixed(step < 1 ? 2 : 0)
      onChange(v)
    }

    row.appendChild(labelEl)
    row.appendChild(slider)
    row.appendChild(valueEl)
    return row
  }

  private buildFooter(): HTMLDivElement {
    const footer = document.createElement('div')
    footer.className = 'tui-footer'

    const left = document.createElement('span')
    left.textContent = '[H] Panel  [P] Move  [E] Eraser'
    const right = document.createElement('span')
    right.textContent = '[1-4] Layers'

    footer.appendChild(left)
    footer.appendChild(right)
    return footer
  }

  private cyclePosition() {
    const idx = POSITIONS.indexOf(this.position)
    const next = POSITIONS[(idx + 1) % POSITIONS.length]
    this.setPosition(next)
    this.setStatus(`PANEL → ${next.toUpperCase()}`)
  }

  private setPosition(pos: PanelPosition) {
    // Remove old position classes
    this.panel.classList.remove('tui-pos-right', 'tui-pos-left', 'tui-pos-top')
    this.tab.classList.remove('tui-tab-right', 'tui-tab-left', 'tui-tab-top')

    this.position = pos
    this.panel.classList.add(`tui-pos-${pos}`)
    this.tab.classList.add(`tui-tab-${pos}`)
  }

  show() {
    this.visible = true
    this.panel.classList.remove('tui-hidden')
    this.tab.classList.add('tui-tab-hidden')
  }

  hide() {
    this.visible = false
    this.panel.classList.add('tui-hidden')
    this.tab.classList.remove('tui-tab-hidden')
  }
}
