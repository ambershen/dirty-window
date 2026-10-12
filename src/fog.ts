import './fog.css'
import { FogCamera } from './gestures/FogCamera'
import { FogBreath } from './gestures/FogBreath'
const app=document.getElementById('app')!
app.innerHTML='<canvas id="fog-window" aria-label="Before It Disappears — draw on the fogged window"></canvas><nav id="fog-tools"><button id="fog-camera" aria-label="Enable camera: pinch to write, open palm to wipe" aria-pressed="false">◎</button><button id="fog-photo" aria-label="Choose the view behind the glass">▧</button><button id="fog-reset" aria-label="Fog the window again">↺</button></nav><input id="fog-file" type="file" accept="image/*" hidden><p id="fog-status" role="status"></p>'
const settings={dirty:1,temperature:50,hold:5,fade:30,brush:7}
const controls=document.createElement('details');controls.id='fog-controls'
controls.innerHTML='<summary>Temporary Canvas</summary><div class="fog-control-body"><p>Pinch to write · Open palm to wipe</p><label>Dirty Level <output id="fog-dirty-value">100%</output><input id="fog-dirty" type="range" min="0" max="100" value="100"></label><label>Temperature <output id="fog-temperature-value">50%</output><input id="fog-temperature" type="range" min="0" max="100" value="50"><span class="fog-temperature-scale">Cool · More fog <span>Warm · Lighter fog</span></span></label><label>Brush <output id="fog-brush-value">7</output><input id="fog-brush" type="range" min="3" max="24" value="7"></label><button id="fog-breath" type="button" aria-pressed="false">Enable breath · experimental</button><p id="fog-breath-status" role="status"></p><button id="fog-panel-reset" type="button">Reset Fog</button></div>'
app.append(controls)
const canvas=document.getElementById('fog-window') as HTMLCanvasElement,ctx=canvas.getContext('2d')!
function layer(){const c=document.createElement('canvas');return {c,g:c.getContext('2d')!}}
const scene=layer(),veil=layer(),wet=layer(),mask=layer(),composite=layer()
// Reuse brush textures instead of allocating thousands of gradients every frame.
const brushes=Array.from({length:17},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!,v=i/16,gradient=g.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff');gradient.addColorStop(.25+.47*v,'rgba(255,255,255,.85)');gradient.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gradient;g.fillRect(0,0,64,64);return c})
// A palm wipe: long across the hand, short along the motion, with fainter lines where
// the gaps between fingers leave condensation behind. x runs along the motion, y across.
const wipeBrush=(()=>{const c=document.createElement('canvas');c.width=48;c.height=128;const g=c.getContext('2d')!,image=g.createImageData(48,128)
 const fibres=Array.from({length:128},()=>.7+.3*Math.random())
 for(let j=0;j<128;j++)for(let i=0;i<48;i++){
  const u=(j+.5)/64-1,v=(i+.5)/24-1,reach=Math.hypot(u,v),edge=reach>=1?0:reach<.72?1:(1-reach)/.28
  const fingers=.4+.6*Math.pow(Math.abs(Math.sin(u*Math.PI*2)),.35)
  const k=(j*48+i)*4;image.data[k]=image.data[k+1]=image.data[k+2]=255;image.data[k+3]=255*edge*edge*(3-2*edge)*fingers*fibres[j]
 }
 g.putImageData(image,0,0);return c})()
// A bead of collected water at the head of a drip.
const bead=(()=>{const c=document.createElement('canvas');c.width=c.height=24;const g=c.getContext('2d')!,gradient=g.createRadialGradient(10,9,0,12,12,12)
 gradient.addColorStop(0,'rgba(252,253,250,.85)');gradient.addColorStop(.45,'rgba(220,228,224,.35)');gradient.addColorStop(.8,'rgba(55,64,60,.35)');gradient.addColorStop(1,'rgba(55,64,60,0)')
 g.fillStyle=gradient;g.fillRect(0,0,24,24);return c})()
let maskDirty=true,lastMask=-Infinity
type Mark={x:number;y:number;px:number;py:number;r:number;born:number;hold:number;fade:number;drawing?:boolean;cos?:number;sin?:number}
type Drip={x:number;y:number;lx:number;ly:number;speed:number;r:number;life:number;age:number;phase:number}
const marks:Mark[]=[],drips:Drip[]=[],hands=new Map<number,{x:number;y:number;t:number;r:number;distance:number;marks:Mark[];dx?:number;dy?:number;water?:number}>()
const WIPE_ALPHA=.3
const stepOf=(s:Mark)=>s.cos!==undefined?Math.max(7,s.r*.22):s.r<10?Math.max(1.5,s.r*.6):7
function stamp(g:CanvasRenderingContext2D,s:Mark,x:number,y:number,clarity:number){
 if(s.cos===undefined){g.globalAlpha=.92*clarity;g.drawImage(brushes[Math.round(clarity*16)],x-s.r,y-s.r,s.r*2,s.r*2);return}
 // Overlapping low-alpha stamps: one pass leaves a streaky film, a second pass clears it.
 g.globalAlpha=WIPE_ALPHA*clarity;g.setTransform(s.cos,s.sin!,-s.sin!,s.cos,x,y);g.drawImage(wipeBrush,-s.r*.45,-s.r,s.r*.9,s.r*2);g.setTransform(1,0,0,1,0,0)
}
function spawnDrip(x:number,y:number){if(drips.length<28)drips.push({x,y,lx:x,ly:y,speed:22+Math.random()*48,r:1.5+Math.random()*1.7,life:1.2+Math.random()*3.8,age:0,phase:Math.random()*6.3})}
let w=1,h=1,last=performance.now(),photo:HTMLImageElement|null=null,sourceEpoch=0
const status=document.getElementById('fog-status')!
function drawScene(){const warmth=settings.temperature/100;const video=camera.reflection,g=scene.g;const gradient=g.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#60676b');gradient.addColorStop(.6,'#81898c');gradient.addColorStop(1,'#a3aaac');g.fillStyle=gradient;g.fillRect(0,0,w,h)
 if(video){const s=Math.max(w/video.videoWidth,h/video.videoHeight);g.save();g.translate(w,0);g.scale(-1,1);g.drawImage(video,(w-video.videoWidth*s)/2,(h-video.videoHeight*s)/2,video.videoWidth*s,video.videoHeight*s);g.restore()}
 else if(photo){const s=Math.max(w/photo.naturalWidth,h/photo.naturalHeight);g.drawImage(photo,(w-photo.naturalWidth*s)/2,(h-photo.naturalHeight*s)/2,photo.naturalWidth*s,photo.naturalHeight*s)}
 // A soft veil over the actual view, without baked highlights or droplets. It is blurred at
 // quarter resolution: the result looks the same, and a full-screen blur every camera frame
 // starved the hand tracker on the main thread.
 const v=veil.g,vw=veil.c.width,vh=veil.c.height;v.clearRect(0,0,vw,vh);v.save();v.filter=`blur(${(video?18:32)*(.25+.75*settings.dirty)*(1.4-.8*warmth)/VEIL_SCALE}px)`;v.drawImage(scene.c,-5,-5,vw+10,vh+10);v.restore();v.fillStyle=video?`rgba(195,200,193,${.68-.4*warmth})`:`rgba(174,179,175,${.96-.2*warmth})`;v.fillRect(0,0,vw,vh)
}
const VEIL_SCALE=4
function texture(){
 const g=wet.g;g.clearRect(0,0,w,h)
 // Cached layers: cloudy moisture, old runnels, fine grain and refractive beads.
 for(let i=0;i<65;i++){
  const x=Math.random()*w,y=Math.random()*h,r=30+Math.random()*Math.min(w,h)*.32
  const mist=g.createRadialGradient(x,y,0,x,y,r)
  mist.addColorStop(0,i%3?'rgba(224,230,226,.035)':'rgba(75,81,77,.025)')
  mist.addColorStop(1,'rgba(200,220,220,0)');g.fillStyle=mist;g.fillRect(x-r,y-r,r*2,r*2)
 }
 const grain=g.createImageData(Math.ceil(w),Math.ceil(h))
 for(let i=0;i<grain.data.length;i+=4){const light=Math.random()>.48;grain.data[i]=light?232:72;grain.data[i+1]=light?236:79;grain.data[i+2]=light?229:75;grain.data[i+3]=Math.floor(Math.random()*5)}
 const noise=document.createElement('canvas');noise.width=Math.ceil(w);noise.height=Math.ceil(h);noise.getContext('2d')!.putImageData(grain,0,0);g.drawImage(noise,0,0)
 const edge=g.createLinearGradient(0,0,0,h);edge.addColorStop(0,'rgba(65,75,70,.22)');edge.addColorStop(.12,'rgba(65,75,70,0)');edge.addColorStop(.8,'rgba(65,75,70,0)');edge.addColorStop(1,'rgba(65,75,70,.28)');g.fillStyle=edge;g.fillRect(0,0,w,h)
}
function reset(){maskDirty=true;marks.length=0;drips.length=0;hands.clear();mask.g.clearRect(0,0,w,h)}
function resize(){w=innerWidth;h=innerHeight;const dpr=Math.min(1.5,devicePixelRatio);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);for(const {c} of [scene,wet,mask,composite]){c.width=w;c.height=h}veil.c.width=Math.ceil(w/VEIL_SCALE);veil.c.height=Math.ceil(h/VEIL_SCALE);reset();texture();drawScene()}
function mark(x:number,y:number,px:number,py:number,r:number,now:number,hold=settings.hold,fade=settings.fade,angle?:number){const stroke:Mark={x,y,px,py,r,born:now,hold,fade};if(angle!==undefined){stroke.cos=Math.cos(angle);stroke.sin=Math.sin(angle)}marks.push(stroke);
 const g=mask.g,steps=Math.max(1,Math.ceil(Math.hypot(x-px,y-py)/stepOf(stroke)));g.globalCompositeOperation='source-over'
 for(let j=0;j<steps;j++){const t=(j+.5)/steps;stamp(g,stroke,px+(x-px)*t,py+(y-py)*t,1)}g.globalAlpha=1
 return stroke}
