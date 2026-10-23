import './vj.css'
import { AudioEngine, type Source } from './vj/audioEngine'
import { SandDeck, type Material } from './vj/sandDeck'

/**
 * Natural Effects VJ: the music plays the materials the way a hand would. Full-screen deck with a
 * small control panel: the material (sand, snow, water or fog), where the sound comes from, the tempo (detected,
 * or tapped), what the engine hears, and how strongly the material answers. Keys: M material, T tap,
 * A auto tempo, H hide, F fullscreen. ?material=snow, water or fog starts there.
 */
document.title = 'VJ — Natural Effects'
const app = document.getElementById('app')!
app.innerHTML = `
<main class="vj" id="vj">
  <aside class="vj-panel" aria-label="VJ controls">
    <header><p class="vj-kicker">Natural Effects · VJ</p><h1><span id="vj-title">Sand</span>, <em>played</em></h1></header>
    <section aria-label="Material">
      <div class="vj-row"><button type="button" data-material="sand">Sand</button><button type="button" data-material="snow">Snow</button><button type="button" data-material="water">Water</button><button type="button" data-material="fog">Fog</button></div>
      <div class="vj-row" id="vj-floor" hidden><label class="vj-file"><input type="file" accept="image/*" hidden>Pool image…</label><button type="button" id="vj-floor-reset">Tiled pool</button></div>
    </section>
    <section aria-label="Theme" id="vj-story-row">
      <p class="vj-label">Theme</p>
      <select id="vj-story" aria-label="Theme drawn on the sand">
        <option value="">Random works</option><option value="all">All themes in turn</option>
        ${SandDeck.stories.map(s => `<option value="${s.id}">${s.title}</option>`).join('')}
      </select>
    </section>
    <section aria-label="Sound source">
      <p class="vj-label">Listen to</p>
      <div class="vj-row">
        <button type="button" data-source="input">Line-in / mic</button>
        <button type="button" data-source="system">Computer audio</button>
        <label class="vj-file"><input type="file" accept="audio/*" hidden>Audio file</label>
      </div>
      <select id="vj-device" aria-label="Audio input device" hidden></select>
      <p class="vj-status" id="vj-status" role="status">Choose a source. A DJ mixer appears under line-in.</p>
    </section>
    <section aria-label="Tempo">
      <p class="vj-label">Tempo <span id="vj-tempo-mode">auto</span></p>
      <div class="vj-tempo"><span class="vj-beat" id="vj-beat"></span><b id="vj-bpm">—</b><small>BPM</small>
        <button type="button" id="vj-tap" title="Tap · T">Tap</button><button type="button" id="vj-auto" title="Auto · A">Auto</button></div>
    </section>
    <section aria-label="What the engine hears">
      <p class="vj-label">Hearing</p>
      <div class="vj-meters" id="vj-meters">${['sub', 'bass', 'lowMid', 'mid', 'high', 'air'].map(b => `<i data-band="${b}"><span></span></i>`).join('')}</div>
      <div class="vj-hits"><span data-hit="kick">Kick</span><span data-hit="snare">Snare</span><span data-hit="hat">Hat</span></div>
      <p class="vj-now" id="vj-figure"></p>
    </section>
    <label class="vj-fader">Sensitivity <input id="vj-gain" type="range" min="0.4" max="3" step="0.05" value="1"></label>
    <p class="vj-keys">M material · T tap · A auto · H hide · F fullscreen</p>
  </aside>
</main>`

