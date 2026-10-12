import './sand.css'
import { SandSurface } from './effects/SandSurface'
import { SnowSurface } from './effects/SnowSurface'
import { GranularRenderer } from './effects/GranularRenderer'
import { MaterialCamera } from './gestures/MaterialCamera'
import { SandSound } from './audio/SandSound'

const snow = new URLSearchParams(location.search).get('mode') === 'snow'
const name = snow ? 'Snow' : 'Sand'
document.title = `${name} — Natural Effects`
document.body.classList.toggle('snow-study', snow)
document.getElementById('app')!.innerHTML = `
<canvas id="sand" aria-label="Interactive ${name.toLowerCase()}: drag to trace${snow ? ', hold to press deeper' : ''}"></canvas>
<canvas id="material-air" aria-hidden="true"></canvas>
<div class="sand-title"><span>NATURAL EFFECTS / STUDY ${snow ? '05' : '04'}</span><h1>${name}</h1></div>
<a class="material-switch" href="/?mode=${snow ? 'sand' : 'snow'}">Explore ${snow ? 'Sand' : 'Snow'} ↗</a>
<nav id="sand-tools" aria-label="${name} tools">
${snow ? '<button id="snowfall" aria-pressed="false">Snowfall</button>' : '<button id="sand-sound" aria-label="Mute sand sound" aria-pressed="true">Sound</button>'}
<button id="sand-brush" aria-label="Use broad palm" aria-pressed="false">Palm</button>
<button id="sand-camera" aria-label="Enable hand camera" aria-pressed="false">Camera</button>
<button id="sand-reset" aria-label="${snow ? 'Restore fresh snow' : 'Smooth the sand'}">↺</button></nav>
<p id="sand-hint">${snow ? 'Trace softly · hold to press deeper' : 'Trace the dunes · sweep with your palm'}</p>
<p id="sand-status" role="status"></p>`
const canvas = document.getElementById('sand') as HTMLCanvasElement
const air = document.getElementById('material-air') as HTMLCanvasElement
const airCtx = air.getContext('2d')!
const renderer = new GranularRenderer(canvas)
const sound = snow ? null : new SandSound()
let surface: SandSurface, width = innerWidth, height = innerHeight, broad = false, snowfall = false
let last = performance.now(), dirty = true, settlingUntil = 0, hiddenHint = false
const status = document.getElementById('sand-status')!
const hint = document.getElementById('sand-hint')!
type Contact = { x: number; y: number; radius: number; load: number; pen: number; lastMove: number; lastSeen: number; speed: number; camera: boolean }
const contacts = new Map<number, Contact>()
type Flake = { x: number; y: number; z: number; speed: number; radius: number; phase: number; angle: number; spin: number; shape: number }
const flakes: Flake[] = []
// SVG crystals retain six arms and visible branches at small screen sizes.
const flakeImages = Array.from({ length: 3 }, (_, i) => {
  const image = new Image()
  image.src = `/textures/snowflake-${i + 1}.svg`
  return image
})
function newFlake(initial = false): Flake {
  return { x: Math.random() * width, y: Math.random() * height, z: initial ? Math.random() : 1,
    speed: .10 + Math.random() * .10, radius: 7 + Math.random() * 6,
    phase: Math.random() * Math.PI * 2, angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - .5) * .65, shape: Math.floor(Math.random() * flakeImages.length) }
}
function resize() {
  width = innerWidth; height = innerHeight
  const dpr = Math.min(1.5, devicePixelRatio, 1800 / Math.max(width, height))
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
  air.width = canvas.width; air.height = canvas.height; airCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const scale = Math.min(1, 560 / Math.max(width, height))
  const gw = Math.max(24, Math.round(width * scale)), gh = Math.max(24, Math.round(height * scale))
  surface = snow ? new SnowSurface(gw, gh) : new SandSurface(gw, gh)
  contacts.clear(); sound?.quiet(); dirty = true; flakes.length = 0
  if (snowfall) for (let i = 0; i < 90; i++) flakes.push(newFlake(true))
}
async function unlockSound() {
  if (!sound) return
  try { await sound.unlock(); status.textContent = '' } catch { status.textContent = 'Sound unavailable · tap Sound to retry' }
}
function stamp(x: number, y: number, r: number, load: number, amount: number, motionX = 0, motionY = 0) {
  const scale = surface.width / width
  surface.touch(x * scale, y * surface.height / height, r * scale, load, amount, motionX, motionY)
  dirty = true; settlingUntil = performance.now() + 4100
}
function contact(id: number, x: number, y: number, radius: number, pen = 0, camera = false) {
  const now = performance.now(), old = contacts.get(id)
  if (!old) {
    const c = { x, y, radius, load: .08, pen, lastMove: now, lastSeen: now, speed: 0, camera }
    contacts.set(id, c); stamp(x, y, radius, Math.max(c.load, pen), .45)
  } else {
    const distance = Math.hypot(x - old.x, y - old.y)
    old.lastSeen = now; old.pen = pen; old.radius = radius
    if (distance > .7) {
      const elapsed = Math.max(8, now - old.lastMove)
      old.speed = Math.min(1800, distance / elapsed * 1000)
      if (old.speed > 25) old.load = Math.max(.08, old.load - elapsed / 1000 * 1.8)
      const steps = Math.max(1, Math.ceil(distance / Math.max(2, radius * .22)))
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        stamp(old.x + (x - old.x) * t, old.y + (y - old.y) * t, radius, Math.max(old.load, pen), .42, x - old.x, y - old.y)
      }
      old.x = x; old.y = y; old.lastMove = now
    }
  }
  if (!hiddenHint) { hiddenHint = true; hint.classList.add('quiet') }
}
function release(id: number) { contacts.delete(id); if (!contacts.size) sound?.quiet() }
function releaseAll() { contacts.clear(); sound?.quiet() }
canvas.onpointerdown = e => {
  e.preventDefault(); canvas.setPointerCapture(e.pointerId); void unlockSound()
  contact(e.pointerId, e.clientX, e.clientY, broad ? 43 : 13, e.pointerType === 'pen' ? e.pressure : 0)
}
canvas.onpointermove = e => { if (contacts.has(e.pointerId)) contact(e.pointerId, e.clientX, e.clientY, broad ? 43 : 13, e.pointerType === 'pen' ? e.pressure : 0) }
canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = e => release(e.pointerId)
const brush = document.getElementById('sand-brush') as HTMLButtonElement
brush.onclick = () => {
  broad = !broad; releaseAll(); brush.setAttribute('aria-pressed', String(broad))
  brush.setAttribute('aria-label', broad ? 'Use fingertip' : 'Use broad palm'); brush.textContent = broad ? 'Finger' : 'Palm'
}
document.getElementById('sand-reset')!.onclick = () => { releaseAll(); surface.reset(); dirty = true }
const cameraButton = document.getElementById('sand-camera') as HTMLButtonElement
const camera = new MaterialCamera(cameraButton, p => contact(-100, p.x * width, p.y * height, p.radius, 0, true), () => release(-100))
cameraButton.addEventListener('click', () => { void unlockSound() })
const soundButton = document.getElementById('sand-sound')
if (soundButton && sound) soundButton.onclick = () => {
  if (status.textContent) { void unlockSound(); return }
  const enabled = sound.toggle(); soundButton.setAttribute('aria-pressed', String(enabled)); soundButton.textContent = enabled ? 'Sound' : 'Muted'
  soundButton.setAttribute('aria-label', enabled ? 'Mute sand sound' : 'Enable sand sound'); if (enabled) void unlockSound()
}
const fallButton = document.getElementById('snowfall')
if (fallButton) fallButton.onclick = () => {
  snowfall = !snowfall; fallButton.setAttribute('aria-pressed', String(snowfall)); fallButton.textContent = snowfall ? 'Snowing' : 'Snowfall'
  flakes.length = 0; if (snowfall) for (let i = 0; i < 90; i++) flakes.push(newFlake(true)); dirty = true
}
function drawAir(now: number, dt: number) {
  airCtx.clearRect(0, 0, width, height)
  if (snowfall && surface instanceof SnowSurface) {
    for (let i = 0; i < flakes.length; i++) {
      let f = flakes[i]
      f.z -= dt * f.speed
      // Slow descent and independent flutter, seen from above the snow surface.
      f.y += dt * (9 + f.speed * 45 + Math.sin(now / 1700 + f.phase) * 3)
      f.x += dt * (3 + Math.sin(now / 1400 + f.phase) * 9)
      f.angle += dt * f.spin
      if (f.z <= 0 || f.y > height + 10 || f.x > width + 10 || f.x < -10) {
        if (f.z <= 0) surface.deposit(f.x / width * surface.width, f.y / height * surface.height, 2.5)
        f = flakes[i] = newFlake()
      }
      const radius = f.radius * (.65 + f.z * .75)
      // Fade into view overhead, then blend into the white powder at contact.
      const entry = Math.min(1, (1 - f.z) * 9)
      const landing = Math.min(1, f.z * 12)
      const alpha = entry * landing * .95
      airCtx.save(); airCtx.translate(f.x, f.y); airCtx.rotate(f.angle)
      const flutter = .9 + .1 * Math.sin(now / 1400 + f.phase)
      airCtx.scale(1, flutter)
      airCtx.globalAlpha = alpha
      const image = flakeImages[f.shape]
      if (image.complete && image.naturalWidth > 0) {
        airCtx.drawImage(image, -radius, -radius, radius * 2, radius * 2)
      }
      airCtx.restore()
    }
  }
  if (snow) for (const c of contacts.values()) {
    airCtx.strokeStyle = 'rgba(61,85,104,.4)'; airCtx.lineWidth = 1.8; airCtx.beginPath()
    airCtx.arc(c.x, c.y, c.radius + 9, -Math.PI / 2, -Math.PI / 2 + Math.max(c.load, c.pen) * Math.PI * 2); airCtx.stroke()
  }
}
function frame(now: number) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now
  if (!document.hidden) {
    let soundSpeed = 0, soundX = .5, soundBroad = false
    for (const [id, c] of contacts) {
      if (c.camera && now - c.lastSeen > 180) { release(id); continue }
      const still = now - c.lastMove > 85
      if (still || c.speed < 18) { c.load = Math.min(1, c.load + dt * (snow ? .5 : .28)); stamp(c.x, c.y, c.radius, Math.max(c.load, c.pen), 1 - Math.exp(-dt * 14)) }
      const speed = still ? 0 : c.speed
      if (speed > soundSpeed) { soundSpeed = speed; soundX = c.x / width; soundBroad = c.radius > 20 }
    }
    sound?.motion(soundSpeed, soundX, soundBroad)
    if (dirty || now < settlingUntil || snowfall) {
      if (snowfall && surface instanceof SnowSurface) surface.cover(dt)
      surface.settle(dt); renderer.render(surface, width, height); dirty = false
    }
    drawAir(now, dt)
  }
  requestAnimationFrame(frame)
}
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); releaseAll(); status.textContent = 'Graphics paused. Reload to restore the surface.' })
canvas.addEventListener('webglcontextrestored', () => location.reload())
resize(); requestAnimationFrame(frame)
addEventListener('resize', resize); addEventListener('blur', releaseAll)
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); else { last = performance.now(); dirty = true } })
addEventListener('pagehide', () => { camera.stop(); sound?.dispose() })
