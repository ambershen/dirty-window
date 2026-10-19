import { IceWriting } from './effects/IceWriting'
import { IceSound } from './audio/IceSound'
import { IceFractures } from './effects/IceFractures'
import './ice.css'
import { dock, guide, icon } from './ui/dock'

const app = document.getElementById('app')!
app.innerHTML = `<canvas id="ice" aria-label="Slide across the ice; hold a crack to fracture it"></canvas><nav id="ice-tools" aria-label="Ice tools"><button id="ice-sound" aria-label="Mute ice sound" aria-pressed="true">${icon.sound}</button><button id="ice-reset" aria-label="Refreeze surface" data-key="R">${icon.reset}</button></nav>`
const canvas = document.getElementById('ice') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const surface = document.createElement('canvas'), frost = surface.getContext('2d')!
type Point = { x: number; y: number }
type Hand = Point & { px: number; py: number; vx: number; vy: number; t: number; stress: number; pressure: number }
const hands = new Map<number, Hand>()
const writing = new IceWriting()
const fractures = new IceFractures()
const sound = new IceSound()
const soundButton=document.getElementById('ice-sound')!
function unlockSound(){void sound.unlock().then(()=>{soundButton.setAttribute('aria-label',sound.enabled?'Mute ice sound':'Enable ice sound');soundButton.setAttribute('aria-pressed',String(sound.enabled));soundButton.dataset.audio='ready'}).catch(()=>{soundButton.setAttribute('aria-label','Retry ice sound');soundButton.setAttribute('aria-pressed','false')})}
soundButton.onclick=()=>{if(soundButton.getAttribute('aria-label')==='Retry ice sound'){sound.enabled=true}else sound.toggle();soundButton.setAttribute('aria-pressed',String(sound.enabled));soundButton.setAttribute('aria-label',sound.enabled?'Mute ice sound':'Enable ice sound');if(sound.enabled)unlockSound()}
let w = 1, h = 1, last = performance.now(), pinchDistance: number|null=null
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function paint() {
  const g = frost, grad = g.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#e6e7e5'); grad.addColorStop(.35, '#c4c7c5'); grad.addColorStop(.7, '#989e9c'); grad.addColorStop(1, '#d6d8d5')
  g.fillStyle = grad; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 35; i++) {
    const x = rand(0, w), y = rand(0, h), r = rand(40, Math.max(80, w * .4))
    const glow = g.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, i % 3 ? '#f7f8f516' : '#454b4820'); glow.addColorStop(1, '#eff0ed00')
    g.fillStyle = glow; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // Bubbles trapped below the surface; fine parallel abrasion on the top.
  for (let i = 0; i < w * h / 900; i++) {
    const x = rand(0, w), y = rand(0, h), r = rand(.3, 2.8)
    g.beginPath(); g.ellipse(x, y, r, r * .6, -.4, 0, Math.PI * 2)
    g.strokeStyle = '#fafbf835'; g.lineWidth = .7; g.stroke()
  }
  for (let i = 0; i < 500; i++) {
    const x = rand(0, w), y = rand(0, h)
    g.strokeStyle = '#f7f8f50b'; g.lineWidth = .5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(5, 90), y - rand(2, 30)); g.stroke()
  }
  for(let i=0;i<w*h/7;i++){
    const x=rand(0,w),y=rand(0,h),r=rand(.3,1.2)
    const density=(Math.sin(x*.013+y*.006)+Math.sin(y*.018-x*.008)+2)/4
    g.globalAlpha=.08+density*.28;g.fillStyle=i%5?'#fffffa':'#707973';g.fillRect(x,y,r,r)
  }
  g.globalAlpha=1
  const sheen = g.createLinearGradient(0, 0, w, h)
  sheen.addColorStop(0, '#fafbf800'); sheen.addColorStop(.25, '#fafbf800'); sheen.addColorStop(.36, '#fafbf838'); sheen.addColorStop(.43, '#fafbf808'); sheen.addColorStop(1, '#fafbf800')
  g.fillStyle = sheen; g.fillRect(0, 0, w, h)
}
function reset() { pinchDistance=null; sound.quiet(); hands.clear(); writing.reset(); fractures.reset(w,h) }
function resize() {
  w = innerWidth; h = innerHeight
  const dpr = Math.min(devicePixelRatio, 1.5)
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  surface.width = w; surface.height = h; writing.resize(w,h); paint(); reset()
}
canvas.onpointerdown = e => {
  e.preventDefault(); unlockSound(); canvas.setPointerCapture(e.pointerId)
  hands.set(e.pointerId, { x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, vx: 0, vy: 0, t: performance.now(), stress: 0, pressure: e.pointerType === 'pen' ? e.pressure : 0 })
}
canvas.onpointermove = e => {
  const p = hands.get(e.pointerId); if (!p) return
  const now = performance.now(), dx = e.clientX - p.x, dy = e.clientY - p.y, dt = Math.max(8, now - p.t) / 1000
  if (Math.hypot(dx, dy) > 1) {
    writing.rub(p.x,p.y,e.clientX,e.clientY,Math.min(.15,dt))
    p.stress = Math.max(0, p.stress - Math.hypot(dx, dy) * .015)
  }
  p.vx = dx / dt; p.vy = dy / dt; p.x = e.clientX; p.y = e.clientY; p.t = now
  p.pressure = e.pointerType === 'pen' ? e.pressure : 0
}
function release(e: PointerEvent) { if(e.type==='pointerup')unlockSound(); hands.delete(e.pointerId); pinchDistance=null; fractures.release(e.pointerId); sound.release(e.pointerId) }
canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = release
document.getElementById('ice-reset')!.onclick = reset
guide(dock(document.getElementById('ice-tools')!), ['<b>Slide</b> across the ice to scratch it', '<b>Hold still</b> and it starts to crack', 'On touch, <b>squeeze two fingers</b> to stress it'])
addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) reset() })
function frame(now: number) {
  const dt = Math.min(.04, (now - last) / 1000); last = now
  ctx.drawImage(surface, 0, 0, w, h)
  const pair=[...hands.values()]
  if(pair.length===2){
    const distance=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)
    if(pinchDistance!==null){const squeeze=Math.max(0,pinchDistance-distance);for(const p of pair)p.stress=Math.min(4,p.stress+squeeze*.09)}
    pinchDistance=distance
  }else pinchDistance=null
  for (const [id,p] of hands) {
    const still = now - p.t > 180 || Math.hypot(p.vx, p.vy) < 8
    if (still) p.stress = Math.min(4, p.stress + dt * (1 + p.pressure))
    const growth=fractures.press(id,p,p.stress,dt)
    sound.fracture(id,growth,p.x/w,now)
    if(now-p.t<90)sound.motion(Math.hypot(p.vx,p.vy),p.x/w,now)
    // A small specular contact patch trails the finger, like a slick film on ice.
    const follow = 1 - Math.exp(-dt * 19); p.px += (p.x - p.px) * follow; p.py += (p.y - p.py) * follow
  }
  ctx.globalAlpha = 1
  fractures.draw(ctx,surface,dt)
  writing.draw(ctx,now,dt)
  for(const p of hands.values()){
    const r=24+p.stress*3,wet=ctx.createRadialGradient(p.px,p.py,0,p.px,p.py,r)
    wet.addColorStop(0,'rgba(72,82,75,.09)');wet.addColorStop(1,'rgba(72,82,75,0)');ctx.fillStyle=wet;ctx.fillRect(p.px-r,p.py-r,r*2,r*2)
    const shine=ctx.createRadialGradient(p.px-6,p.py-7,0,p.px-6,p.py-7,r*.75);shine.addColorStop(0,'rgba(255,255,250,.10)');shine.addColorStop(1,'rgba(255,255,250,0)');ctx.fillStyle=shine;ctx.fillRect(p.px-r,p.py-r,r*2,r*2)
  }
  ctx.globalAlpha = 1; sound.tick(now); requestAnimationFrame(frame)
}
resize(); addEventListener('resize', resize); addEventListener('blur', () => { sound.quiet(); for(const id of hands.keys())fractures.release(id); hands.clear() }); document.addEventListener('visibilitychange', () => { if (document.hidden) { for(const id of hands.keys())fractures.release(id); hands.clear() } }); requestAnimationFrame(frame)

addEventListener('pagehide',()=>sound.dispose());document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.quiet()})
