/** Shared scene controls: one dock style, line icons, light tooltips and a "how to play" card. */

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`
export const icon = {
  sound: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>'),
  camera: svg('<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3"/>'),
  reset: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  palm: svg('<path d="M8 12V5.5a1.3 1.3 0 0 1 2.6 0V11M10.6 10V4.3a1.3 1.3 0 0 1 2.6 0V11M13.2 10.5V5.3a1.3 1.3 0 0 1 2.6 0V12M15.8 11V7.8a1.3 1.3 0 0 1 2.6 0v6.2c0 3.6-2.6 6.5-6.2 6.5-2.6 0-4.1-1.3-5.4-3.2L4.4 13.6a1.3 1.3 0 0 1 2.1-1.5L8 14"/>'),
  pen: svg('<path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.7 18.5l-4.2 1ZM14 7l3 3"/>'),
  drop: svg('<path d="M12 3.5C9.4 7.4 6.8 10.6 6.8 14a5.2 5.2 0 0 0 10.4 0c0-3.4-2.6-6.6-5.2-10.5Z"/>'),
  photo: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.5"/><path d="m4 17.5 5-5 3.5 3.5 2.5-2.5 5 4.5"/>'),
  snowflake: svg('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.6 12 7l2.5-2.4M9.5 19.4 12 17l2.5 2.4M4 11l2.9 1-2.9 1M20 11l-2.9 1 2.9 1"/>'),
  help: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 2-2.3 3.6"/><path d="M12 16.8v.2"/>'),
}

let tip: HTMLDivElement | null = null, tipFor: HTMLElement | null = null, tipTimer: ReturnType<typeof setTimeout> | undefined
function showTip(target: HTMLElement, linger = 0) {
  const label = target.dataset.tip ?? target.getAttribute('aria-label')
  if (!label) return
  if (!tip) { tip = document.createElement('div'); tip.className = 'dock-tip'; tip.setAttribute('aria-hidden', 'true'); document.body.append(tip) }
  tip.textContent = label + (target.dataset.key ? `  ·  ${target.dataset.key}` : '')
  const box = target.getBoundingClientRect()
  tip.style.left = `${Math.min(innerWidth - 12, Math.max(12, box.left + box.width / 2))}px`
  tip.style.top = `${box.top - 8}px`
  tip.classList.add('shown'); tipFor = target; document.body.classList.add('dock-tipping')
  clearTimeout(tipTimer); if (linger) tipTimer = setTimeout(hideTip, linger)
}
function hideTip() { clearTimeout(tipTimer); tip?.classList.remove('shown'); tipFor = null; document.body.classList.remove('dock-tipping') }

/** Give a scene's toolbar the shared dock look, with a tooltip for every control. */
export function dock(el: HTMLElement) {
  el.classList.add('dock')
  let hover: ReturnType<typeof setTimeout> | undefined
  el.addEventListener('pointerover', e => {
    // The ? button answers with the how-to card itself, so it has no tooltip.
    const target = (e.target as HTMLElement).closest<HTMLElement>('button:not(.dock-help),label')
    if (!target && tipFor) { clearTimeout(hover); hideTip() }
    if (!target || e.pointerType !== 'mouse' || target === tipFor) return
    clearTimeout(hover); hover = setTimeout(() => showTip(target), tipFor ? 0 : 280)
  })
  el.addEventListener('pointerleave', () => { clearTimeout(hover); hideTip() })
  // Touch has no hover: a tap names the control briefly instead.
  el.addEventListener('pointerup', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button:not(.dock-help)')
    if (target && e.pointerType !== 'mouse') requestAnimationFrame(() => showTip(target, 1400))
  })
  el.addEventListener('focusin', e => { const target = e.target as HTMLElement; if (target.matches(':focus-visible:not(.dock-help)')) showTip(target) })
  el.addEventListener('focusout', hideTip)
  // Labels change with state (Mute / Enable); keep a visible tip current.
  new MutationObserver(() => { if (tipFor && el.contains(tipFor)) showTip(tipFor) }).observe(el, { subtree: true, attributeFilter: ['aria-label', 'aria-pressed'] })
  return el
}

/**
 * A light card above the dock on how to play with this surface. It shows on arrival, fades
 * on the first touch of the surface or after a while, and the dock's ? button brings it back.
 */
export function guide(dockEl: HTMLElement, lines: string[]) {
  const card = document.createElement('div')
  card.className = 'dock-guide'; card.setAttribute('role', 'note')
  const help = document.createElement('button')
  help.type = 'button'; help.className = 'dock-help'; help.innerHTML = icon.help
  help.setAttribute('aria-label', 'How to play'); help.setAttribute('aria-expanded', 'false')
  const divider = document.createElement('span'); divider.className = 'dock-divider'
  dockEl.append(divider, help); document.body.append(card)
  let timer: ReturnType<typeof setTimeout> | undefined, pinned = false
  const set = (next: string[]) => { card.innerHTML = next.map(line => `<p>${line}</p>`).join('') }
  /** Show the card; with a duration it fades by itself, without one it stays until hidden. */
  const show = (ms?: number) => {
    card.classList.add('shown'); help.setAttribute('aria-expanded', 'true')
    clearTimeout(timer); if (ms) timer = setTimeout(hide, ms)
  }
  const hide = () => { clearTimeout(timer); pinned = false; card.classList.remove('shown'); help.setAttribute('aria-expanded', 'false') }
  // Hovering ? previews the card; clicking or tapping it keeps the card open until clicked again.
  help.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show() })
  help.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pinned) { clearTimeout(timer); timer = setTimeout(hide, 250) } })
  help.addEventListener('focus', () => { if (help.matches(':focus-visible')) show() })
  help.addEventListener('blur', () => { if (!pinned) hide() })
  help.onclick = () => { if (pinned) hide(); else { pinned = true; show() } }
  // The first real touch of the surface means the visitor has started playing.
  addEventListener('pointerdown', e => {
    if (!card.classList.contains('shown') || (e.target as HTMLElement).closest('.dock,.dock-guide')) return
    clearTimeout(timer); timer = setTimeout(hide, 700)
  }, { capture: true })
  set(lines); setTimeout(() => show(9000), 500)
  return { set, show, hide }
}
