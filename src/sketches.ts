import { ART_SKETCHES } from './vj/artSketches'

/**
 * A study sheet of the art sketches: each work drawing itself stroke by stroke, in ink on paper,
 * before it is pressed into the sand. Click a sheet to draw it again.
 */
document.title = 'Sketches — Natural Effects'
const style = document.createElement('style')
style.textContent = `
html,body,#app{margin:0;height:100%;overflow:auto;background:#f3f2ee;color:#151515;font-family:Georgia,"Times New Roman",serif}
.sheets{padding:56px clamp(20px,6vw,88px) 80px}
.sheets h1{margin:0 0 6px;font:400 clamp(34px,4vw,54px)/1 Georgia,serif;letter-spacing:-.02em}
.sheets h1 em{font-style:italic}
.sheets>p{margin:0 0 40px;font:500 10.5px/1.6 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#77756f}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:40px 32px}
figure{margin:0;cursor:pointer}
.paper{aspect-ratio:1;background:#fbfaf6;box-shadow:0 0 0 1px #1515151a,0 18px 40px -28px #2a261e55;padding:6%}
svg{width:100%;height:100%;overflow:visible}
path{fill:none;stroke:#2a2620;stroke-width:.45;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:draw var(--d) cubic-bezier(.4,.1,.3,1) var(--t) forwards}
@keyframes draw{to{stroke-dashoffset:0}}
figcaption{display:flex;justify-content:space-between;gap:12px;margin-top:14px;font-size:20px;letter-spacing:-.01em}
figcaption span{font:italic 13px Georgia,serif;color:#77756f}
.sheets h2{margin:72px 0 6px;font:400 clamp(28px,3vw,42px)/1 Georgia,serif;letter-spacing:-.02em}.sheets h2 em{font-style:italic}.sheets h2+p{margin:0 0 32px;font:500 10.5px/1.6 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#77756f}
.sand .paper{background:#e7cf9f}.sand path{stroke:#5c4226;stroke-width:.9}`
document.head.append(style)

const sheet = (s: typeof ART_SKETCHES[number], d = s.d) => {
  // Each stroke takes time in proportion to its share of the drawing, one after another.
  const strokes = d.split(/(?=M)/), total = strokes.reduce((n, p) => n + p.length, 0)
  let t = 0
  const paths = strokes.map(p => { const d = 6 * p.length / total; const el = `<path pathLength="1" d="${p}" style="--t:${t.toFixed(2)}s;--d:${Math.max(.12, d).toFixed(2)}s"/>`; t += d * .8; return el }).join('')
  return `<figure data-id="${s.id}"><div class="paper"><svg viewBox="0 0 100 100" aria-label="${s.name}">${paths}</svg></div><figcaption>${s.name}<span>after ${s.after}</span></figcaption></figure>`
}
document.getElementById('app')!.innerHTML = `<main class="sheets"><h1>Sketches <em>for the sand</em></h1><p>Each work draws itself, stroke by stroke · click to draw again</p><div class="grid">${ART_SKETCHES.map(s => sheet(s)).join('')}</div><h2>Cut for the <em>sand</em></h2><p>One continuous silhouette, then the six strongest inner lines: what the fingertip draws</p><div class="grid sand">${ART_SKETCHES.filter(s => s.sand).map(s => sheet(s, s.sand)).join('')}</div></main>`
document.querySelectorAll<HTMLElement>('figure').forEach(f => f.onclick = () => { const svg = f.querySelector('svg')!; svg.replaceWith(svg.cloneNode(true)) })
