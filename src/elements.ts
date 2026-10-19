import './elements.css'
import { MATERIALS } from './materials'
import { HeroGlass, type HeroView } from './landing/heroGlass'
import { WindowView, hourNow, type Hour } from './landing/windowView'
import { WatercolourView } from './landing/watercolourView'
import { RainView } from './landing/rainView'
import { specimen } from './landing/specimens'

// The view behind the hero's glass follows the visitor's hour: watercolour in daylight, the painted
// landscape at dawn, dusk and night. ?time= previews an hour; ?hero=rain shows the rainy night.
const HOURS: Hour[] = ['dawn', 'day', 'dusk', 'night']
const HOUR_NAMES: Record<Hour, string> = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' }
const HOUR_LINES: Record<Hour, string> = { dawn: 'first light', day: 'watercolour, drying in daylight', dusk: 'dusk over the hills', night: 'night, moon over the lake' }
const rainy = new URLSearchParams(location.search).get('hero') === 'rain'
const viewFor = (hour: Hour): HeroView => rainy ? new RainView() : hour === 'day' ? new WatercolourView() : new WindowView(hour)

document.title = 'Natural Effects'

const PLUGIN_INSTALL = '/plugin install natural-effects --marketplace ambershen/natural-effect'
const SKILLS: [string, string][] = [
  ['simulate-natural-water', 'Ripples, directional wakes, stirring, inertia, reflection and refraction.'],
  ['simulate-natural-ice', 'Faint friction writing, irregular growing fractures, restrained sound.'],
  ['simulate-natural-fog', 'Fogged glass, narrow writing, broad wiping and gradual recovery.'],
  ['simulate-natural-sand', 'Granular furrows, displaced rims, settling and movement-driven sound.'],
  ['simulate-natural-snow', 'Dense powder, six-arm snowfall, dwell compression and fresh coverage.'],
  ['natural-motion-interaction', 'Touch and camera input, contact lifecycles, gestures and smoothing.'],
  ['temporary-canvas', 'A recipe joining condensation, sand and snow through drawing that fades.'],
]

const number = (i: number) => `No. ${String(i + 1).padStart(2, '0')}`
const effects = MATERIALS.map((m, i) => `
      <li class="reveal"><a class="effect-card" href="${m.href}" data-kind="${m.id}">
        <div class="effect-media"><video muted loop playsinline preload="none" poster="/media/${m.id}.jpg" data-src="/media/${m.id}.mp4"></video></div>
        <p class="effect-meta"><span>${number(i)}</span><span>${m.state}</span></p>
        <h3>${m.name}</h3>
        <p class="effect-note">${m.note}</p>
        <dl class="specimen"><div><dt>Touch</dt><dd>${m.gestures}</dd></div><div><dt>Remembers</dt><dd>${m.memory}</dd></div></dl>
      </a></li>`).join('')

document.getElementById('app')!.innerHTML = `
<main class="elements" aria-label="Natural Effects">
  <nav class="masthead" aria-label="Sections">
    <span class="masthead-mark">Natural Effects</span>
    <span class="masthead-links"><a href="#effects">Effects</a><a href="#skills">Skills</a><a class="masthead-enter" href="${MATERIALS[0].href}">Playground →</a></span>
  </nav>

  <section class="hero" aria-labelledby="hero-title">
    <h1 id="hero-title" class="sr-only">Natural Effects</h1>
    <header class="hero-top">
      <p class="hero-meta">Interactive natural materials<br><span id="hero-caption"></span></p>
      <nav class="hero-views" aria-label="Preview the view at another hour">${HOURS.map(hour => `<button type="button" data-hour="${hour}">${HOUR_NAMES[hour]}</button>`).join('')}</nav>
    </header>
    <div class="window" id="hero-window" aria-hidden="true"></div>
    <p class="hero-hint" id="hero-hint">Draw on the glass · hold still to breathe</p>
  </section>

  <section class="effects" id="effects" aria-labelledby="effects-title">
    <header class="section-head">
      <p class="kicker">The effects</p>
      <h2 id="effects-title">Each material keeps its own <em>time</em>.</h2>
    </header>
    <ul class="effect-grid">${effects}
      <li class="reveal"><a class="effect-card effect-yours" href="#skills">
        <div class="effect-media"><span aria-hidden="true">+</span></div>
        <p class="effect-meta"><span>${number(MATERIALS.length)}</span><span>yours</span></p>
        <h3>Your effect</h3>
        <p class="effect-note">Build a new material with the skills, from rain on a window to frost on a leaf, and add it to the collection.</p>
        <dl class="specimen"><div><dt>Touch</dt><dd>Yours to decide</dd></div><div><dt>Make one</dt><dd>with the skills →</dd></div></dl>
      </a></li>
    </ul>
  </section>

  <section class="skills" id="skills" aria-labelledby="skills-title">
    <header class="section-head">
      <p class="kicker">For makers · Claude Code plugin</p>
      <h2 id="skills-title">Take the materials <em>with you</em>.</h2>
    </header>
    <div class="skills-body">
      <div class="skills-intro">
        <p>Everything learned building these studies, written down as agent skills: how each material behaves, sounds and recovers, and how a hand becomes a stable touch. Install the plugin, then ask for water, ice, fog, sand or snow in your own project.</p>
        <div class="install">
          <code id="install-command">${PLUGIN_INSTALL}</code>
          <button type="button" id="install-copy" aria-label="Copy install command">Copy</button>
        </div>
        <p class="install-note">Claude Code 2.1.275 or later. Skills are namespaced, e.g. <code>/natural-effects:simulate-natural-water</code>.</p>
        <a class="skills-link" href="https://github.com/ambershen/natural-effect" target="_blank" rel="noopener">Read the skills on GitHub ↗</a>
      </div>
      <ol class="skill-list">${SKILLS.map(([name, about]) => `<li><code>${name}</code><span>${about}</span></li>`).join('')}</ol>
    </div>
  </section>

  <footer class="colophon">
    <p>Made by Amber Shen</p>
    <p><a href="https://x.com/whosamberella" target="_blank" rel="noopener">X ↗</a><a href="https://github.com/ambershen" target="_blank" rel="noopener">GitHub ↗</a><a href="${MATERIALS[0].href}">Enter the playground →</a></p>
  </footer>
</main>`

