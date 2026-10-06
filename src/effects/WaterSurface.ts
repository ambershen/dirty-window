export type WaterAudio = { level: number; bass: number; treble: number }

const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D camera;
uniform float time;
uniform float aspect;
uniform vec3 audio;
uniform vec4 touches[8];
uniform vec4 currents[8];
uniform vec4 vortex;
uniform vec4 squeeze;
uniform vec2 squeezeAxis;
uniform float vortexPhase;
uniform float cameraMix;
float heightAt(vec2 p) {
  float h = sin(p.y*54.0 + sin(p.x*7.0+time*.35)*2.0 - time*1.4)*.35;
  h += sin(p.y*103.0 + p.x*9.0 + time*1.8)*.13;
  h += sin(p.y*23.0 - p.x*4.0 - time*.8)*(.22+audio.y*.8);
  h += sin(p.y*178.0+p.x*15.0-time*3.0)*(.025+audio.z*.17);
  h*=mix(.32,1.0,cameraMix);
  for(int i=0;i<8;i++) {
    float age=time-touches[i].z;
    vec2 d=(p-touches[i].xy)*vec2(aspect,1.0);
    float r=length(d);
    float envelope=exp(-pow((r-age*.24)*16.0,2.0))*exp(-age*.9);
    h += sin(r*85.0-age*20.0)*envelope*touches[i].w;
  }
  for(int i=0;i<8;i++) {
    vec2 d=(p-currents[i].xy)*vec2(aspect,1.0);
    vec2 velocity=currents[i].zw*vec2(aspect,1.0);
    float speed=length(velocity);
    vec2 direction=velocity/(speed+.001);
    float along=dot(d,direction);
    float across=dot(d,vec2(-direction.y,direction.x));
    float width=.014+min(speed,1.5)*.022;
    float lengthScale=.045+min(speed,1.5)*.14;
    float wake=exp(-pow(across/width,2.0)-pow((along+lengthScale*.45)/lengthScale,2.0));
    h+=sin(across*105.0+abs(along)*42.0)*wake*min(speed,1.5)*.65;
  }
  vec2 v=(p-vortex.xy)*vec2(aspect,1.0);
  float radius=length(v);
  h+=sin(radius*65.0-atan(v.y+.00001,v.x+.00001)*3.0-vortexPhase)*exp(-radius*radius/max(.015,vortex.w*vortex.w))*abs(vortex.z)*.4;
  vec2 q=(p-squeeze.xy)*vec2(aspect,1.0);
  float along=dot(q,squeezeAxis);
  float across=dot(q,vec2(-squeezeAxis.y,squeezeAxis.x));
  float reach=max(.035,squeeze.w);
  float r2=along*along/(reach*reach)+across*across/(reach*reach*.3);
  // A central mound with an equal-area trough; the water is displaced, not zoomed.
  h+=squeeze.z*(1.0-r2)*exp(-r2)*2.0;
  return h;
}
void main() {
  vec2 p=uv;
  float e=.002;
  float h=heightAt(p);
  vec2 slope=vec2(heightAt(p+vec2(e,0.0))-h,heightAt(p+vec2(0.0,e))-h)/e;
  float strength=.00016+audio.x*.00042;
  vec2 shift=slope*vec2(.8,1.0)*strength;
  // Horizontal undulations break the reflection into water-like ribbons.
  shift.x+=sin(p.y*70.0+time*1.2+sin(p.y*11.0-time))*(.0015+audio.y*.007);
  vec2 sampleUV=clamp(p+shift,vec2(.002),vec2(.998));
  vec3 color=texture2D(camera,sampleUV).rgb;
  vec3 normal=normalize(vec3(-slope*.018,1.0));
  float light=max(0.0,dot(normal,normalize(vec3(-.4,.6,1.0))));
  float reflection=pow(max(0.0,dot(reflect(-normalize(vec3(-.4,.6,1.0)),normal),vec3(0.,0.,1.))),35.0);
  vec2 bed=p+shift*4.0;
  float caustic=pow(max(0.0,sin(bed.x*31.0+sin(bed.y*18.0+time*.23))*sin(bed.y*29.0+sin(bed.x*22.0-time*.18))),5.0);
  vec3 pond=mix(vec3(.018,.09,.105),vec3(.065,.27,.255),light);
  pond+=vec3(.15,.32,.25)*caustic*.3+vec3(.55,.72,.65)*reflection*.3;
  pond+=h*vec3(.018,.035,.03);
  color=mix(pond,color,cameraMix);
  float glint=pow(max(0.0,sin(p.y*54.0+sin(p.x*7.0+time*.35)*2.0-time*1.4)),18.0);
  color*=vec3(.88,.96,1.01);
  color+=vec3(.65,.84,.90)*glint*(.018+audio.z*.07);
  color+=vec3(.006,.014,.018);
  gl_FragColor=vec4(color,1.0);
}`

/** GPU camera refraction. The surface, not a separate chart, visualizes audio. */
export class WaterSurface {
  readonly canvas = document.createElement('canvas')
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private texture: WebGLTexture
  private locations: Record<string, WebGLUniformLocation | null> = {}
  private touches = new Float32Array(32)
  private nextTouch = 0
  private lastTouch = -Infinity
  private currents = new Float32Array(32)
  private vortex = new Float32Array([.5,.5,0,.15])
  private contactSlots = new Map<number,number>()
  private squeeze = new Float32Array([.5,.5,0,.15])
  private squeezeVelocity = 0
  private squeezeAxis = new Float32Array([1,0])
  private vortexPhase = 0
  private rippleTimes = new Map<number,number>()
  private nextCurrent = 0
  private previousFrame = 0

  constructor() {
    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('Water mode needs WebGL support.')
    this.gl=gl
    const compile=(kind:number,source:string)=>{
      const shader=gl.createShader(kind)!
      gl.shaderSource(shader,source);gl.compileShader(shader)
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Water shader failed.')
      return shader
    }
    const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){ uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }')
    const pixel=compile(gl.FRAGMENT_SHADER,fragment)
    this.program=gl.createProgram()!;gl.attachShader(this.program,vertex);gl.attachShader(this.program,pixel);gl.linkProgram(this.program)
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program)||'Water shader link failed.')
    gl.deleteShader(vertex);gl.deleteShader(pixel);gl.useProgram(this.program)
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW)
    const position=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0)
    this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true)
    for(const name of ['camera','time','aspect','audio','touches[0]','currents[0]','vortex','squeeze','squeezeAxis','vortexPhase','cameraMix'])this.locations[name]=gl.getUniformLocation(this.program,name)
    this.reset()
  }
  resize(width:number,height:number) {
    // Cap shader resolution independently of the camera/drawing canvas.
    const scale=Math.min(1,1100/Math.max(width,height))
    this.canvas.width=Math.round(width*scale);this.canvas.height=Math.round(height*scale)
  }
  reset(){this.vortexPhase=0;this.rippleTimes.clear();this.squeeze[2]=0;this.squeezeVelocity=0;this.currents.fill(0);this.vortex[2]=0;this.contactSlots.clear();this.lastTouch=-Infinity;this.touches.fill(0);for(let i=0;i<8;i++)this.touches[i*4+2]=-10000}
  touch(x:number,y:number,now:number,strength=.65,id=-1) {
    const last=id===-1?this.lastTouch:(this.rippleTimes.get(id)??-Infinity)
    if(now-last<90)return
    if(id===-1)this.lastTouch=now;else this.rippleTimes.set(id,now)
    this.touches.set([x,1-y,now/1000,Math.max(.06,Math.min(.7,strength))],this.nextTouch*4)
    this.nextTouch=(this.nextTouch+1)%8
  }
  drag(id:number,x:number,y:number,vx:number,vy:number) {
    let slot=this.contactSlots.get(id)
    if(slot===undefined){
      const occupied=new Set(this.contactSlots.values())
      slot=this.nextCurrent++%8
      for(let i=0;i<8&&occupied.has(slot);i++)slot=(slot+1)%8
      this.contactSlots.set(id,slot)
    }
    this.currents.set([x,1-y,vx,-vy],slot*4)
  }
  release(id:number){this.contactSlots.delete(id);this.rippleTimes.delete(id)}
  stir(x:number,y:number,rotation:number,radius:number) {
    this.vortex[0]=x;this.vortex[1]=1-y
    this.vortex[2]=Math.max(-2,Math.min(2,this.vortex[2]-rotation*5))
    this.vortex[3]=Math.min(.5,radius)
  }
  pinch(x:number,y:number,compression:number,radius:number,axisX=1,axisY=0){
    this.squeezeAxis.set([axisX,-axisY])
    this.squeeze[0]=x;this.squeeze[1]=1-y;this.squeeze[3]=Math.max(.07,radius)
    this.squeezeVelocity=Math.max(-6,Math.min(6,this.squeezeVelocity+compression*65))
  }
  render(source:HTMLCanvasElement,now:number,audio:WaterAudio,hasCamera=true) {
    const dt=Math.min(.05,Math.max(0,(now-this.previousFrame)/1000));this.previousFrame=now
    for(let i=0;i<8;i++){
      const k=i*4
      if(![...this.contactSlots.values()].includes(i)){
        this.currents[k]+=this.currents[k+2]*dt*.28
        this.currents[k+1]+=this.currents[k+3]*dt*.28
      }
      this.currents[k+2]*=Math.exp(-dt*1.4);this.currents[k+3]*=Math.exp(-dt*1.4)
    }
    this.vortexPhase+=this.vortex[2]*dt*3
    this.vortex[2]*=Math.exp(-dt*.8)
    this.squeezeVelocity+=(-22*this.squeeze[2]-4*this.squeezeVelocity)*dt
    this.squeeze[2]+=this.squeezeVelocity*dt
    const g=this.gl
    if(g.isContextLost())throw new Error('Water graphics paused. Reload to restore them.')
    g.viewport(0,0,this.canvas.width,this.canvas.height);g.useProgram(this.program)
    g.bindTexture(g.TEXTURE_2D,this.texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source)
    g.uniform1i(this.locations.camera,0);g.uniform1f(this.locations.time,now/1000)
    g.uniform1f(this.locations.aspect,this.canvas.width/this.canvas.height)
    g.uniform3f(this.locations.audio,audio.level,audio.bass,audio.treble)
    g.uniform4fv(this.locations['touches[0]'],this.touches)
    g.uniform4fv(this.locations['currents[0]'],this.currents)
    g.uniform4fv(this.locations.vortex,this.vortex)
    g.uniform4fv(this.locations.squeeze,this.squeeze)
    g.uniform2fv(this.locations.squeezeAxis,this.squeezeAxis)
    g.uniform1f(this.locations.vortexPhase,this.vortexPhase)
    g.uniform1f(this.locations.cameraMix,hasCamera?1:0)
    g.drawArrays(g.TRIANGLES,0,6)
    return this.canvas
  }
}
