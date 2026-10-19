// Re-record the landing page motion demos: start `npx vite --port 5210`, then
//   node scripts/record-demos.mjs <scratch-dir> public/media [material]
// Record short motion demos of each material: scripted gestures, UI hidden, screencast → H.264 loop.
import { spawn, execFileSync } from 'node:child_process'; import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
const [S, OUT, only] = [process.argv[2], process.argv[3], process.argv[4]]
const W = 720, H = 960
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new','--remote-debugging-port=9342',`--user-data-dir=${S}/rec-prof`,'--autoplay-policy=no-user-gesture-required','--hide-scrollbars','about:blank'], { stdio: 'ignore' })
const wait = ms => new Promise(r => setTimeout(r, ms))
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch('http://127.0.0.1:9342/json')).json(); break } catch { await wait(250) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pending = new Map(); let frames = null
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) pending.get(m.id)?.(m)
  if (m.method === 'Page.screencastFrame') { frames?.push({ data: m.params.data, t: m.params.metadata.timestamp }); ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } })) } }
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const js = expr => send('Runtime.evaluate', { expression: expr, returnByValue: true })
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 })
const key = async k => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: 'Key' + k.toUpperCase(), text: type === 'keyDown' ? k : undefined }) }
/** Drag along f(t) for t in 0..1 over ms milliseconds. */
const drag = async (f, ms, { hold = 0 } = {}) => {
  let [x, y] = f(0); await mouse("mousePressed", x, y); const start = Date.now()
  for (let p = 0; p < 1;) { p = Math.min(1, (Date.now() - start) / ms); [x, y] = f(p); await mouse("mouseMoved", x, y); await wait(8) }
  if (hold) await wait(hold); await mouse('mouseReleased', x, y)
}
const press = async (x, y, ms) => { await mouse('mousePressed', x, y); const start = Date.now(); for (let i = 0; Date.now() - start < ms; i++) { await mouse("mouseMoved", x + Math.sin(i) * .3, y); await wait(60) } await mouse('mouseReleased', x, y) }
const line = (a, b, wobble = 0) => t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI * 2) * wobble]
const demos = {
  water: { url: '?mode=water', prep: 3000, run: async () => {
    await drag(t => [110 + 500 * t, 330 + Math.sin(t * Math.PI * 2) * 120], 2600); await wait(500)
    await drag(t => [620 - 470 * t, 640 + Math.sin(t * Math.PI * 1.5) * 90], 2400); await wait(2200) } },
  ice: { url: '?mode=ice', prep: 5000, run: async () => {
    await drag(line([140, 360], [580, 470], 30), 1700); await wait(300)
    await drag(line([200, 640], [470, 560]), 900, { hold: 2600 }); await wait(1600) } },
  steam: { url: '?mode=steam&effect=palm', prep: 2500, setup: async () => { await key('d'); await wait(7000) }, run: async () => {
    await drag(t => { const a = Math.PI * 2 * t; return [360 + 150 * Math.pow(Math.sin(a), 3), 470 - (120 * Math.cos(a) - 48 * Math.cos(2 * a) - 20 * Math.cos(3 * a) - 10 * Math.cos(4 * a))] }, 3200)
    await wait(1600); await key('r'); await wait(3400) } },
  sand: { url: '?mode=sand', prep: 3500, run: async () => {
    await drag(t => [100 + 520 * t, 380 + Math.sin(t * Math.PI * 3) * 70], 2800); await wait(300)
    await key('p'); await drag(line([110, 680], [610, 640], 25), 1800); await wait(1800) } },
  snow: { url: '?mode=snow', prep: 3500, setup: async () => { await js(`document.getElementById('snowfall').click()`); await wait(3000) }, run: async () => {
    await drag(t => [120 + 480 * t, 400 + Math.sin(t * Math.PI * 2) * 70], 3400); await wait(200)
    await key('p'); for (const [x, y] of [[230, 660], [480, 690]]) await press(x, y, 1500); await wait(1600) } },
}
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
for (const [name, d] of Object.entries(demos)) {
  if (only && only !== name) continue
  await send('Page.navigate', { url: `http://localhost:5210/${d.url}` }); await wait(d.prep)
  await js(`document.body.classList.add('ui-hidden');document.querySelectorAll('.dock-guide').forEach(e=>e.remove())`)
  if (d.setup) await d.setup()
  await wait(400); frames = []
  await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  await wait(300); await d.run(); await send('Page.stopScreencast')
  console.log(name, 'frames captured:', frames.length); if (!frames.length) continue
  const dir = `${S}/rec-${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir)
  let list = 'ffconcat version 1.0\n'
  frames.forEach((f, i) => { const file = `${dir}/${String(i).padStart(5, '0')}.jpg`; writeFileSync(file, Buffer.from(f.data, 'base64')); list += `file '${file}'\nduration ${((frames[i + 1]?.t ?? f.t + 1 / 30) - f.t).toFixed(4)}\n` })
  list += `file '${dir}/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`; writeFileSync(`${dir}/list.txt`, list)
  const secs = frames.at(-1).t - frames[0].t
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=30,scale=540:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', '-an', `${OUT}/${name}.mp4`])
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, secs * .62)), '-i', `${OUT}/${name}.mp4`, '-frames:v', '1', '-q:v', '4', `${OUT}/${name}.jpg`])
  console.log(name, `${frames.length} frames over ${secs.toFixed(1)} s = ${(frames.length / secs).toFixed(1)} fps`)
}
chrome.kill(); process.exit(0)
