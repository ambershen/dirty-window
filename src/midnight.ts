import './midnight.css'
import { HandTracker } from './gestures/hand'
import { FrostedGlass } from './effects/FrostedGlass'
import { WaterSurface } from './effects/WaterSurface'
import { WaterAudioInput } from './audio/WaterAudio'
import { WaterSoundscape } from './audio/WaterSoundscape'
import { PondTouch } from './gestures/PondTouch'
import { BodyMotion } from './gestures/BodyMotion'

type Point = { x: number; y: number }
const app = document.getElementById('app')!
app.innerHTML = `
<canvas id="journey" aria-label="Frosted window"></canvas>
<nav class="scene-tools" aria-label="Scene controls">
<button id="frost-mode" aria-label="Frosted window mode" aria-pressed="true"><svg viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/></svg></button>
<button id="water-mode" aria-label="Water reflection mode" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15c0 3 2 4 4 4"/></svg></button>
<span class="tool-divider"></span>
<button id="speaker-toggle" data-water aria-label="Enable water sounds" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/></svg></button>
<button id="mic-toggle" data-water aria-label="Enable sound-reactive water" aria-pressed="false"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"/></svg></button>
<button id="sound-preview" data-water aria-label="Preview a sound pulse"><svg viewBox="0 0 24 24"><path d="M3 10v4M7 6v12M12 3v18M17 6v12M21 10v4"/></svg></button>
<button id="photo-source" aria-label="Choose photo"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 5"/></svg></button>
<button id="flip-camera" aria-label="Switch to front camera"><svg viewBox="0 0 24 24"><path d="M4 8a9 9 0 0 1 15-2l2 2M21 3v5h-5M20 16a9 9 0 0 1-15 2l-2-2M3 21v-5h5"/></svg></button>
<button id="clear-source" aria-label="Return to plain pond"><svg viewBox="0 0 24 24"><path d="M4 9c4-5 12-5 16 0M4 14c4-5 12-5 16 0M4 19c4-5 12-5 16 0"/></svg></button>
<button id="camera-toggle" aria-label="Open rear camera"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg></button>
<button id="record-toggle" aria-label="Record scene">●</button>
<button id="clear-drawing" aria-label="Reset frost"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v8M14 10v8"/></svg></button>
<button id="fullscreen-toggle" aria-label="Enter fullscreen"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg></button>
</nav><input id="photo-input" type="file" accept="image/*" hidden><p id="hint" class="sr-only" role="status"></p>`
const canvas = document.getElementById('journey') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const frost = new FrostedGlass()
const waterAudio = new WaterAudioInput()
const soundscape = new WaterSoundscape()
const bodyMotion = new BodyMotion()
const speakerButton = document.getElementById('speaker-toggle') as HTMLButtonElement
let lastGesture: Point | undefined, lastGestureTime = 0, sweep = 0, motionX = .5
let gesturePulse = 0, wasFist = false
let water: WaterSurface | undefined
let mode: 'frost' | 'water' = 'frost'
let lastRender = performance.now(), demoStart = -Infinity
const frostButton = document.getElementById('frost-mode') as HTMLButtonElement
const waterButton = document.getElementById('water-mode') as HTMLButtonElement
const micButton = document.getElementById('mic-toggle') as HTMLButtonElement
const video = document.createElement('video')
video.muted = true; video.playsInline = true
video.autoplay = true
video.setAttribute('aria-hidden','true')
video.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none'
app.appendChild(video)
const tracker = new HandTracker(video, { maxHz: 60, numHands: 1, minCutoff: 5, beta: 3 })
const hint = document.getElementById('hint')!
const cameraButton = document.getElementById('camera-toggle') as HTMLButtonElement
const photoInput=document.getElementById('photo-input') as HTMLInputElement
const photoButton=document.getElementById('photo-source') as HTMLButtonElement
const flipButton=document.getElementById('flip-camera') as HTMLButtonElement
let photo: HTMLCanvasElement | null=null
let facing: 'user'|'environment'='environment', mirrored=false, sourceEpoch=0
const recordButton = document.getElementById('record-toggle') as HTMLButtonElement
let width = innerWidth, height = innerHeight
let previousTip: Point | undefined
const pondTouch = new PondTouch()
let touchAudioStarted = false
let pointerDown = false, tracking = false, cameraOn = false
let recorder: MediaRecorder | null = null, recordTimer: ReturnType<typeof setTimeout> | undefined
let recordingStream: MediaStream | null = null
const frame = () => ({ x: 0, y: 0, w: width, h: height })
function resize() { width = innerWidth; height = innerHeight; const dpr = Math.min(devicePixelRatio, 1.5); canvas.width = width*dpr; canvas.height = height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); frost.resize(width,height); water?.resize(width,height) }
resize(); addEventListener('resize', resize)
function inside(p: Point) { const f = frame(); return p.x >= f.x && p.x <= f.x+f.w && p.y >= f.y && p.y <= f.y+f.h }
function point(p: Point) {
  if (!inside(p)) { previousTip = undefined; return }
  if(mode==='water')soundscape.touch(p.x/width,p.y/height,performance.now())
  if (!previousTip || Math.hypot(p.x-previousTip.x,p.y-previousTip.y)>2) {
    if(mode==='frost')frost.wipe(p.x,p.y,previousTip)
    else { water?.touch(p.x/width,p.y/height,performance.now());gesturePulse=.45 }
    previousTip = p
  }
}
canvas.addEventListener('pointerdown', e=>{
  if(e.button!==0||pondTouch.contacts.size>=5)return
  e.preventDefault();canvas.setPointerCapture(e.pointerId)
  const now=performance.now(),x=e.clientX/width,y=e.clientY/height
  pondTouch.down(e.pointerId,x,y,now);pointerDown=true;previousTip=undefined
  if(mode==='water'){
    water?.touch(x,y,now,.25,e.pointerId);gesturePulse=.12
    if(!touchAudioStarted&&!waterAudio.active)void startTouchAudio()
    else if(soundscape.active)soundscape.unlock()
  } else point({x:e.clientX,y:e.clientY})
})
canvas.addEventListener('pointermove', e=>{
  const move=pondTouch.move(e.pointerId,e.clientX/width,e.clientY/height,performance.now(),width/height)
  if(!move)return
  e.preventDefault()
  const p=move.point
  if(mode==='water'){
    water?.drag(e.pointerId,p.x,p.y,p.vx,p.vy)
    const speed=Math.hypot(p.vx*width/height,p.vy)
    if(speed>.02)water?.touch(p.x,p.y,p.time,.08+Math.min(1,speed)*.45,e.pointerId)
    if(move.swirl){water?.stir(move.swirl.x,move.swirl.y,move.swirl.rotation,move.swirl.radius);water?.pinch(move.swirl.x,move.swirl.y,move.swirl.compression,move.swirl.radius,move.swirl.axisX,move.swirl.axisY)}
    gesturePulse=Math.min(.25,speed*.12)
  } else frost.wipe(p.x*width,p.y*height,{x:move.previous.x*width,y:move.previous.y*height})
})
function endPointer(e:PointerEvent,cancelled=false){
  if(!pondTouch.contacts.has(e.pointerId))return
  pondTouch.up(e.pointerId);water?.release(e.pointerId)
  pointerDown=pondTouch.contacts.size>0;previousTip=undefined
  if(!pointerDown){if(cancelled)soundscape.damp();else soundscape.release()}
}
canvas.addEventListener('pointerup', e=>{soundscape.unlock();endPointer(e)})
canvas.addEventListener('touchend',()=>{if(!touchAudioStarted&&!waterAudio.active)void startTouchAudio();else soundscape.unlock()},{passive:true})
canvas.addEventListener('pointercancel', e=>endPointer(e,true))
canvas.addEventListener('lostpointercapture', e=>endPointer(e,true))
function clearContacts(){for(const id of pondTouch.contacts.keys())water?.release(id);pondTouch.clear();pointerDown=false;previousTip=undefined;soundscape.damp()}
addEventListener('blur',clearContacts)
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearContacts()})
document.getElementById('clear-drawing')!.onclick=()=>{clearContacts();frost.reset();water?.reset();hint.textContent=mode==='frost'?'Window frosted again.':'Water settled.'}
function stopCamera() { soundscape.damp(); (video.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());video.srcObject=null;bodyMotion.reset();lastGesture=undefined;tracking=false;cameraOn=false;cameraButton.setAttribute('aria-pressed','false');previousTip=undefined;cameraButton.setAttribute('aria-label', facing==='environment'?'Open rear camera':'Open front camera') }
async function startCamera(){
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){alert('手机摄像头需要 HTTPS 链接。当前地址仍可选择照片。');return}
  const epoch=++sourceEpoch
  cameraButton.disabled=flipButton.disabled=photoButton.disabled=true
  cameraButton.setAttribute('aria-label','Opening camera…')
  try{
    stopCamera()
    if(!await tracker.initCamera(message=>{hint.textContent=message},facing))throw new Error(tracker.cameraError)
    if(epoch!==sourceEpoch){stopCamera();return}
    photo=null;cameraOn=true
    const settings=(video.srcObject as MediaStream).getVideoTracks()[0].getSettings()
    mirrored=(settings.facingMode||facing)==='user'
    cameraButton.setAttribute('aria-pressed','true');cameraButton.setAttribute('aria-label','Stop camera')
    if(!matchMedia('(pointer:coarse)').matches&&mirrored){
      try{await tracker.initLandmarker();if(epoch===sourceEpoch)tracking=true}catch{hint.textContent='Camera ready. Touch drawing is available.'}
    }
  }catch(error){stopCamera();alert('Camera: '+(error instanceof Error?error.message:String(error)))}
  finally{cameraButton.disabled=flipButton.disabled=photoButton.disabled=false}
}
cameraButton.onclick=()=>{if(cameraOn){++sourceEpoch;stopCamera()}else void startCamera()}
flipButton.onclick=()=>{
  facing=facing==='environment'?'user':'environment'
  flipButton.setAttribute('aria-label',facing==='environment'?'Switch to front camera':'Switch to rear camera')
  void startCamera()
}
photoButton.onclick=()=>photoInput.click()
photoInput.onchange=async()=>{
  const file=photoInput.files?.[0];photoInput.value='';if(!file)return
  const epoch=++sourceEpoch,url=URL.createObjectURL(file)
  photoButton.disabled=cameraButton.disabled=flipButton.disabled=true
  try{
    const image=new Image();image.src=url;await image.decode()
    if(epoch!==sourceEpoch)return
    const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight))
    const resized=document.createElement('canvas');resized.width=Math.round(image.naturalWidth*scale);resized.height=Math.round(image.naturalHeight*scale)
    resized.getContext('2d')!.drawImage(image,0,0,resized.width,resized.height)
    stopCamera();photo=resized;clearContacts();hint.textContent='Photo ready. Touch to move the water.'
  }catch{alert('这张照片暂时无法读取，请尝试 JPEG 或 PNG。')}
  finally{URL.revokeObjectURL(url);photoButton.disabled=cameraButton.disabled=flipButton.disabled=false}
}
document.getElementById('clear-source')!.onclick=()=>{++sourceEpoch;stopCamera();photo=null;clearContacts()}

