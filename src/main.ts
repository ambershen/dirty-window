const mode = new URLSearchParams(location.search).get('mode')
async function startScene() {
  if (mode === 'home' || (!mode && !location.search)) return await import('./elements')
  if (mode === 'steam' || mode === 'fog') return await import('./fog')
  if (mode === 'ice') return await import('./ice')
  if (mode === 'projector') return await import('./projector')
  if (mode === 'td-controller') return await import('./td-controller')
  if (mode === 'classic') return await import('./classic')
  return await import('./midnight')
}
const startup = startScene().then(() => {
  if (mode === 'home' || (!mode && !location.search) || mode === 'projector' || mode === 'td-controller') return
  const home = document.createElement('a')
  home.href = '/?mode=home'
  home.setAttribute('aria-label', 'Choose Water, Ice or Steam')
  home.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>'
  home.style.cssText = 'position:fixed;left:max(16px,env(safe-area-inset-left));top:max(16px,env(safe-area-inset-top));z-index:1000;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;color:white;background:#23373755;backdrop-filter:blur(12px);border:1px solid #ffffff40'
  document.body.append(home)
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