function startDrawing(id:number,x:number,y:number,now:number){const stroke=mark(x,y,x,y,settings.brush,now);stroke.drawing=true;hands.set(id,{x,y,t:now,r:settings.brush,distance:0,marks:[stroke]})}
function moveDrawing(id:number,x:number,y:number,now:number){const p=hands.get(id);if(!p)return;const dist=Math.hypot(x-p.x,y-p.y);if(dist<1)return;const speed=dist/Math.max(8,now-p.t),target=settings.brush*(.85+Math.min(2,speed*1.5)),r=p.r+(target-p.r)*.35;
 const stroke=mark(x,y,p.x,p.y,r,now);stroke.drawing=true;p.marks.push(stroke)
 p.distance+=dist;p.x=x;p.y=y;p.t=now;p.r=r
}
canvas.onpointerdown=e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);startDrawing(e.pointerId,e.clientX,e.clientY,performance.now())}
canvas.onpointermove=e=>moveDrawing(e.pointerId,e.clientX,e.clientY,performance.now())
function finishHand(id:number,now:number){const p=hands.get(id);if(!p)return
 // Hold the whole gesture after the finger lifts, including its earliest marks.
 for(const stroke of p.marks){stroke.born=now;stroke.drawing=false}
 // Water pushed ahead of the palm gathers at the end of the wipe and runs down.
 if(p.water!==undefined&&p.distance>40)for(let i=0;i<2;i++)spawnDrip(p.x+(Math.random()-.5)*p.r,p.y+p.r*.8)
 hands.delete(id)
}
function release(e:PointerEvent){finishHand(e.pointerId,performance.now())}
function finishHands(){for(const id of hands.keys())finishHand(id,performance.now())}
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=release
const camera=new FogCamera(document.getElementById('fog-camera') as HTMLButtonElement,
 (x,y,now)=>{const id=-100;if(!hands.has(id))startDrawing(id,x*w,y*h,now);else moveDrawing(id,x*w,y*h,now)},
 ()=>{finishHand(-100,performance.now());finishHand(-101,performance.now())},
 (x,y,r,now)=>{const id=-101,nx=x*w,ny=y*h;let p=hands.get(id)
  if(!p){
   // The palm landing on the glass leaves a soft print before it moves.
   const print=mark(nx,ny,nx,ny,r*.7,now);print.drawing=true
   hands.set(id,{x:nx,y:ny,t:now,r,distance:0,marks:[print],dx:0,dy:1,water:0});return
  }
  const d=Math.hypot(nx-p.x,ny-p.y);if(d<2)return
  // Smooth the travel direction so the hand-shaped stamp does not twitch with tracking noise.
  p.dx=p.dx!*.7+(nx-p.x)/d*.3;p.dy=p.dy!*.7+(ny-p.y)/d*.3;p.r+=(r-p.r)*.3
  const stroke=mark(nx,ny,p.x,p.y,p.r,now,settings.hold,settings.fade,Math.atan2(p.dy,p.dx));stroke.drawing=true;p.marks.push(stroke)
  p.water!+=d;if(p.water!>240){p.water=Math.random()*90;spawnDrip(nx+(Math.random()-.5)*p.r*1.2,ny+p.r*.8)}
  p.distance+=d;p.x=nx;p.y=ny;p.t=now})
