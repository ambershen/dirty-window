/** Lightweight camera-motion estimate; no extra pose model or camera upload. */
export class BodyMotion {
  private canvas=document.createElement('canvas')
  private ctx:CanvasRenderingContext2D
  private previous:Float32Array|null=null
  private lastFrame=-1
  private lastTime=0
  readonly value={energy:0,x:.5}
  constructor(){this.canvas.width=64;this.canvas.height=48;this.ctx=this.canvas.getContext('2d',{willReadFrequently:true})!}
  reset(){this.previous=null;this.lastFrame=-1;this.value.energy=0;this.value.x=.5}
  sample(video:HTMLVideoElement,now:number) {
    if(video.readyState<2||now-this.lastTime<50||video.currentTime===this.lastFrame)return this.value
    this.lastTime=now;this.lastFrame=video.currentTime
    this.ctx.drawImage(video,0,0,64,48)
    const image=this.ctx.getImageData(0,0,64,48).data
    const current=new Float32Array(64*48)
    let delta=0
    for(let i=0;i<current.length;i++){current[i]=(image[i*4]*.2126+image[i*4+1]*.7152+image[i*4+2]*.0722)/255;delta+=current[i]-(this.previous?.[i]??current[i])}
    delta/=current.length
    let amount=0,position=0
    if(this.previous)for(let y=4;y<44;y++)for(let x=4;x<60;x++){
      const i=y*64+x
      // Remove global exposure changes and a small noise floor.
      const change=Math.min(.25,Math.max(0,Math.abs(current[i]-this.previous[i]-delta)-.025))
      amount+=change;position+=change*(1-x/63)
    }
    const target=Math.min(1,amount/(56*40)*18)
    this.value.energy+=(target-this.value.energy)*.3
    if(amount>.01)this.value.x+=(position/amount-this.value.x)*.25
    this.previous=current
    return this.value
  }
}
