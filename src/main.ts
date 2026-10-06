const mode = new URLSearchParams(location.search).get('mode')
const startup = mode === 'td-controller' ? import('./td-controller') : mode === 'classic'
  ? import('./classic')
  : import('./midnight')
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
