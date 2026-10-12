const mode = new URLSearchParams(location.search).get('mode')
async function startScene() {
  if (mode === 'home' || (!mode && !location.search)) return await import('./elements')
  if (mode === 'steam' || mode === 'fog') return await import('./fog')
  if (mode === 'ice') return await import('./ice')
  if (mode === 'sand' || mode === 'snow') return await import('./sand')
  if (mode === 'projector') return await import('./projector')
  if (mode === 'td-controller') return await import('./td-controller')
  if (mode === 'classic') return await import('./classic')
  return await import('./midnight')
}
const startup = startScene().then(() => {
  if (mode === 'home' || (!mode && !location.search) || mode === 'projector' || mode === 'td-controller') return
  const home = document.createElement('a')
  home.href = '/?mode=home'
  home.setAttribute('aria-label', 'Choose Water, Ice, Steam, Sand or Snow')
  home.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>'
  home.className = 'scene-home'
  // Hides every scene's text and controls, e.g. for clean recordings; the toggle itself stays faintly visible.
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
  setHidden(false)
  document.body.append(home, chrome)
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
