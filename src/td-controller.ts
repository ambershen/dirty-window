import { HandTracker } from './gestures/hand'
const app=document.getElementById('app')!
app.innerHTML=`<style>html,body{margin:0;background:#071d24;color:#d3e7e8;font:16px system-ui}main{max-width:460px;margin:12vh auto;padding:32px}h1{font-weight:400}button{background:#acdfe1;color:#12313a;border:0;border-radius:30px;padding:14px 24px;font:inherit;cursor:pointer}p{line-height:1.6;opacity:.8}video{display:none}</style><main><h1>Pond · Hand control</h1><p>食指轻拨 · 张开手掌推水 · 握拳停止</p><button type="button">开启摄像头</button><p role="status">手势只控制 TouchDesigner，影像留在本机。</p><video muted playsinline></video></main>`
const button=app.querySelector('button')!,status=app.querySelector('[role=status]')!,video=app.querySelector('video')!
const tracker=new HandTracker(video,{maxHz:30,numHands:1,minCutoff:5,beta:3,wasmPath:'/vision',modelUrl:'/hand_landmarker.task'})
let active=false,starting=false,busy=false,lastSend=0,loaded=false,epoch=0
const ownership=new BroadcastChannel('pond-hand-controller')
ownership.onmessage=()=>{if(active||starting){stop();status.textContent='另一个控制页已接管摄像头。'}}
function send(gesture:string,x=.5,y=.5){
 if(busy)return
 busy=true
 void fetch('/gesture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gesture,x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}),signal:AbortSignal.timeout(700)})
 .then(r=>{if(!r.ok)throw new Error('Bridge unavailable')})
 .catch(()=>{status.textContent='本地桥接未连接；水面将自动停止接收手势。'})
 .finally(()=>{busy=false})
}
function stop(){
 active=false;epoch++
 ;(video.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());video.srcObject=null
 button.textContent='开启摄像头';status.textContent='摄像头已关闭。'
 // TD also rejects stale packets after 250 ms, even if this last request is interrupted.
 if(!busy)send('none')
}
button.onclick=async()=>{
 if(active){stop();return}if(starting)return
 ownership.postMessage('takeover');starting=true;button.disabled=true;const id=++epoch
 try{
  status.textContent='正在启动摄像头…'
  if(!await tracker.initCamera(undefined,'user'))throw new Error(tracker.cameraError)
  if(!loaded){status.textContent='正在载入手势模型…';await tracker.initLandmarker();loaded=true}
  if(id!==epoch){stop();return}
  active=true;button.textContent='关闭摄像头';status.textContent='已连接。伸出食指或张开手掌，在镜头前缓慢移动。'
 }catch(e){stop();status.textContent=e instanceof Error?e.message:String(e)}
 finally{starting=false;button.disabled=false}
}
function frame(now:number){
 if(active){
  try{
   tracker.update(now)
   if(now-lastSend>=33){
    const h=tracker.hands[0]
    const gesture=!h?'none':h.isFist?'fist':h.isPointing?'point':h.openness>.55?'palm':'none'
    const x=h?(gesture==='point'?h.indexTipX:h.x):.5,y=h?(gesture==='point'?h.indexTipY:h.y):.5
    send(gesture,x,1-y);lastSend=now
    status.textContent=!h?'未检测到手。请把手掌放到镜头内。':gesture==='fist'?'握拳 · 暂停推水':gesture==='point'?'食指 · 正在拨水':gesture==='palm'?'手掌 · 正在推水':'检测到手 · 请伸出食指或张开手掌'
   }
  }catch(e){stop();status.textContent='识别暂停，请重新开启摄像头。'}
 }
 setTimeout(()=>frame(performance.now()),33)
}
requestAnimationFrame(frame)
window.addEventListener('pagehide',stop)
export {}