const stage = document.getElementById('vj')!
const asked = new URLSearchParams(location.search).get('material')
const deck = new SandDeck(stage, asked === 'snow' || asked === 'water' || asked === 'fog' ? asked : 'sand')
const title = document.getElementById('vj-title')!
const floorRow = document.getElementById('vj-floor')!
function material(kind: Material) {
  deck.kind = kind; stage.dataset.material = kind; title.textContent = { sand: 'Sand', snow: 'Snow', water: 'Water', fog: 'Fog' }[kind]
  document.querySelectorAll<HTMLElement>('[data-material]').forEach(b => { if (b !== stage) b.setAttribute('aria-pressed', String(b.dataset.material === kind)) })
  floorRow.hidden = kind !== 'water'
  // Themes are scrolls of scenes, so they play on the sand only.
  storyRow.hidden = kind !== 'sand'
}
const storyRow = document.getElementById('vj-story-row')!, story = document.getElementById('vj-story') as HTMLSelectElement
story.value = deck.story
story.onchange = () => { deck.story = story.value }
material(deck.kind)
document.querySelectorAll<HTMLButtonElement>('button[data-material]').forEach(b => b.onclick = () => material(b.dataset.material as Material))
// Any picture can lie under the water in place of the tiled pool; it stays on this device.
let floorUrl = ''
function floor(image: File | null) {
  if (floorUrl) URL.revokeObjectURL(floorUrl)
  floorUrl = image ? URL.createObjectURL(image) : ''
  deck.floor(floorUrl)
  if (image && deck.kind !== 'water') material('water')
}
const floorInput = document.querySelector<HTMLInputElement>('#vj-floor input')!
floorInput.onchange = () => { const f = floorInput.files?.[0]; floorInput.value = ''; if (f) floor(f) }
document.getElementById('vj-floor-reset')!.onclick = () => floor(null)
const engine = new AudioEngine()
const status = document.getElementById('vj-status')!, device = document.getElementById('vj-device') as HTMLSelectElement
const bpm = document.getElementById('vj-bpm')!, beatDot = document.getElementById('vj-beat')!, tempoMode = document.getElementById('vj-tempo-mode')!
const meters = [...document.querySelectorAll<HTMLElement>('#vj-meters i')], hits = [...document.querySelectorAll<HTMLElement>('[data-hit]')], figure = document.getElementById('vj-figure')!

async function listen(source: Source, options: { deviceId?: string; file?: File } = {}) {
  status.textContent = source === 'system' ? 'Pick a tab or screen and turn on “Share audio”.' : 'Starting…'
  try {
    await engine.listen(source, options)
    document.querySelectorAll('[data-source]').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.source === source)))
    status.textContent = source === 'input' ? 'Listening to the selected input.' : source === 'system' ? 'Listening to computer audio.' : `Playing ${options.file!.name}.`
    if (source === 'input') {
      // Labels appear only once a device has been allowed; then the mixer can be picked by name.
      const inputs = await AudioEngine.inputs()
      device.replaceChildren(...inputs.map(i => new Option(i.label, i.id))); device.hidden = inputs.length < 2
      if (options.deviceId) device.value = options.deviceId
    }
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not start that source.' }
}
document.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(b => b.onclick = () => listen(b.dataset.source as Source))
device.onchange = () => listen('input', { deviceId: device.value })
const file = document.querySelector<HTMLInputElement>('.vj-file input[accept="audio/*"]')!
file.onchange = () => { const f = file.files?.[0]; file.value = ''; if (f) void listen('file', { file: f }) }
document.getElementById('vj-tap')!.onclick = () => engine.tap()
document.getElementById('vj-auto')!.onclick = () => engine.autoTempo()
const gain = document.getElementById('vj-gain') as HTMLInputElement
gain.oninput = () => { engine.gain = Number(gain.value) }
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || (e.target as HTMLElement).closest('input,select')) return
  const key = e.key.toLowerCase()
  if (key === 'm') material(({ sand: 'snow', snow: 'water', water: 'fog', fog: 'sand' } as const)[deck.kind])
  else if (key === 't') engine.tap()
  else if (key === 'a') engine.autoTempo()
  else if (key === 'h') stage.classList.toggle('vj-clean')
  else if (key === 'f') void (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen())
  else return
  e.preventDefault()
})
// Drop a track anywhere to play it, or a picture to put it under the water.
addEventListener('dragover', e => e.preventDefault())
addEventListener('drop', e => {
  e.preventDefault(); const f = e.dataTransfer?.files[0]
  if (f?.type.startsWith('audio')) void listen('file', { file: f })
  else if (f?.type.startsWith('image')) floor(f)
})

let last = performance.now()
function frame(now: number) {
  const dt = Math.min(.05, (now - last) / 1000); last = now
  engine.update(now)
  const h = engine.hearing
  deck.frame(h, dt, now)
  // The panel reads out what the engine hears.
  bpm.textContent = engine.source ? h.bpm.toFixed(1) : '—'; tempoMode.textContent = h.tempo
  beatDot.style.opacity = String(1 - h.phase)
  meters.forEach(m => { m.firstElementChild!.setAttribute('style', `transform:scaleY(${h.bands[m.dataset.band as keyof typeof h.bands].toFixed(3)})`) })
  hits.forEach(el => { el.style.opacity = String(.25 + .75 * h[el.dataset.hit as 'kick' | 'snare' | 'hat']) })
  figure.textContent = `${deck.mood} · ${deck.figure}`
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