// The hero is one fogged window; touching it retires the hint.
const nowHour = hourNow()
let shown = nowHour
const hero = new HeroGlass(document.getElementById('hero-window')!, viewFor(nowHour))
// The caption names the hour behind the glass; the switcher marks the visitor's own hour as now.
const caption = document.getElementById('hero-caption')!
const hourButtons = [...document.querySelectorAll<HTMLButtonElement>('.hero-views button')]
const setCaption = () => {
  caption.textContent = rainy ? 'Rain, after dark'
    : shown === nowHour ? `The view at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${HOUR_LINES[shown]}`
    : `Previewing ${HOUR_NAMES[shown].toLowerCase()} · ${HOUR_LINES[shown]}`
  for (const b of hourButtons) { b.setAttribute('aria-pressed', String(b.dataset.hour === shown)); b.classList.toggle('now', b.dataset.hour === nowHour) }
}
for (const b of hourButtons) b.onclick = () => { shown = b.dataset.hour as Hour; hero.setView(viewFor(shown)); setCaption() }
if (rainy) document.querySelector<HTMLElement>('.hero-views')!.hidden = true
setCaption(); setInterval(setCaption, 30000)
hero.onFirstTouch = () => document.getElementById('hero-hint')!.classList.add('quiet')

// Each effect plays its demo only while its card is on screen; reduced motion keeps the still.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
const watcher = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    const video = target as HTMLVideoElement
    if (isIntersecting && !still) { if (!video.src) video.src = video.dataset.src!; void video.play().catch(() => { /* The poster stays. */ }) }
    else video.pause()
  }
}, { threshold: .25 })
document.querySelectorAll<HTMLVideoElement>('.effect-media video').forEach(video => watcher.observe(video))

const copy = document.getElementById('install-copy') as HTMLButtonElement
copy.onclick = async () => {
  try { await navigator.clipboard.writeText(PLUGIN_INSTALL); copy.textContent = 'Copied' }
  catch { getSelection()?.selectAllChildren(document.getElementById('install-command')!); copy.textContent = 'Selected' }
  setTimeout(() => { copy.textContent = 'Copy' }, 1600)
}

// Every effect card's window can be touched: it answers the pointer as its material would.
if (matchMedia('(hover: hover)').matches && !still) document.querySelectorAll<HTMLElement>('.effect-card[data-kind]').forEach(card => specimen(card.querySelector('.effect-media')!, card.dataset.kind as Parameters<typeof specimen>[1]))

// Sections and cards settle into place as they arrive, one after another.
document.querySelectorAll('.section-head, .skills-body').forEach(el => el.classList.add('reveal'))
const reveal = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => { if (isIntersecting) { target.classList.add('in'); reveal.unobserve(target) } }), { threshold: .15 })
document.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => { el.style.setProperty('--delay', `${(i % 3) * 90}ms`); reveal.observe(el) })
