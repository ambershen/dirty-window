/** Cached grain and a small blur surface keep frost inexpensive to composite. */
export class FrostedGlass {
  private surface = document.createElement('canvas')
  private ctx = this.surface.getContext('2d')!
  private mask = document.createElement('canvas')
  private maskCtx = this.mask.getContext('2d')!
  private grain = document.createElement('canvas')
  private moisture = document.createElement('canvas')
  private width = 1
  private height = 1
  private lastTime = 0
  private lastWipe = -Infinity
  private readonly clearHoldMs = 2000
  private readonly frostReturnSeconds = 1.2

  constructor() {
    this.grain.width = this.grain.height = 128
    const g = this.grain.getContext('2d')!
    const pixels = g.createImageData(128, 128)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const light = Math.random() > .5 ? 255 : 130
      pixels.data.set([light, light, light, Math.floor(Math.random() * 24)], i)
    }
    g.putImageData(pixels, 0, 0)
  }

  resize(width: number, height: number) {
    this.width = width; this.height = height
    this.surface.width = Math.max(1, Math.ceil(width / 4))
    this.surface.height = Math.max(1, Math.ceil(height / 4))
    this.mask.width = this.surface.width
    this.mask.height = this.surface.height
    this.buildMoisture()
    this.reset()
  }

  private buildMoisture() {
    const w = this.moisture.width = this.surface.width
    const h = this.moisture.height = this.surface.height
    const c = this.moisture.getContext('2d')!
    // Uneven sheets of condensation, cached rather than regenerated per frame.
    for (let i = 0; i < 22; i++) {
      const x = Math.random()*w, y = Math.random()*h
      const r = Math.min(w,h)*(.18+Math.random()*.25)
      const fog = c.createRadialGradient(x,y,0,x,y,r)
      fog.addColorStop(0,'rgba(240,248,249,.11)')
      fog.addColorStop(1,'rgba(240,248,249,0)')
      c.fillStyle=fog; c.fillRect(x-r,y-r,r*2,r*2)
    }
    // Small wet beads: a dark refractive rim and a soft upper highlight.
    const count = Math.min(1100, Math.floor(this.width*this.height/1600))
    for (let i = 0; i < count; i++) {
      const x=Math.random()*w, y=Math.random()*h
      const r=.25+Math.random()*.65, stretch=1+Math.random()*.6
      c.beginPath(); c.ellipse(x,y,r,r*stretch,0,0,Math.PI*2)
      c.fillStyle='rgba(120,148,153,.14)'; c.fill()
      c.beginPath(); c.ellipse(x-r*.2,y-r*.35,r*.55,r*.3,0,0,Math.PI*2)
      c.fillStyle='rgba(255,255,255,.48)'; c.fill()
      if(i%45===0) {
        c.strokeStyle='rgba(167,191,196,.12)'; c.lineWidth=r*.65
        c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+r,y+4,x-r*.5,y+8+Math.random()*8); c.stroke()
      }
    }
  }

  reset() {
    this.maskCtx.globalCompositeOperation = 'source-over'
    this.maskCtx.fillStyle = '#fff'
    this.maskCtx.fillRect(0, 0, this.mask.width, this.mask.height)
  }

  wipe(x: number, y: number, previous?: { x: number; y: number }, radius = 14) {
    this.lastWipe = performance.now()
    const c = this.maskCtx
    c.save()
    c.scale(this.mask.width / this.width, this.mask.height / this.height)
    c.globalCompositeOperation = 'destination-out'
    c.strokeStyle = '#000'; c.fillStyle = '#000'
    c.lineWidth = radius * 2; c.lineCap = 'round'
    c.shadowColor = '#000'; c.shadowBlur = 3
    if (previous) {
      c.beginPath(); c.moveTo(previous.x, previous.y); c.lineTo(x, y); c.stroke()
    } else {
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill()
    }
    c.restore()
  }

  render(source: HTMLCanvasElement, now: number) {
    const dt = Math.min((now - (this.lastTime || now)) / 1000, .1)
    this.lastTime = now
    // Hold the fresh wipe briefly, then re-fog it over the next few seconds.
    if (now - this.lastWipe > this.clearHoldMs) {
      this.maskCtx.fillStyle = `rgba(255,255,255,${1 - Math.exp(-dt / this.frostReturnSeconds)})`
      this.maskCtx.fillRect(0, 0, this.mask.width, this.mask.height)
    }
    const c = this.ctx, w = this.surface.width, h = this.surface.height
    c.clearRect(0, 0, w, h)
    c.save()
    c.filter = 'blur(5.5px)'
    c.drawImage(source, -6, -6, w + 12, h + 12)
    c.restore()
    c.fillStyle = 'rgba(225,237,241,.60)'
    c.fillRect(0, 0, w, h)
    c.fillStyle = c.createPattern(this.grain, 'repeat')!
    c.globalAlpha = .55
    c.fillRect(0, 0, w, h)
    c.globalAlpha = 1
    c.drawImage(this.moisture,0,0)
    c.globalCompositeOperation = 'destination-in'
    c.drawImage(this.mask, 0, 0)
    c.globalCompositeOperation = 'source-over'
    return this.surface
  }
}
