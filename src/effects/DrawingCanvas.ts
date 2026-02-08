export class DrawingCanvas {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width: number
  private height: number
  private currentColor: string = '#ff0000'
  private _brushSize: number = 15
  private isDrawing: boolean = false
  private lastX: number = 0
  private lastY: number = 0

  private readonly colors = [
    '#ff0000', '#00ff00', '#ffd700', '#ff69b4',
    '#00bfff', '#ff4500', '#9370db', '#32cd32'
  ]
  private _colorIndex: number = 0

  constructor() {
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.canvas = document.createElement('canvas')
    this.canvas.id = 'doodle-canvas'
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.position = 'fixed'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '5'
    this.ctx = this.canvas.getContext('2d')!

    window.addEventListener('resize', () => this.resize())
  }

  appendTo(parent: HTMLElement) {
    parent.appendChild(this.canvas)
  }

  show() {
    this.canvas.style.display = ''
  }

  hide() {
    this.canvas.style.display = 'none'
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  resize() {
    const oldData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.ctx.putImageData(oldData, 0, 0)
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  startDrawing(x: number, y: number) {
    this.isDrawing = true
    this.lastX = x
    this.lastY = y
    this.drawPoint(x, y)
  }

  continueDrawing(x: number, y: number) {
    if (!this.isDrawing) return
    this.drawLine(this.lastX, this.lastY, x, y)
    this.lastX = x
    this.lastY = y
  }

  stopDrawing() {
    this.isDrawing = false
  }

  get isActive(): boolean {
    return this.isDrawing
  }

  setNextColor(): { color: string; name: string } {
    this._colorIndex = (this._colorIndex + 1) % this.colors.length
    this.currentColor = this.colors[this._colorIndex]
    return { color: this.currentColor, name: this.getColorName() }
  }

  setColorIndex(index: number) {
    this._colorIndex = index % this.colors.length
    this.currentColor = this.colors[this._colorIndex]
  }

  get colorIndex(): number {
    return this._colorIndex
  }

  getColor(): string {
    return this.currentColor
  }

  getColorName(): string {
    const names = ['Red', 'Green', 'Gold', 'Pink', 'Blue', 'Orange', 'Purple', 'Lime']
    return names[this._colorIndex]
  }

  get brushSize(): number {
    return this._brushSize
  }

  set brushSize(size: number) {
    this._brushSize = Math.max(5, Math.min(40, size))
  }

  private drawPoint(x: number, y: number) {
    if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > this.width || y > this.height) return
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'source-over'
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, this._brushSize)
    gradient.addColorStop(0, this.currentColor)
    gradient.addColorStop(0.7, this.currentColor)
    gradient.addColorStop(1, this.currentColor + '00')
    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(x, y, this._brushSize, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()
  }

  private drawLine(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const dist = Math.sqrt(dx * dx + dy * dy)
    const step = Math.max(2, this._brushSize * 0.3)
    const steps = Math.ceil(dist / step)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      this.drawPoint(x, y)
    }
  }
}
