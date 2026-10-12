import type { WaterAudio as Levels } from '../effects/WaterSurface'

export class WaterAudioInput {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private wave = new Uint8Array(1024)
  private spectrum = new Uint8Array(512)
  private generation = 0
  readonly levels: Levels = { level: 0, bass: 0, treble: 0 }
  get active(){return !!this.stream}

  async start() {
    const generation=++this.generation
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false})
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return}
    this.stream=stream
    try {
      this.context=new AudioContext();await this.context.resume()
      if(generation!==this.generation)return
      this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.65
      this.context.createMediaStreamSource(stream).connect(this.analyser)
      // No connection to speakers: no feedback or audio upload.
    } catch(error){this.stop();throw error}
  }
  stop() {
    this.generation++;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null
    void this.context?.close();this.context=null;this.analyser=null
    this.levels.level=this.levels.bass=this.levels.treble=0
  }
  sample(dt:number):Levels {
    if(!this.analyser||!this.context)return this.levels
    this.analyser.getByteTimeDomainData(this.wave);this.analyser.getByteFrequencyData(this.spectrum)
    let sum=0;for(const value of this.wave)sum+=((value-128)/128)**2
    const level=Math.min(1,Math.max(0,Math.sqrt(sum/this.wave.length)-.008)*7)
    const band=(low:number,high:number)=>{
      const binHz=this.context!.sampleRate/this.analyser!.fftSize
      const from=Math.max(1,Math.floor(low/binHz)),to=Math.min(this.spectrum.length,Math.ceil(high/binHz))
      let value=0;for(let i=from;i<to;i++)value+=this.spectrum[i]/255
      return to>from?value/(to-from):0
    }
    const alpha=1-Math.exp(-dt/0.07)
    this.levels.level+=(level-this.levels.level)*alpha
    this.levels.bass+=(band(40,300)*level-this.levels.bass)*alpha
    this.levels.treble+=(band(1800,7000)*level-this.levels.treble)*alpha
    return this.levels
  }
}
