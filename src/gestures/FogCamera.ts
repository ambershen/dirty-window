import { HandTracker } from './hand'

/** Thumb and index must meet at least this far from the palm centre (in palm lengths) to start writing. */
const PINCH_REACH=.65
/** Once writing, the stroke continues while the pinch stays above this. */
const PINCH_HOLD=.52
/** While writing, a wipe needs the thumb and index clearly apart. */
const PINCH_OPEN=.3
/** How long a stroke survives the tracker losing the hand (fast strokes blur). */
const DROPOUT_MS=320

/** `?debug` readout: camera frame rate, tracking rate, inference time and capture-to-sample delay. */
class CameraDebug {
 private el=document.createElement('pre')
 private frames:number[]=[]
 private samples:number[]=[]
 private inference=0
 private delay=0
 private pose=''
 private video:HTMLVideoElement|null=null
 constructor(){this.el.style.cssText='position:fixed;right:16px;top:16px;z-index:2000;margin:0;padding:10px 12px;border-radius:10px;background:#000a;color:#bfffd0;font:11px/1.6 ui-monospace,monospace;pointer-events:none';setInterval(()=>this.render(),500)}
 show(video:HTMLVideoElement){this.video=video;document.body.append(this.el)}
 frame(now:number){this.frames.push(now)}
 private endings:string[]=[]
 gesture(pinch:number,reach:number,fist:boolean,palm:boolean,action:string){this.pose=`pinch ${pinch.toFixed(2)} (start >0.72, hold >${PINCH_HOLD})  reach ${reach.toFixed(2)} (start >${PINCH_REACH})\nfist ${fist?'yes':'no'}  palm ${palm?'yes':'no'}  → ${action}`}
 /** Why recent strokes ended, newest first. */
 ended(reason:string){this.endings.unshift(reason);this.endings.length=Math.min(this.endings.length,4)}
 sample(at:number,capture:number,inference:number){this.samples.push(at);this.inference=this.inference*.8+inference*.2;if(capture)this.delay=this.delay*.8+(at-capture)*.2}
 private render(){
  if(!this.video)return
  const rate=(list:number[])=>{const now=performance.now();while(list.length&&now-list[0]>1000)list.shift();return list.length}
  const settings=(this.video.srcObject as MediaStream|null)?.getVideoTracks()[0]?.getSettings()
  const max=(this.video.srcObject as MediaStream|null)?.getVideoTracks()[0]?.getCapabilities?.().frameRate?.max
  this.el.textContent=`camera  ${settings?.width??'?'}×${settings?.height??'?'} @ ${Math.round(settings?.frameRate??0)} fps (max ${max?Math.round(max):'?'})
frames  ${rate(this.frames)} /s
tracked ${rate(this.samples)} /s
infer   ${this.inference.toFixed(1)} ms
capture→tracked ${this.delay?this.delay.toFixed(0)+' ms':'n/a (browser gives no capture time)'}
${this.pose}
stroke ended: ${this.endings.join(' · ')||'—'}`
 }
}

