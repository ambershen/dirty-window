import { HandTracker } from './hand'

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
 private action='idle'
 private running=false
 private videoCallback=0
 private inferTimer:ReturnType<typeof setTimeout>|undefined
 private lastResult=0
 private lastFrame=0
 private position:{x:number;y:number}|null=null
 private target={x:0,y:0}
 private velocity={x:0,y:0}
 constructor(private button:HTMLButtonElement,private draw:(x:number,y:number,now:number)=>void,private release:()=>void,private wipe:(x:number,y:number,radius:number,now:number)=>void){
  this.video.muted=true;this.video.playsInline=true;this.video.className='fog-camera-video';document.body.append(this.video)
  this.cursor.className='fog-hand-cursor';this.cursor.hidden=true;document.body.append(this.cursor)
  this.message.className='fog-camera-message';this.message.setAttribute('role','status');this.message.hidden=true;document.body.append(this.message)
  button.onclick=()=>{if(this.tracker)this.stop();else void this.start()}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()})
  addEventListener('blur',()=>{this.pinched=false;this.release()})
 }
 stop(){this.epoch++;this.running=false;cancelAnimationFrame(this.raf);clearTimeout(this.inferTimer);if(this.videoCallback)this.video.cancelVideoFrameCallback?.(this.videoCallback);this.position=null;this.lastResult=0;this.velocity={x:0,y:0};this.pinched=false;this.release();this.tracker?.dispose();this.tracker=null;this.cursor.hidden=true;this.message.hidden=true;this.button.setAttribute('aria-pressed','false');this.button.setAttribute('aria-label','Enable finger drawing camera')}
 private async start(){
  const epoch=++this.epoch
  const tracker=new HandTracker(this.video,{maxHz:30,numHands:2,minCutoff:18,beta:8,wasmPath:'/vision',modelUrl:'/hand_landmarker.task'})
  this.tracker=tracker;this.message.textContent='Starting camera…';this.message.hidden=false;this.button.setAttribute('aria-label','Cancel camera')
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera needs HTTPS and a browser with camera access.')
   const ready=await tracker.initCamera();if(epoch!==this.epoch){tracker.dispose();return}
   if(!ready)throw Error(tracker.cameraError||'Camera unavailable. Allow camera access and try again.')
   await tracker.initLandmarker();if(epoch!==this.epoch){tracker.dispose();return}
   this.running=true;this.message.hidden=true;this.button.setAttribute('aria-pressed','true');this.button.setAttribute('aria-label','Turn off finger drawing camera');this.scheduleInference();this.raf=requestAnimationFrame(this.frame)
  }catch(error){tracker.dispose();if(epoch!==this.epoch)return;this.stop();this.message.textContent=error instanceof Error?error.message:'Camera unavailable';this.message.hidden=false}
 }
 private scheduleInference(){
  if(!this.running)return
  const infer=()=>{if(!this.running)return;try{this.tracker?.update(performance.now())}catch{this.stop();this.message.textContent='Tracking interrupted. Tap the camera button to retry.';this.message.hidden=false;return}this.scheduleInference()}
  if(this.video.requestVideoFrameCallback)this.videoCallback=this.video.requestVideoFrameCallback(()=>{this.inferTimer=setTimeout(infer,0)})
  else this.inferTimer=setTimeout(infer,33)
 }
 private frame=(now:number)=>{
  if(!this.running||!this.tracker)return
  try{
   const tracked=this.tracker.hands
   const hand=this.position?tracked.reduce((best,h)=>!best||Math.hypot(h.indexTipX-this.target.x,h.indexTipY-this.target.y)<Math.hypot(best.indexTipX-this.target.x,best.indexTipY-this.target.y)?h:best,tracked[0]):tracked[0]
   const sampleTime=this.tracker.resultTime
   const visible=!!hand&&now-sampleTime<150&&document.hasFocus()
   this.cursor.hidden=!visible
   if(visible){
    const wiping=!!hand.isOpenPalm
    const nextPinched=!hand.isFist&&!wiping&&hand.pinch>(this.pinched?.58:.72)
    const action=wiping?'wipe':nextPinched?'write':'idle'
    if(action!==this.action){this.release();this.position=null;this.velocity={x:0,y:0};this.lastResult=0;this.action=action}
    this.pinched=nextPinched
    if(sampleTime!==this.lastResult){
     const dt=Math.max(.008,(sampleTime-this.lastResult)/1000)
     // Match the mirrored, aspect-preserving cover crop used by the fog canvas.
     const scale=Math.max(innerWidth/this.video.videoWidth,innerHeight/this.video.videoHeight)
     const x=((wiping?hand.x:hand.indexTipX)*this.video.videoWidth*scale-(this.video.videoWidth*scale-innerWidth)/2)/innerWidth
     const y=((wiping?hand.y:hand.indexTipY)*this.video.videoHeight*scale-(this.video.videoHeight*scale-innerHeight)/2)/innerHeight
     this.velocity=this.position?{x:(x-this.target.x)/dt,y:(y-this.target.y)/dt}:{x:0,y:0}
     this.target={x,y};this.lastResult=sampleTime
    }
    // Bridge camera samples at display cadence. Prediction is limited to 12 ms
    // and four screen pixels, and never extends a released or missing contact.
    const lead=Math.min(.012,Math.max(0,(now-sampleTime)/1000))
    const tx=this.target.x+Math.max(-4/innerWidth,Math.min(4/innerWidth,this.velocity.x*lead))
    const ty=this.target.y+Math.max(-4/innerHeight,Math.min(4/innerHeight,this.velocity.y*lead))
    const blend=1-Math.exp(-Math.min(.05,(now-this.lastFrame)/1000)*65)
    if(!this.position)this.position={x:tx,y:ty}
    else{this.position.x+=(tx-this.position.x)*blend;this.position.y+=(ty-this.position.y)*blend}
    const x=Math.max(0,Math.min(1,this.position.x)),y=Math.max(0,Math.min(1,this.position.y))
    this.cursor.style.left=`${x*100}%`;this.cursor.style.top=`${y*100}%`;this.cursor.classList.toggle('drawing',this.pinched)
    this.cursor.classList.toggle('wiping',wiping)
    if(wiping){const scale=Math.max(innerWidth/this.video.videoWidth,innerHeight/this.video.videoHeight);this.wipe(x,y,Math.max(55,Math.min(160,hand.width*this.video.videoWidth*scale*.6)),now)}
    else if(this.pinched)this.draw(x,y,now);else this.release()
   }else{this.pinched=false;this.action='idle';this.position=null;this.velocity={x:0,y:0};this.release()}
   this.lastFrame=now;this.raf=requestAnimationFrame(this.frame)
  }catch{this.stop();this.message.textContent='Hand tracking stopped. Tap the camera button to retry.';this.message.hidden=false}
 }
}