const breath=new FogBreath(document.getElementById('fog-breath') as HTMLButtonElement,document.getElementById('fog-breath-status')!,
 (strength,now)=>{const r=Math.min(w,h)*(.07+.1*strength);mark(w*.5,h*.5,w*.5,h*.5,r,now)})
addEventListener('pagehide',()=>{camera.stop();breath.stop()})
const file=document.getElementById('fog-file') as HTMLInputElement
document.getElementById('fog-photo')!.onclick=()=>file.click()
file.onchange=async()=>{const selected=file.files?.[0];file.value='';if(!selected)return;const epoch=++sourceEpoch,url=URL.createObjectURL(selected);try{const image=new Image();image.src=url;await image.decode();if(epoch!==sourceEpoch)return;photo=image;reset();drawScene();status.textContent='New view ready.'}catch{status.textContent='Could not read this image. Try a JPEG or PNG.'}finally{URL.revokeObjectURL(url)}}
document.getElementById('fog-reset')!.onclick=()=>{reset();status.textContent='The window has fogged over again.'}
let hadReflection=false
function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now
 // Refresh live reflection, including the blurred view underneath condensation.
 const hasReflection=!!camera.reflection
 if(hasReflection||hadReflection)drawScene()
 hadReflection=hasReflection
 if(maskDirty||now-lastMask>=50){
 maskDirty=false;lastMask=now
 const m=mask.g;m.globalCompositeOperation='source-over';m.clearRect(0,0,w,h);m.lineCap='round';m.lineJoin='round'
 for(let i=marks.length-1;i>=0;i--){const s=marks[i],age=s.drawing?0:(now-s.born)/1000;if(age>s.hold+s.fade*1.03){marks.splice(i,1);continue}const steps=Math.max(1,Math.ceil(Math.hypot(s.x-s.px,s.y-s.py)/stepOf(s)))
  for(let j=0;j<steps;j++){
   const t=(j+.5)/steps,x=s.px+(s.x-s.px)*t,y=s.py+(s.y-s.py)*t
   const humidity=.8+.2*Math.sin(x*.037+y*.019)*Math.cos(y*.043)
   // Moisture returns unevenly, with the soft edges clouding first.
   const elapsed=Math.max(0,age-s.hold)
   // Smooth endpoints: no sudden final removal, and no minute-long exponential tail.
   const progress=Math.min(1,elapsed/(s.fade*(.78+humidity*.24)))
   const ambientClarity=1-progress*progress*(3-2*progress)
   stamp(m,s,x,y,ambientClarity)
  }}
 m.globalAlpha=1;m.globalCompositeOperation='source-over'
 }
 // Drips surge and stall as they run down, each clearing a thin trail through the fog.
 for(let i=drips.length-1;i>=0;i--){const d=drips[i];d.age+=dt
  if(d.age>d.life+.6||d.y>h+12){drips.splice(i,1);continue}
  if(d.age<d.life){d.y+=d.speed*(.35+.65*Math.max(0,Math.sin(d.age*2.4+d.phase)))*dt;d.x+=Math.sin(d.age*1.7+d.phase)*5*dt}
  if(Math.hypot(d.x-d.lx,d.y-d.ly)>=4){mark(d.x,d.y,d.lx,d.ly,d.r,now,settings.hold+6,settings.fade);d.lx=d.x;d.ly=d.y}
 }
 // Wet boundary follows the same mask as the clear stroke.
 ctx.drawImage(scene.c,0,0,w,h)
 const g=composite.g;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);g.drawImage(veil.c,0,0,w,h);g.drawImage(wet.c,0,0);g.globalCompositeOperation='destination-out';g.globalAlpha=.95;g.drawImage(mask.c,0,0);g.globalAlpha=1;ctx.globalAlpha=settings.dirty;ctx.drawImage(composite.c,0,0)
 for(const d of drips){ctx.globalAlpha=settings.dirty*Math.min(1,(d.life+.6-d.age)*1.6);ctx.drawImage(bead,d.x-d.r*1.7,d.y-d.r*1.7,d.r*3.4,d.r*3.4)}
 ctx.globalAlpha=1
 requestAnimationFrame(frame)
}
for(const key of ['dirty','temperature','brush'] as const){
 const input=document.getElementById('fog-'+key) as HTMLInputElement
 input.oninput=()=>{
  settings[key]=Number(input.value)/(key==='dirty'?100:1)
  document.getElementById('fog-'+key+'-value')!.textContent=input.value+(key==='brush'?'':'%')
  maskDirty=true;drawScene()
 }
}
document.getElementById('fog-panel-reset')!.onclick=()=>{reset();status.textContent='The window has fogged over again.'}
resize();addEventListener('resize',resize);addEventListener('blur',finishHands);document.addEventListener('visibilitychange',()=>{if(document.hidden)finishHands()});requestAnimationFrame(frame)

