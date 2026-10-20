import { MATERIALS, currentMaterial } from './materials'
const mode = new URLSearchParams(location.search).get('mode')
async function startScene() {
  if (mode === 'home' || !mode) return await import('./elements')
  if (mode === 'steam' || mode === 'fog') return await import('./fog')
  if (mode === 'ice') return await import('./ice')
  if (mode === 'sand' || mode === 'snow') return await import('./sand')
  if (mode === 'projector') return await import('./projector')
  if (mode === 'vj') return await import('./vj')
  // The sketch reference sheet is a working tool: served by the dev server, left out of the public build.
  if (mode === 'sketches') { if (import.meta.env.DEV) return await import('./sketches'); return await import('./elements') }
  if (mode === 'td-controller') return await import('./td-controller')
  if (mode === 'classic') return await import('./classic')
  return await import('./midnight')
}
const startup = startScene().then(() => {
  if (mode === 'home' || !mode || mode === 'projector' || mode === 'td-controller' || mode === 'vj' || mode === 'sketches') return
  // The material switcher: the current study's name; it opens the five studies and the way home.
  const current = currentMaterial(mode)
  const home = document.createElement('button')
  home.type = 'button'; home.className = 'scene-home'
  home.setAttribute('aria-haspopup', 'menu'); home.setAttribute('aria-expanded', 'false')
  home.setAttribute('aria-label', `Material: ${current?.name ?? 'Studies'}. Choose another`)
  home.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
    + `<span class="material-label">${current?.name ?? 'Studies'}</span><svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 9 6 6 6-6"/></svg>`
  const menu = document.createElement('nav')
  menu.className = 'material-menu'; menu.setAttribute('aria-label', 'Materials'); menu.id = 'material-menu'; home.setAttribute('aria-controls', menu.id)
  menu.innerHTML = MATERIALS.map((m, i) => `<a href="${m.href}"${m === current ? ' aria-current="page"' : ''}><small>${String(i + 1).padStart(2, '0')}</small><b>${m.name}<em>${m.state}</em></b><kbd>${i + 1}</kbd></a>`).join('')
    + '<a class="menu-home" href="/">← Natural Effects</a>'
  const setOpen = (open: boolean) => { menu.classList.toggle('open', open); home.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector<HTMLElement>('[aria-current]')?.focus({ preventScroll: true }) }
  home.onclick = () => setOpen(!menu.classList.contains('open'))
  addEventListener('pointerdown', e => { if (menu.classList.contains('open') && !(e.target as HTMLElement).closest('.material-menu,.scene-home')) setOpen(false) }, { capture: true })
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setOpen(false); home.focus() }
    // 1–5 jump straight to a material (the classic scene uses digits for its own layers).
    const index = Number(e.key) - 1
    if (mode !== 'classic' && index >= 0 && index < MATERIALS.length && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as HTMLElement).closest?.('input,select,textarea') && MATERIALS[index] !== current) location.href = MATERIALS[index].href
  })
  // Hides every scene's text and controls, e.g. for clean recordings; the toggle itself shows only on hover or H.
  const chrome = document.createElement('button')
  chrome.className = 'scene-chrome-toggle'
  const eye = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
  const setHidden = (hidden: boolean) => {
    document.body.classList.toggle('ui-hidden', hidden)
    chrome.setAttribute('aria-pressed', String(hidden))
    chrome.setAttribute('aria-label', hidden ? 'Show controls and text' : 'Hide controls and text')
    chrome.innerHTML = eye + (hidden ? '<path d="M4 4l16 16"/>' : '') + '</svg>'
  }
  chrome.onclick = () => setHidden(!document.body.classList.contains('ui-hidden'))
  // H toggles too (the classic scene already uses H for its own panel).
  if (mode !== 'classic') addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || (e.target as HTMLElement).closest?.('input,select,textarea')) return
    e.preventDefault(); setHidden(!document.body.classList.contains('ui-hidden'))
  })
  setHidden(false)
  const bar = document.createElement('div'); bar.className = 'scene-chrome'; bar.append(home, chrome)
  document.body.append(bar, menu)
})
startup.catch(() => {
  const app = document.getElementById('app')!
  app.replaceChildren()
  const message = document.createElement('p')
  message.textContent = 'The scene could not load. Please reload to try again.'
  message.style.padding = '32px'
  const retry = document.createElement('button')
  retry.textContent = 'Reload scene'
  retry.onclick = () => location.reload()
  app.append(message, retry)
})
export {}