function setMode(next: 'frost' | 'water') {
  try {
    if(next==='water'&&!water){water=new WaterSurface();water.resize(width,height)}
    clearContacts();mode=next;previousTip=undefined;lastGesture=undefined;sweep=0;gesturePulse=0;bodyMotion.reset();wasFist=false
    if(next==='frost'){soundscape.mute();speakerButton.setAttribute('aria-pressed','false');speakerButton.setAttribute('aria-label','Enable water sounds');waterAudio.stop();micButton.setAttribute('aria-pressed','false');micButton.setAttribute('aria-label','Enable sound-reactive water')}
    frostButton.setAttribute('aria-pressed',String(next==='frost'))
    waterButton.setAttribute('aria-pressed',String(next==='water'))
    document.querySelectorAll<HTMLElement>('[data-water]').forEach(el=>el.hidden=next!=='water')
    document.getElementById('clear-drawing')!.setAttribute('aria-label',next==='frost'?'Reset frost':'Settle water')
    canvas.setAttribute('aria-label',next==='frost'?'Frosted window':'Sound-reactive water reflection')
    hint.textContent=next==='water'?'Water mode. Enable the microphone or preview a sound pulse.':'Frosted window mode.'
  } catch(error){hint.textContent=error instanceof Error?error.message:String(error);waterButton.disabled=true}
}
frostButton.onclick=()=>setMode('frost')
waterButton.onclick=()=>setMode('water')
async function startTouchAudio(){
  // Keep resume inside the native input handler; never lock out retries on failure.
  try{
    await soundscape.enable()
    touchAudioStarted=soundscape.active
    speakerButton.setAttribute('aria-pressed',String(soundscape.active))
    speakerButton.setAttribute('aria-label',soundscape.active?'Mute water sounds':'Enable water sounds')
    if(soundscape.active)soundscape.preview()
  }catch(error){touchAudioStarted=false;hint.textContent='Tap the speaker to retry water audio.';speakerButton.dataset.error='true'}
}
speakerButton.onclick=async()=>{
  touchAudioStarted=true
  speakerButton.disabled=true
  try {
    if(soundscape.active)soundscape.mute()
    else {
      waterAudio.stop();micButton.setAttribute('aria-pressed','false');micButton.setAttribute('aria-label','Enable sound-reactive water')
      await soundscape.enable();demoStart=performance.now();water?.touch(.5,.5,demoStart);soundscape.preview()
    }
    speakerButton.setAttribute('aria-pressed',String(soundscape.active))
    speakerButton.setAttribute('aria-label',soundscape.active?'Mute water sounds':'Enable water sounds')
    hint.textContent=soundscape.active?'Pond sounds on. Touch, gently drag, then lift your finger.':'Water sounds muted.'
  } catch(error){hint.textContent='Sound unavailable: '+(error instanceof Error?error.message:String(error))}
  finally {speakerButton.disabled=false}
}
micButton.onclick=async()=>{
  micButton.disabled=true
  try {
    if(waterAudio.active)waterAudio.stop()
    else {soundscape.mute();speakerButton.setAttribute('aria-pressed','false');speakerButton.setAttribute('aria-label','Enable water sounds');await waterAudio.start()}
    micButton.setAttribute('aria-pressed',String(waterAudio.active))
    micButton.setAttribute('aria-label',waterAudio.active?'Stop microphone':'Enable sound-reactive water')
    hint.textContent=waterAudio.active?'Sound is moving the water. Microphone audio stays on this device.':'Microphone off.'
    delete micButton.dataset.error
  } catch(error){micButton.dataset.error='true';hint.textContent='Microphone unavailable: '+(error instanceof Error?error.message:String(error))}
  finally {micButton.disabled=false}
}
document.getElementById('sound-preview')!.onclick=()=>{
  demoStart=performance.now();water?.touch(.5,.5,demoStart);soundscape.preview()
  hint.textContent='Previewing a sound pulse without microphone input.'
}