/** Pinch to write; spread all five fingers to wipe; release to pause. */
export class FogCamera {
 get reflection(){return this.video.readyState>=2&&this.video.srcObject?this.video:null}
 private tracker:HandTracker|null=null
 private video=document.createElement('video')
 private cursor=document.createElement('span')
 private message=document.createElement('p')
 private epoch=0
 private raf=0
 private pinched=false
 private action:'idle'|'write'|'wipe'='idle'
 private candidate:'idle'|'write'|'wipe'='idle'
 private pending=0
 private lastSeen=0
 private radius=0
 private running=false
 private videoCallback=0
 private inferTimer:ReturnType<typeof setTimeout>|undefined
 private lastResult=0
 private lastFrame=0
 private position:{x:number;y:number}|null=null
 private target={x:0,y:0}
 private velocity={x:0,y:0}
 private frameCapture=0
 private armedAt=0
 private sampleCapture=0
 private debug=new URLSearchParams(location.search).has('debug')?new CameraDebug():null
 /** The open palm's 21 landmarks in screen space (0..1) while it rests on or wipes the glass. */
 palm:{x:number;y:number}[]|null=null
 /** Which gesture this window answers to: an open palm pressing and wiping, or a pinch writing. */
 effect:'palm'|'write'='palm'
 /** Writing only: the pen is lifted, so the hand can move without leaving a line. */
 penUp=false
 /** Lift or lower the pen. Lifting ends the stroke at once, so the next word starts fresh. */
 togglePen(){this.penUp=!this.penUp;if(this.penUp&&this.action==='write'){this.release();this.action='idle';this.candidate='idle';this.pending=0;this.pinched=false;this.position=null;this.velocity={x:0,y:0}}return this.penUp}
 setEffect(effect:'palm'|'write'){this.effect=effect;this.penUp=false;if(this.action!=='idle'){this.release();this.action='idle';this.candidate='idle';this.pending=0;this.pinched=false;this.position=null;this.palm=null}}
 private points:{x:number;y:number}[]=[]
 private stillSince=0
 private printed=false
 constructor(private button:HTMLButtonElement,private draw:(x:number,y:number,now:number)=>void,private release:()=>void,private wipe:(x:number,y:number,radius:number,now:number)=>void,private print:(points:{x:number;y:number}[],now:number)=>void){
  this.video.muted=true;this.video.playsInline=true;this.video.className='fog-camera-video';document.body.append(this.video)
  this.cursor.className='fog-hand-cursor';this.cursor.hidden=true;document.body.append(this.cursor)
  this.message.className='fog-camera-message';this.message.setAttribute('role','status');this.message.hidden=true;document.body.append(this.message)
  button.onclick=()=>{if(this.tracker)this.stop();else void this.start()}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()})
  addEventListener('blur',()=>{this.pinched=false;this.release()})
 }
 stop(){this.epoch++;this.running=false;this.palm=null;cancelAnimationFrame(this.raf);clearTimeout(this.inferTimer);if(this.videoCallback)this.video.cancelVideoFrameCallback?.(this.videoCallback);this.position=null;this.lastResult=0;this.velocity={x:0,y:0};this.pinched=false;this.action='idle';this.candidate='idle';this.pending=0;this.radius=0;this.release();this.tracker?.dispose();this.tracker=null;this.cursor.hidden=true;this.message.hidden=true;this.button.setAttribute('aria-pressed','false');this.button.setAttribute('aria-label','Enable finger drawing camera')}
 private async start(){
  const epoch=++this.epoch
  // One hand: with numHands 2, MediaPipe reruns the slow palm detector on every frame while
  // only one hand is visible. 60 Hz halves the frame interval on cameras that support it, and a
  // lower tracking threshold keeps hold of a motion-blurred hand instead of re-detecting it.
  const tracker=new HandTracker(this.video,{maxHz:60,numHands:1,minCutoff:18,beta:8,trackingConfidence:.3,inferenceWidth:640,wasmPath:'/vision',modelUrl:'/hand_landmarker.task'})
  this.tracker=tracker;this.message.textContent='Starting camera…';this.message.hidden=false;this.button.setAttribute('aria-label','Cancel camera')
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera needs HTTPS and a browser with camera access.')
   const ready=await tracker.initCamera();if(epoch!==this.epoch){tracker.dispose();return}
   if(!ready)throw Error(tracker.cameraError||'Camera unavailable. Allow camera access and try again.')
   await tracker.initLandmarker();if(epoch!==this.epoch){tracker.dispose();return}
   this.running=true;this.armedAt=performance.now()+800;this.message.hidden=true;this.debug?.show(this.video);this.button.setAttribute('aria-pressed','true');this.button.setAttribute('aria-label','Turn off finger drawing camera');this.scheduleInference();this.raf=requestAnimationFrame(this.frame)
  }catch(error){tracker.dispose();if(epoch!==this.epoch)return;this.stop();this.message.textContent=error instanceof Error?error.message:'Camera unavailable';this.message.hidden=false}
 }
 private scheduleInference(){
  if(!this.running)return
  const infer=()=>{if(!this.running)return;try{const before=this.tracker?.resultTime;this.tracker?.update(performance.now());if(this.tracker&&this.tracker.resultTime!==before){this.sampleCapture=this.frameCapture;this.debug?.sample(this.tracker.resultTime,this.frameCapture,this.tracker.inferenceMs)}}catch{this.stop();this.message.textContent='Tracking interrupted. Tap the camera button to retry.';this.message.hidden=false;return}this.scheduleInference()}
  if(this.video.requestVideoFrameCallback)this.videoCallback=this.video.requestVideoFrameCallback((now,frame)=>{this.frameCapture=frame.captureTime??0;this.debug?.frame(now);this.inferTimer=setTimeout(infer,0)})
  else this.inferTimer=setTimeout(infer,33)
 }
 private frame=(now:number)=>{
  if(!this.running||!this.tracker)return
  try{
   const tracked=this.tracker.hands
   const hand=this.position?tracked.reduce((best,h)=>!best||Math.hypot(h.indexTipX-this.target.x,h.indexTipY-this.target.y)<Math.hypot(best.indexTipX-this.target.x,best.indexTipY-this.target.y)?h:best,tracked[0]):tracked[0]
   const sampleTime=this.tracker.resultTime
   if(hand&&now-sampleTime<150){
    const gap=now-this.lastSeen;this.lastSeen=now;this.cursor.hidden=false
    if(sampleTime!==this.lastResult){
     // Classify once per camera sample. Moving hands blur, so a few unclear samples must
     // not end a wipe or a written stroke; entering a wipe also needs two agreeing samples.
     // A writing pinch curls the other fingers, which can read as a fist, so the fist
     // check only guards the start of a stroke.
     const writing=this.action==='write'
     // Ignore gestures just after the camera starts, and hands filling much of the frame:
     // both are usually a hand reaching for the keyboard or trackpad, not one at the glass.
     const settling=now<this.armedAt||hand.width>.5||hand.height>.6
     const pinchStart=hand.pinch>.72&&!hand.isFist&&hand.pinchReach>PINCH_REACH
     // While writing, a loosening pinch with the other fingers relaxed (an OK sign) also
     // passes the open-palm test; the pen keeps priority until the thumb clearly leaves.
     // Each effect listens for one gesture: the palm effect never writes, the writing effect never wipes.
     const palm=this.effect==='palm'&&hand.isOpenPalm&&!hand.isFist&&(!writing||hand.pinch<PINCH_OPEN)
     const pen=this.effect==='write'&&!this.penUp
     const raw=settling&&!writing?'idle':palm?'wipe':!pen?'idle':writing?hand.pinch>PINCH_HOLD?'write':'idle':pinchStart?'write':'idle'
     this.debug?.gesture(hand.pinch,hand.pinchReach,hand.isFist,!!hand.isOpenPalm,this.action)
     if(raw===this.action)this.pending=0
     else{
      if(raw!==this.candidate){this.candidate=raw;this.pending=0}
      const needed=this.action==='wipe'?3:this.action==='write'?4:raw==='idle'?1:2
      if(++this.pending>=needed){if(this.action==='write')this.debug?.ended(raw==='wipe'?'became wipe':`pinch opened (${hand.pinch.toFixed(2)})`);this.release();this.position=null;this.velocity={x:0,y:0};this.action=raw;this.pending=0;this.stillSince=0;this.printed=false}
     }
     this.pinched=this.action==='write'
     const dt=Math.max(.008,(sampleTime-this.lastResult)/1000),wiping=this.action==='wipe'
     // Match the mirrored, aspect-preserving cover crop used by the fog canvas.
     const scale=Math.max(innerWidth/this.video.videoWidth,innerHeight/this.video.videoHeight)
     const x=((wiping?hand.x:hand.pinchX)*this.video.videoWidth*scale-(this.video.videoWidth*scale-innerWidth)/2)/innerWidth
     const y=((wiping?hand.y:hand.pinchY)*this.video.videoHeight*scale-(this.video.videoHeight*scale-innerHeight)/2)/innerHeight
     // A hand found again far from where it was lost is a new stroke, not a straight line across.
     if(gap>100&&this.action==='write'&&Math.hypot(x-this.target.x,y-this.target.y)>.1){this.release();this.position=null;this.debug?.ended('lost hand, found elsewhere')}
     // Smoothed velocity: raw differences between 60 Hz samples are noisy.
     const vx=(x-this.target.x)/dt,vy=(y-this.target.y)/dt
     this.velocity=this.position?{x:this.velocity.x*.5+vx*.5,y:this.velocity.y*.5+vy*.5}:{x:0,y:0}
     this.target={x,y};this.lastResult=sampleTime
     const toScreen=(p:{x:number;y:number})=>({x:(p.x*this.video.videoWidth*scale-(this.video.videoWidth*scale-innerWidth)/2)/innerWidth,y:(p.y*this.video.videoHeight*scale-(this.video.videoHeight*scale-innerHeight)/2)/innerHeight})
     this.points=hand.points.map(toScreen)
     // A palm held still on the glass leaves a print of the whole hand; moving it again re-arms the print.
     if(wiping){
      const speed=Math.hypot(this.velocity.x,this.velocity.y)
      if(speed<.12){if(!this.stillSince)this.stillSince=sampleTime;else if(!this.printed&&sampleTime-this.stillSince>350&&this.points.length===21){this.printed=true;this.print(this.points,now)}}
      else if(speed>.3){this.stillSince=0;this.printed=false}
     }
     const radius=Math.max(55,Math.min(160,hand.width*this.video.videoWidth*scale*.6))
     this.radius=this.radius?this.radius+(radius-this.radius)*.3:radius
    }
    // Bridge camera samples at display cadence. Prediction is limited to 12 ms
    // and four screen pixels, and never extends a released or missing contact.
    // A wipe projects forward over part of the camera's capture-to-screen delay, so the
    // clearing keeps up with the palm; a broad wipe hides small overshoot. Writing stays
    // conservative so letters do not overshoot.
    // Without a capture timestamp (common on macOS), assume a typical ~60 ms webcam pipeline.
    const age=this.sampleCapture?(now-this.sampleCapture)/1000:(now-sampleTime)/1000+.06,wiping=this.action==='wipe'
    const lead=wiping?Math.min(.045,Math.max(0,age*.6)):Math.min(.012,Math.max(0,(now-sampleTime)/1000))
    const reach=wiping?Math.min(innerWidth,innerHeight)*.035:4
    const tx=this.target.x+Math.max(-reach/innerWidth,Math.min(reach/innerWidth,this.velocity.x*lead))
    const ty=this.target.y+Math.max(-reach/innerHeight,Math.min(reach/innerHeight,this.velocity.y*lead))
    const blend=1-Math.exp(-Math.min(.05,(now-this.lastFrame)/1000)*65)
    if(!this.position)this.position={x:tx,y:ty}
    else{this.position.x+=(tx-this.position.x)*blend;this.position.y+=(ty-this.position.y)*blend}
    const x=Math.max(0,Math.min(1,this.position.x)),y=Math.max(0,Math.min(1,this.position.y))
    this.cursor.style.left=`${x*100}%`;this.cursor.style.top=`${y*100}%`;this.cursor.classList.toggle('drawing',this.pinched);this.cursor.classList.toggle('pen-up',this.effect==='write'&&this.penUp)
    this.cursor.classList.toggle('wiping',this.action==='wipe')
    // The silhouette follows the same short prediction as the wipe, so it sits on the clearing.
    const ox=this.position.x-this.target.x,oy=this.position.y-this.target.y
    this.palm=this.action==='wipe'&&this.points.length===21?this.points.map(p=>({x:p.x+ox,y:p.y+oy})):null
    if(this.action==='wipe')this.wipe(x,y,this.radius,now)
    else if(this.action==='write'){
     // The pen may be lifting: pause without ending the stroke. If the pinch returns,
     // drawing resumes and the stroke bridges the gap instead of starting a new fragment.
     if(!(this.pending&&this.candidate!=='write'))this.draw(x,y,now)
    }else this.release()
   }else if(this.action!=='idle'&&now-this.lastSeen<DROPOUT_MS){
    // Brief detection dropout mid-stroke: hold the stroke open without drawing.
   }else{if(this.action==='write')this.debug?.ended('lost hand');this.cursor.hidden=true;this.palm=null;this.pinched=false;this.action='idle';this.candidate='idle';this.pending=0;this.position=null;this.radius=0;this.velocity={x:0,y:0};this.release()}
   this.lastFrame=now;this.raf=requestAnimationFrame(this.frame)
  }catch{this.stop();this.message.textContent='Hand tracking stopped. Tap the camera button to retry.';this.message.hidden=false}
 }
}
