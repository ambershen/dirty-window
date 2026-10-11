import { HandTracker } from './gestures/hand'
import { WaterSurface } from './effects/WaterSurface'
import { WaterSoundscape } from './audio/WaterSoundscape'
import './projector.css'

type Gesture = 'none'|'point'|'palm'|'fist'
type Input = {type:'hand'; gesture:Gesture; x:number;y:number}
const output=new URLSearchParams(location.search).get('view')==='output'
document.body.classList.add('pond-projector')
const channel=new BroadcastChannel('pond-wall-v1')
const app=document.getElementById('app')!
const clamp=(n:number)=>Math.max(0,Math.min(1,n))

if(output) {
 app.innerHTML='<canvas aria-label="Projected pool"></canvas><button id="enter">Enter projection · fullscreen</button><p id="error" role="status"></p>'
 const canvas=app.querySelector('canvas')!,ctx=canvas.getContext('2d')!
 const base=document.createElement('canvas'),b=base.getContext('2d')!,pool=new Image()
 const water=new WaterSurface()
 let gravity=.35,last=performance.now(),received=-Infinity,previous: {x:number;y:number;t:number}|null=null
 let hand:Input={type:'hand',gesture:'none',x:.5,y:.5},nextDrop=0
 const drops: {x:number;y:number;v:number;life:number;id:number}[]=[]
 function resize(){canvas.width=base.width=Math.round(innerWidth*Math.min(devicePixelRatio,1.5));canvas.height=base.height=Math.round(innerHeight*Math.min(devicePixelRatio,1.5));water.resize(canvas.width,canvas.height)}
 resize();addEventListener('resize',resize)
 pool.src='/images/water-sunlight.png';pool.decode().catch(()=>{document.getElementById('error')!.textContent='Pool image could not load. Reload to retry.'})
 channel.onmessage=({data})=>{
  if(data.type==='hand'&&['none','point','palm','fist'].includes(data.gesture)&&Number.isFinite(data.x)&&Number.isFinite(data.y)){hand={...data,x:clamp(data.x),y:clamp(data.y)};received=performance.now()}
  if(data.type==='gravity'&&Number.isFinite(data.value))gravity=clamp(data.value)
  if(data.type==='reset'){water.reset();drops.length=0;previous=null;hand.gesture='none'}
 }
 const enter=document.getElementById('enter')!
 enter.onclick=async()=>{try{await document.documentElement.requestFullscreen();enter.hidden=true}catch{enter.textContent='Fullscreen unavailable · double-click to retry'}}
 canvas.ondblclick=()=>{void document.documentElement.requestFullscreen().catch(()=>{})}
 document.addEventListener('fullscreenchange',()=>{enter.hidden=!!document.fullscreenElement})
 function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now
  const active=now-received<300&&(hand.gesture==='point'||hand.gesture==='palm')
  if(active){
   const elapsed=previous?Math.max(.016,(now-previous.t)/1000):.033
   const vx=previous?Math.max(-2,Math.min(2,(hand.x-previous.x)/elapsed)):0,vy=previous?Math.max(-2,Math.min(2,(hand.y-previous.y)/elapsed)):0
   const speed=Math.hypot(vx,vy)
   water.drag(1,hand.x,hand.y,vx,vy)
   if(!previous||speed>.035){
    water.touch(hand.x,hand.y,now,hand.gesture==='palm'?.7:.4,1)
    if(hand.gesture==='palm'){water.touch(clamp(hand.x-.045),hand.y,now,.4,2);water.touch(clamp(hand.x+.045),hand.y,now,.4,3)}
    if(gravity>0&&now>nextDrop&&drops.length<4){drops.push({x:hand.x,y:hand.y,v:.015,life:0,id:10+now});nextDrop=now+180}
   }
   previous={x:hand.x,y:hand.y,t:now}
  }else{water.release(1);previous=null}
  for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.life+=dt;d.v+=gravity*.22*dt;d.y+=d.v*dt
   water.drag(d.id,d.x,d.y,0,d.v);water.touch(d.x,d.y,now,.15,d.id)
   if(d.y>1||d.life>2.5||gravity===0){water.release(d.id);drops.splice(i,1)}
  }
  b.fillStyle='#143e49';b.fillRect(0,0,base.width,base.height)
  if(pool.complete&&pool.naturalWidth){const scale=Math.max(base.width/pool.naturalWidth,base.height/pool.naturalHeight);b.drawImage(pool,(base.width-pool.naturalWidth*scale)/2,(base.height-pool.naturalHeight*scale)/2,pool.naturalWidth*scale,pool.naturalHeight*scale)}
  try{ctx.drawImage(water.render(base,now,{level:0,bass:0,treble:0},true),0,0,canvas.width,canvas.height)}catch(e){document.getElementById('error')!.textContent=String(e);return}
  requestAnimationFrame(frame)
 }
 requestAnimationFrame(frame)
 const beat=setInterval(()=>channel.postMessage({type:'ready'}),500)
 addEventListener('pagehide',()=>{clearInterval(beat);channel.close()})
}else{
 app.innerHTML=`<main><header><span>POND / WALL STUDY 01</span><h1>A pool on the wall.</h1><p>Move a hand. Leave a trace.</p></header><div class="layout"><section><div id="pad" aria-label="Mouse test area"><video muted playsinline></video><i id="cursor"></i><span>Drag here to test the projected water</span></div><p id="status" role="status">Camera off · mouse test available</p><div class="actions"><button id="open">Open projector window ↗</button><button id="wall-camera">Start camera</button><button id="sound">Enable sound</button></div><p id="connection">Projection window not connected</p></section><aside><h2>Set up the wall</h2><ol><li>Use your projector as an extended display.</li><li>Move the pool window onto it and click “Enter projection”.</li><li>Keep this controller visible on your Mac. Aim the camera toward you.</li></ol><label>Downward flow <input id="gravity" type="range" min="0" max="1" step=".05" value=".35"></label><label>Hand reach <input id="reach" type="range" min=".5" max="2.5" step=".05" value="1"></label><label>Horizontal alignment <input id="offsetX" type="range" min="-.5" max=".5" step=".01" value="0"></label><label>Vertical alignment <input id="offsetY" type="range" min="-.5" max=".5" step=".01" value="0"></label><label class="check"><input id="mirror" type="checkbox" checked> Mirror hand direction</label><button id="reset">Settle water</button><p class="note">Point for small ripples. Open your palm to push water. Make a fist to stop adding waves.<br><br>This tracks gestures in the air, not contact with the wall. Camera processing stays on this device.</p></aside></div></main>`
 const video=app.querySelector('video')!,status=document.getElementById('status')!,pad=document.getElementById('pad')!,cursor=document.getElementById('cursor')!
 const camera=document.getElementById('wall-camera') as HTMLButtonElement,sound=document.getElementById('sound') as HTMLButtonElement
 const input=(id:string)=>document.getElementById(id) as HTMLInputElement
 const tracker=new HandTracker(video,{maxHz:30,numHands:1,minCutoff:5,beta:3,wasmPath:'/vision',modelUrl:'/hand_landmarker.task'})
 const audio=new WaterSoundscape()
 let active=false,loaded=false,dragging=false,heartbeat=-Infinity,previous:{x:number;y:number;t:number}|null=null
 let lastFrame=0
 const send=(gesture:Gesture,x=.5,y=.5)=>{
  const now=performance.now(),down=gesture==='point'||gesture==='palm'
  channel.postMessage({type:'hand',gesture,x,y})
  cursor.style.left=`${x*100}%`;cursor.style.top=`${y*100}%`;cursor.hidden=!down
  if(down){const speed=previous?Math.min(2,Math.hypot(x-previous.x,y-previous.y)/Math.max(.016,(now-previous.t)/1000)):0;if(!previous)audio.touch(x,y,now);audio.motion(x,y,speed,now);previous={x,y,t:now}}
  else {if(previous){if(gesture==='fist')audio.damp();else audio.release()}previous=null}
 }
 const publishGravity=()=>channel.postMessage({type:'gravity',value:Number(input('gravity').value)})
 channel.onmessage=({data})=>{if(data.type==='ready'){heartbeat=performance.now();publishGravity()}}
 document.getElementById('open')!.onclick=()=>{const url=new URL(location.href);url.search='?mode=projector&view=output';const w=window.open(url,'pond-wall-output','popup,width=1280,height=720');if(!w)status.textContent='Allow this site to open the projector window, then try again.'}
 camera.onclick=async()=>{
  if(active){active=false;video.srcObject && (video.srcObject as MediaStream).getTracks().forEach(t=>t.stop());video.srcObject=null;send('none');camera.textContent='Start camera';status.textContent='Camera off';return}
  camera.disabled=true
  try{status.textContent='Starting camera…';if(!await tracker.initCamera(undefined,'user'))throw new Error(tracker.cameraError);if(!loaded){status.textContent='Loading hand tracker…';await tracker.initLandmarker();loaded=true}active=true;camera.textContent='Stop camera'}
  catch(e){(video.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());video.srcObject=null;status.textContent=String(e)}finally{camera.disabled=false}
 }
 sound.onclick=async()=>{try{if(audio.active){audio.mute();sound.textContent='Enable sound'}else{await audio.enable();sound.textContent='Mute sound'}}catch{status.textContent='Sound could not start. Click Enable sound to retry.'}}
 input('gravity').oninput=publishGravity
 input('mirror').onchange=()=>{video.style.transform=input('mirror').checked?'scaleX(-1)':'none'}
 document.getElementById('reset')!.onclick=()=>{channel.postMessage({type:'reset'});audio.damp()}
 function mouse(e:PointerEvent){const r=pad.getBoundingClientRect();send('point',clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height))}
 pad.onpointerdown=e=>{pad.setPointerCapture(e.pointerId);dragging=true;mouse(e)}
 pad.onpointermove=e=>{if(dragging)mouse(e)}
 pad.onpointerup=pad.onpointercancel=()=>{dragging=false;send('none')}
 function frame(){const now=performance.now();audio.tick(now)
  document.getElementById('connection')!.textContent=now-heartbeat<1800?'Projection connected':'Projection disconnected · open the pool window'
  if(active&&!dragging){try{tracker.update(now);const h=tracker.hands[0];const gesture:Gesture=!h?'none':h.isFist?'fist':h.isPointing?'point':h.openness>.55?'palm':'none';let x=h?(gesture==='point'?h.indexTipX:h.x):.5,y=h?(gesture==='point'?h.indexTipY:h.y):.5;if(!input('mirror').checked)x=1-x;const reach=Number(input('reach').value);x=(x-.5)*reach+.5+Number(input('offsetX').value);y=(y-.5)*reach+.5+Number(input('offsetY').value);const inside=x>=0&&x<=1&&y>=0&&y<=1;send(inside?gesture:'none',clamp(x),clamp(y));status.textContent=!h?'No hand detected':!inside?'Hand outside mapped area':gesture==='none'?'Open your palm or point one finger':gesture==='fist'?'Fist · resting':gesture==='palm'?'Palm · pushing water':'Fingertip · drawing ripples'}catch{active=false;(video.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());camera.textContent='Start camera';status.textContent='Tracking stopped. Restart the camera.';send('none')}}
  if(now-lastFrame>500&&previous){send('none')}lastFrame=now
  setTimeout(frame,33)
 }
 frame()
 addEventListener('pagehide',()=>{active=false;(video.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());send('none');audio.dispose();channel.close()})
}
