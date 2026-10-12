/** Experimental local-only breath noise detection; no recording or upload. */
export class FogBreath {
 private stream:MediaStream|null=null
 private context:AudioContext|null=null
 private raf=0
 private epoch=0
 private pending=false
 private devices=document.createElement('select')
 private meter=document.createElement('meter')
 private sensitivity=document.createElement('input')
 constructor(private button:HTMLButtonElement,private status:HTMLElement,private clear:(strength:number,now:number)=>void){
  const micLabel=document.createElement('label');micLabel.textContent='Microphone';this.devices.setAttribute('aria-label','Breath microphone');micLabel.append(this.devices);button.before(micLabel)
  this.devices.add(new Option('System default',''))
  this.devices.onchange=()=>{if(this.stream){this.stop();void this.start()}}
  const sensitivityLabel=document.createElement('label');sensitivityLabel.textContent='Breath sensitivity';this.sensitivity.type='range';this.sensitivity.min='1';this.sensitivity.max='100';this.sensitivity.value='80';this.sensitivity.setAttribute('aria-label','Breath sensitivity');sensitivityLabel.append(this.sensitivity);button.before(sensitivityLabel)
  this.meter.min=0;this.meter.max=1;this.meter.value=0;this.meter.setAttribute('aria-label','Microphone input level');button.after(this.meter)
  button.onclick=()=>{if(this.pending||this.stream)this.stop();else void this.start()}
  addEventListener('pagehide',()=>this.stop())
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()})
 }
 stop(){this.epoch++;this.pending=false;cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;void this.context?.close();this.context=null;this.button.setAttribute('aria-pressed','false');this.button.textContent='Enable breath · experimental';this.status.textContent='';this.meter.value=0}
 private async start(){
  const epoch=++this.epoch;this.pending=true;this.button.textContent='Cancel microphone';this.status.textContent='Allow microphone access to try breath clearing.'
  try{
   const context=new AudioContext();this.context=context;await context.resume()
   if(epoch!==this.epoch)return
   const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:this.devices.value?{exact:this.devices.value}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false})
   if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return}
   this.stream=stream;this.pending=false
   const selected=stream.getAudioTracks()[0]?.getSettings().deviceId
   const devices=await navigator.mediaDevices.enumerateDevices()
   if(epoch!==this.epoch)return
   this.devices.replaceChildren(new Option('System default',''))
   for(const device of devices.filter(d=>d.kind==='audioinput'))this.devices.add(new Option(device.label||'Microphone',device.deviceId))
   if(selected)this.devices.value=selected
   const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.35
   context.createMediaStreamSource(stream).connect(analyser)
   const bins=new Float32Array(analyser.frequencyBinCount),wave=new Float32Array(analyser.fftSize)
   let start=performance.now(),last=start,noise=.0002,duration=0,lastClear=0
   this.button.setAttribute('aria-pressed','true');this.button.textContent='Disable breath'
   const frame=(now:number)=>{
    if(epoch!==this.epoch)return
    analyser.getFloatTimeDomainData(wave);analyser.getFloatFrequencyData(bins)
    const rms=Math.sqrt(wave.reduce((n,v)=>n+v*v,0)/wave.length)
    this.meter.value=Math.min(1,rms*35)
    const hz=context.sampleRate/analyser.fftSize
    let energy=0,peak=0
    for(let i=Math.ceil(300/hz);i<Math.min(bins.length,Math.floor(7000/hz));i++){
     const power=Math.max(1e-12,10**(bins[i]/10));energy+=power;peak=Math.max(peak,power)
    }
    const dt=Math.min(.1,(now-last)/1000);last=now
    if(now-start<1200){noise+=(rms-noise)*.1;this.status.textContent='Stay quiet for a moment…'}
    else{
     const sensitivity=Number(this.sensitivity.value)/100
     const threshold=Math.max(.0006+(1-sensitivity)*.008,noise*(1.3+(1-sensitivity)*2))
     // Breath can be low-frequency wind noise, especially on close microphones.
     // Reject strongly tonal input without requiring a high-frequency hiss.
     const candidate=rms>threshold&&peak/(energy+1e-12)<.65
     this.meter.title=`Input: ${rms.toFixed(4)} · threshold: ${threshold.toFixed(4)}`
     duration=candidate?duration+dt:Math.max(0,duration-dt*3)
     if(rms<threshold*.7)noise+=(rms-noise)*.002
     if(duration>.1){if(now-lastClear>80){this.clear(Math.min(1,(rms-threshold)/Math.max(.003,threshold*4)+.25),now);lastClear=now}this.status.textContent='Breath-like sound · clearing the centre'}
     else this.status.textContent=rms<.0001?'No microphone signal · try another input above':'Microphone active · breathe toward the selected microphone'
    }
    this.raf=requestAnimationFrame(frame)
   }
   this.raf=requestAnimationFrame(frame)
  }catch(error){if(epoch!==this.epoch)return;this.stop();this.status.textContent=error instanceof Error?error.message:'Microphone unavailable.'}
 }
}