recordButton.onclick=()=>{
  if(recorder?.state==='recording'){recorder.stop();return}
  if(!('MediaRecorder' in window) || !canvas.captureStream){hint.textContent='Recording is unavailable in this browser.';return}
  try {
    recordingStream=canvas.captureStream(30);recorder=new MediaRecorder(recordingStream);const chunks:BlobPart[]=[]
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
    recorder.onstop=()=>{clearTimeout(recordTimer);recordingStream?.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:recorder!.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`dirty-window.${blob.type.includes('mp4')?'mp4':'webm'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);recordButton.setAttribute('aria-label', 'Record scene');recordButton.setAttribute('aria-pressed','false');hint.textContent='Your silent scene recording is ready.'}
    recorder.start();recordButton.setAttribute('aria-pressed','true');recordButton.setAttribute('aria-label', '■ Stop recording');hint.textContent='Recording the scene for up to 15 seconds. Microphone audio is not recorded.';recordTimer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},15000)
  } catch(e){recordingStream?.getTracks().forEach(t=>t.stop());hint.textContent=`Recording unavailable: ${e instanceof Error?e.message:e}`}
}
// Match tracking coordinates to the camera image's cover crop.
function cameraPoint(x: number, y: number): Point {
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight)
  return { x: (width - video.videoWidth * scale) / 2 + x * video.videoWidth * scale,
    y: (height - video.videoHeight * scale) / 2 + y * video.videoHeight * scale }
}
const fullscreenButton = document.getElementById('fullscreen-toggle') as HTMLButtonElement
fullscreenButton.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch { hint.textContent = 'Fullscreen is unavailable in this browser.' }
}
addEventListener('fullscreenchange', () => {
  fullscreenButton.setAttribute('aria-pressed', String(!!document.fullscreenElement))
  fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen')
})
let hideTools: ReturnType<typeof setTimeout>
function revealTools() {
  document.body.classList.remove('tools-idle')
  clearTimeout(hideTools)
  hideTools = setTimeout(() => document.body.classList.add('tools-idle'), 2200)
}
addEventListener('pointermove', revealTools)
addEventListener('pointerdown', revealTools)
addEventListener('keydown', revealTools)
revealTools()
function render(now:number) {
  const dt=Math.min((now-lastRender)/1000,.1);lastRender=now
  const audio=waterAudio.sample(dt)
  const demo=Math.exp(-(now-demoStart)/700)
  const levels={level:Math.max(audio.level,demo),bass:Math.max(audio.bass,demo*.8),treble:Math.max(audio.treble,demo*.4)}
  micButton.style.setProperty('--sound',String(levels.level))
  let fist=false
  if(tracking&&!pointerDown){
    try {
      tracker.update(now)
      const hand=tracker.hands[0]
      if(hand?.isPointing&&!hand.isFist)point(cameraPoint(hand.indexTipX,hand.indexTipY))
      else previousTip=undefined
      if(mode==='water'&&hand){
        fist=hand.isFist
        if(fist&&!wasFist){water?.reset();soundscape.damp();gesturePulse=0;demoStart=-Infinity}
        if(!fist&&!hand.isPointing&&hand.openness>.3){
          const p=cameraPoint(hand.x,hand.y)
          soundscape.touch(p.x/width,p.y/height,now)
          if(lastGesture){
            const elapsed=Math.max(.016,(now-lastGestureTime)/1000)
            const speed=Math.min(1,Math.hypot(p.x-lastGesture.x,p.y-lastGesture.y)/width/elapsed)
            sweep=Math.max(sweep,speed);motionX=p.x/width
            if(speed>.12)water?.touch(p.x/width,p.y/height,now)
          }
          lastGesture=p;lastGestureTime=now
        } else lastGesture=undefined
      } else lastGesture=undefined
    } catch {tracking=false;hint.textContent='Hand tracking paused. Restart the camera to retry.'}
  }
  wasFist=fist
  if(mode==='water'){
    const motion=cameraOn?bodyMotion.sample(video,now):{energy:0,x:.5}
    sweep*=Math.exp(-dt*5);gesturePulse*=Math.exp(-dt*3)
    const movement=fist?0:Math.max(motion.energy,sweep)
    if(pointerDown){
      const contacts=[...pondTouch.contacts.values()]
      const x=contacts.reduce((sum,p)=>sum+p.x,0)/contacts.length
      const y=contacts.reduce((sum,p)=>sum+p.y,0)/contacts.length
      const speed=Math.max(...contacts.map(p=>Math.hypot(p.vx,p.vy)*Math.exp(-Math.max(0,now-p.time-40)/65)))
      soundscape.motion(x,y,speed,now)
    }
    soundscape.tick(now)
    if(fist){levels.level=levels.bass=levels.treble=0}
    else {
      levels.level=Math.max(levels.level,movement*.75,gesturePulse)
      levels.bass=Math.max(levels.bass,movement*.65)
      levels.treble=Math.max(levels.treble,sweep*.25,gesturePulse*.3)
    }
  }
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#111a1c';ctx.fillRect(0,0,width,height)
  const f=frame();ctx.save();ctx.beginPath();ctx.rect(f.x,f.y,f.w,f.h);ctx.clip()
  const imageSource=cameraOn&&video.readyState>=2?video:photo
  if(imageSource){
    const sw=imageSource===video?video.videoWidth:photo!.width,sh=imageSource===video?video.videoHeight:photo!.height
    const scale=Math.max(width/sw,height/sh)
    ctx.save();if(imageSource===video&&mirrored){ctx.translate(width,0);ctx.scale(-1,1)}
    ctx.drawImage(imageSource,(width-sw*scale)/2,(height-sh*scale)/2,sw*scale,sh*scale);ctx.restore()
  }
  if(mode==='frost')ctx.drawImage(frost.render(canvas,now),0,0,width,height)
  else if(water){
    try {ctx.drawImage(water.render(canvas,now,levels,!!imageSource),0,0,width,height)}
    catch(error){setMode('frost');hint.textContent=error instanceof Error?error.message:String(error)}
  }
  ctx.restore()
  requestAnimationFrame(render)
}
setMode('water')
// Touch devices begin with the pool photo; later source choices take priority.
if (matchMedia('(pointer:coarse)').matches || new URLSearchParams(location.search).get('background') === 'pool') {
  const initialEpoch=sourceEpoch
  const pool=new Image()
  pool.src='/images/swimming-pool.jpg'
  void pool.decode().then(()=>{
    if(sourceEpoch!==initialEpoch || cameraOn || photo)return
    const base=document.createElement('canvas')
    base.width=pool.naturalWidth;base.height=pool.naturalHeight
    base.getContext('2d')!.drawImage(pool,0,0)
    photo=base
  }).catch(()=>{hint.textContent='Pool photo unavailable. You can still touch the water.'})
}
requestAnimationFrame(render)
addEventListener('pagehide',()=>{stopCamera();waterAudio.stop();soundscape.dispose();if(recorder?.state==='recording')recorder.stop()})
