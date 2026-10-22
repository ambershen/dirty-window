import type { Hearing } from './audioEngine'

/**
 * Water for the VJ deck: a swimming pool, its tiled floor seen through a surface the music moves.
 * Everything on the water is round: ripples, swirls and little splashes, never straight waves.
 * The tempo sets the pool breathing in broad curved swells, one a bar (every two bars above
 * 135 BPM, so a fast track never shakes the wall); bass deepens them. Each beat drops a ripple
 * with a splash or two beside it, on a point that walks a figure across the bar, so a four-on-the-
 * floor keeps small ripples coming all the time; hats scatter droplets; a snare sets a small swirl
 * turning, one way then the other; the melody swims a wake along a path each phrase. A drop is a
 * big splash and whirl in the middle; a breakdown stills the pool to glass, with only a drop of
 * rain each bar. The phrase slowly turns the light.
 * The music plays the shape of the water, never its brightness: on a projector, light that jumps
 * with the beat reads as flicker, so the caustics are gentle and all light eases.
 */
const RINGS = 24, WAKE = 12, SWIRLS = 4
const DEFAULT_FLOOR = '/images/swimming-pool.jpg'

const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D pool;
uniform vec2 fit;
uniform float time;
uniform float aspect;
uniform vec4 rings[${RINGS}];
uniform float ringWave[${RINGS}];
uniform vec4 wake[${WAKE}];
uniform vec4 swirls[${SWIRLS}];
uniform float swirlBorn[${SWIRLS}];
uniform vec2 ring;
uniform vec3 swell;
uniform vec3 light;
float heightAt(vec2 p) {
  vec2 q=p*vec2(aspect,1.);
  // The swell: broad curved waves from far outside the pool, crossing slowly.
  float h=sin(length(q-vec2(-1.2,1.9))*6.-swell.x)*swell.y+sin(length(q-vec2(aspect+1.4,-1.1))*4.6-swell.x*.5+1.3)*swell.y*.7;
  // The pool is never quite still: faint slow undulations from a few far-off points.
  h+=(sin(length(q-vec2(.3,-2.))*17.-time*.8)+sin(length(q-vec2(aspect+2.,1.5))*21.-time*.95))*swell.z;
  for(int i=0;i<${RINGS};i++){
    float age=time-rings[i].z; if(age<0.||age>7.) continue;
    // Small ripples travel slower and fade sooner than big ones.
    float k=ringWave[i], r=length(q-rings[i].xy*vec2(aspect,1.)), d=r-age*ring.x*sqrt(45./k);
    float w=k*.16, b=1.7/k;
    // A drop first lifts a little round bubble of water, which then opens into the ring. The ring
    // leaves the centre smooth, so there is never a pinched point in the middle.
    h+=rings[i].w*.7*exp(-r*r/(b*b))*smoothstep(0.,.05,age)*(1.-smoothstep(.05,.32,age));
    h+=cos(d*k)*exp(-d*d*w*w)*rings[i].w*smoothstep(.04,.2,age)*exp(-age*ring.y*k/45.)*smoothstep(.6/k,2.4/k,r)/sqrt(1.+r*8.);
  }
  for(int i=0;i<${WAKE};i++){
    float age=time-wake[i].z; if(age<0.||age>3.) continue;
    float r=length(q-wake[i].xy*vec2(aspect,1.)), d=r-age*.14;
    h+=cos(d*80.)*exp(-d*d*180.)*wake[i].w*smoothstep(0.,.1,age)*exp(-age*1.4)*smoothstep(.008,.03,r);
  }
  for(int i=0;i<${SWIRLS};i++){
    if(swirls[i].z==0.) continue;
    float age=time-swirlBorn[i], R=swirls[i].w;
    vec2 v=q-swirls[i].xy*vec2(aspect,1.); float rr=dot(v,v);
    // It starts as a bubble, then settles into a soft funnel as the water turns (the turning
    // itself twists the floor seen through it, in main()).
    h+=exp(-rr/(R*R*.2))*.5*smoothstep(0.,.08,age)*(1.-smoothstep(.12,.6,age));
    h-=exp(-rr/(R*R))*abs(swirls[i].z)*.22*smoothstep(.15,.6,age);
  }
  return h;
}
void main(){
  vec2 p=uv;
  float e=1.5/720.;
  float h=heightAt(p), hx=heightAt(p+vec2(e,0.)), hy=heightAt(p+vec2(0.,e));
  float hx0=heightAt(p-vec2(e,0.)), hy0=heightAt(p-vec2(0.,e));
  vec2 slope=vec2(hx-hx0,hy-hy0)/(2.*e);
  float curve=(hx+hx0+hy+hy0-4.*h)/(e*e);
  // Refraction: the tiles bend under the slope of the surface.
  vec2 bed=p-slope*.00036;
  // A swirl twists the floor around its centre, most in the middle, smoothly to nothing at its edge.
  for(int i=0;i<${SWIRLS};i++){
    if(swirls[i].z==0.) continue;
    vec2 c=swirls[i].xy, v=(bed-c)*vec2(aspect,1.);
    float a=swirls[i].z*.9*exp(-dot(v,v)/(swirls[i].w*swirls[i].w))*smoothstep(.15,.7,time-swirlBorn[i]);
    v=mat2(cos(a),sin(a),-sin(a),cos(a))*v;
    bed=c+v/vec2(aspect,1.);
  }
  bed=clamp(bed,vec2(.002),vec2(.998));
  vec3 color=texture2D(pool,(bed-.5)*fit+.5).rgb;
  // Caustics, kept gentle: where the surface curves like a lens the floor is a little brighter.
  float focus=clamp(-curve*.00006,-1.,1.);
  color*=1.+light.z*(max(focus,0.)*.22-max(-focus,0.)*.06);
  // A soft, broad sheen on the wave faces.
  vec3 n=normalize(vec3(-slope*.01,1.));
  float sheen=pow(max(0.,dot(reflect(-normalize(vec3(light.xy,1.)),n),vec3(0.,0.,1.))),8.);
  color+=vec3(.75,.9,.95)*sheen*.025;
  color*=vec3(.96,1.,1.02);
  gl_FragColor=vec4(color,1.);
}`

/** Each bar the beat walks one of these figures, a point per beat (x, y in 0..1, y up). */
const FIGURES: { name: string; points: [number, number][] }[] = [
  { name: 'four corners', points: [[.25, .7], [.75, .7], [.75, .3], [.25, .3]] },
  { name: 'diagonal', points: [[.2, .8], [.4, .6], [.6, .4], [.8, .2]] },
  { name: 'cross', points: [[.5, .78], [.78, .5], [.5, .22], [.22, .5]] },
  { name: 'circle', points: [[.5, .75], [.72, .5], [.5, .25], [.28, .5]] },
]
/** The paths the melody swims each phrase, as functions of 0..1 around the loop. */
const PATHS: { name: string; at: (t: number) => [number, number] }[] = [
  { name: 'figure of eight', at: t => [.5 + Math.sin(t * Math.PI * 2) * .32, .5 + Math.sin(t * Math.PI * 4) * .2] },
  { name: 'spiral', at: t => { const r = .08 + .3 * (.5 - .5 * Math.cos(t * Math.PI * 2)); return [.5 + Math.cos(t * Math.PI * 6) * r * 1.2, .5 + Math.sin(t * Math.PI * 6) * r] } },
  { name: 'lengths', at: t => [.5 + Math.sin(t * Math.PI * 2) * .38, .5 + Math.cos(t * Math.PI * 6) * .08 + Math.sin(t * Math.PI * 2) * .1] },
]
const rand = (n: number) => (Math.random() * 2 - 1) * n

export class WaterPool {
  readonly canvas = document.createElement('canvas')
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private at: Record<string, WebGLUniformLocation | null> = {}
  private image = new Image()
  private imageAspect = 736 / 981
  private width = 1; private height = 1
  private rings = new Float32Array(RINGS * 4); private ringWave = new Float32Array(RINGS).fill(50); private nextRing = 0
  private wake = new Float32Array(WAKE * 4); private nextWake = 0; private lastWake = 0
  private swirls = new Float32Array(SWIRLS * 4); private swirlBorn = new Float32Array(SWIRLS); private nextSwirl = 0
  private swellPhase = 0; private swellAmp = .1; private still = .01
  private lightAngle = 0; private caustics = .6
  private swim = 0; private lastDrop = -Infinity; private splashes = 0; private lastDroplet = 0
  calm = false
  mood = 'still'
  figure = ''

  constructor(host: HTMLElement) {
    this.canvas.className = 'vj-deck vj-water'; host.prepend(this.canvas)
    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false })
    if (!gl) throw new Error('Water needs WebGL.')
    this.gl = gl
    const compile = (kind: number, source: string) => {
      const s = gl.createShader(kind)!; gl.shaderSource(s, source); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'Water shader failed.')
      return s
    }
    this.program = gl.createProgram()!
    gl.attachShader(this.program, compile(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){ uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }'))
    gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(this.program); gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(this.program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    for (const name of ['pool', 'fit', 'time', 'aspect', 'rings[0]', 'ringWave[0]', 'wake[0]', 'swirls[0]', 'swirlBorn[0]', 'ring', 'swell', 'light']) this.at[name] = gl.getUniformLocation(this.program, name)
    // The pool floor: a pale blue until the photo arrives.
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([110, 170, 200]))
    this.image.onload = () => { this.imageAspect = this.image.naturalWidth / this.image.naturalHeight; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.image) }
    this.floor()
    for (const a of [this.rings, this.wake]) for (let i = 2; i < a.length; i += 4) a[i] = -100
  }

  /** Show another picture as the pool floor (any image URL); the default is the tiled pool. */
  floor(src = DEFAULT_FLOOR) { this.image.src = src }

  resize(width: number, height: number) {
    this.width = width; this.height = height
    // A capped resolution: the water is soft anyway, and the shader is heavy.
    const scale = Math.min(Math.min(1.25, devicePixelRatio), 1280 / Math.max(width, height))
    this.canvas.width = Math.round(width * scale); this.canvas.height = Math.round(height * scale)
  }

  /** A ripple at (x, y); wave is how fine it is (about 30 a broad ring … 120 a droplet). */
  private ripple(x: number, y: number, amp: number, wave: number, t: number) {
    const i = this.nextRing++ % RINGS
    this.rings.set([x, y, t, amp], i * 4); this.ringWave[i] = wave
  }
  /** A swirl that sets the water turning at (x, y), spinning one way or the other. */
  private swirl(x: number, y: number, spin: number, radius: number, t: number) {
    const i = this.nextSwirl++ % SWIRLS
    this.swirls.set([x, y, spin, radius], i * 4); this.swirlBorn[i] = t
  }

  frame(hear: Hearing, dt: number, now: number, intensity: number) {
    const t = now / 1000, beat = 60 / Math.max(60, hear.bpm), k = intensity, ease = (tau: number) => 1 - Math.exp(-dt / tau)
    const bar = hear.count % 4, phrase = Math.floor(hear.count / 32), half = hear.bpm > 135
    // Sections, as on the sand: a drop is a sudden rise in energy; a breakdown a long quiet.
    const drop = hear.trend > 1.45 && hear.level > .35 && now - this.lastDrop > 8000
    this.calm = hear.trend < .55 || (this.calm && hear.trend < .9)
    const quiet = hear.level < .03

    // The swell breathes once a bar, or once every two bars on a fast track.
    this.swellPhase += dt * Math.PI * 2 / (beat * 4 * (half ? 2 : 1))
    this.swellAmp += ((this.calm || quiet ? .03 : .08 + (hear.bands.bass * .7 + hear.bands.sub * .4) * .4 * k) - this.swellAmp) * ease(.8)
    this.still += ((this.calm ? .004 : .01) - this.still) * ease(1.5)

    // Slow tracks spread big, sparse rings; fast ones finer, quicker ones.
    const pace = Math.min(1.2, .36 / beat), size = Math.min(1, Math.max(0, (hear.bpm - 80) / 90)), fade = .9 / (beat * 2.5)

    if (drop) {
      this.lastDrop = now; this.splashes = 3
      this.ripple(.5, .5, 1.3 * k, 30, t); this.swirl(.5, .5, 2.4 * k * (Math.random() < .5 ? -1 : 1), .3, t)
    }
    if (hear.beat && !quiet) {
      if (this.splashes > 0) { this.splashes--; this.ripple(.5 + rand(.06), .5 + rand(.06), .9 * k, 36, t) }
      else if (this.calm) { if (bar === 0) this.ripple(.15 + Math.random() * .7, .15 + Math.random() * .7, .3 * k, 55, t) }
      else {
        // A ripple on the figure's point, with a splash or two beside it.
        const [x, y] = FIGURES[phrase % FIGURES.length].points[bar], amp = (.45 + hear.kick * .5 + hear.bands.bass * .15) * k
        this.ripple(x + rand(.02), y + rand(.02), amp, 44 + size * 20, t)
        for (let i = 0; i < 1 + (hear.kick > .7 ? 1 : 0); i++) this.ripple(x + rand(.08), y + rand(.08), amp * .4, 85 + size * 25, t + Math.random() * .06)
      }
    }
    // Hats scatter droplets: tiny ripples here and there, never more than one every eighth of a beat.
    if (!this.calm && !quiet && (hear.hatHit || hear.bands.air > .55) && now - this.lastDroplet > beat * 125) {
      this.lastDroplet = now
      this.ripple(.1 + Math.random() * .8, .1 + Math.random() * .8, (.1 + hear.hat * .12) * k, 105 + Math.random() * 25, t)
    }
    // A snare sets a small swirl turning, one way then the other.
    if (hear.snareHit && !this.calm && !quiet) this.swirl(.2 + Math.random() * .6, .2 + Math.random() * .6, (.6 + hear.snare * .7) * k * (hear.count % 4 < 2 ? 1 : -1), .08 + Math.random() * .06, t)

    // The melody swims a wake along the phrase's path, once around in a phrase.
    this.swim = (this.swim + dt / (beat * 32)) % 1
    if (!this.calm && hear.bands.mid > .15 && now - this.lastWake > 90) {
      this.lastWake = now
      const [x, y] = PATHS[phrase % PATHS.length].at(this.swim)
      this.wake.set([x, y, t, Math.min(.3, hear.bands.mid * .35) * k], this.nextWake++ % WAKE * 4)
    }

    // The swirls slowly unwind.
    for (let i = 0; i < SWIRLS; i++) {
      const s = i * 4 + 2
      this.swirls[s] *= Math.exp(-dt * .45)
      if (Math.abs(this.swirls[s]) < .01) this.swirls[s] = 0
    }
    // Each phrase turns the light a quarter round; the caustics ease with the energy.
    this.lightAngle += (phrase * Math.PI / 2 - this.lightAngle) * ease(4)
    this.caustics += ((this.calm ? .35 : .5 + hear.level * .3) - this.caustics) * ease(1.5)

    this.mood = this.calm ? 'calm · glass' : now - this.lastDrop < 5000 ? 'drop · splash' : half ? 'ripples · half-time swell' : 'ripples'
    this.figure = this.calm ? 'a drop of rain each bar' : `ripples on the ${FIGURES[phrase % FIGURES.length].name} · ${PATHS[phrase % PATHS.length].name} wake`

    const gl = this.gl, A = this.width / this.height
    // Cover the screen with the photo, cropping what does not fit.
    const fx = A > this.imageAspect ? 1 : A / this.imageAspect, fy = A > this.imageAspect ? this.imageAspect / A : 1
    gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.useProgram(this.program)
    gl.uniform1i(this.at.pool, 0); gl.uniform2f(this.at.fit, fx, fy)
    gl.uniform1f(this.at.time, t); gl.uniform1f(this.at.aspect, A)
    gl.uniform4fv(this.at['rings[0]'], this.rings); gl.uniform1fv(this.at['ringWave[0]'], this.ringWave)
    gl.uniform4fv(this.at['wake[0]'], this.wake)
    gl.uniform4fv(this.at['swirls[0]'], this.swirls); gl.uniform1fv(this.at['swirlBorn[0]'], this.swirlBorn)
    gl.uniform2f(this.at.ring, pace, fade)
    gl.uniform3f(this.at.swell, this.swellPhase % (Math.PI * 4), this.swellAmp, this.still)
    gl.uniform3f(this.at.light, Math.cos(this.lightAngle + .8) * .5, Math.sin(this.lightAngle + .8) * .5, this.caustics)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
