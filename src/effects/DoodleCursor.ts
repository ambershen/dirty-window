export class DoodleCursor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private visible = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'doodle-cursor'
    this.canvas.style.position = 'fixed'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '13'
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.ctx = this.canvas.getContext('2d')!
  }

  appendTo(parent: HTMLElement) { parent.appendChild(this.canvas) }
  show() { this.canvas.style.display = ''; this.visible = true }
  hide() { this.canvas.style.display = 'none'; this.visible = false }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  render(x: number, y: number, brushSize: number, color: string, isEraser = false) {
    if (!this.visible) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.beginPath()
    this.ctx.arc(x, y, brushSize, 0, Math.PI * 2)

    if (isEraser) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      this.ctx.lineWidth = 2
      this.ctx.setLineDash([4, 4])
      this.ctx.stroke()
      this.ctx.setLineDash([])
    } else {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.arc(x, y, brushSize, 0, Math.PI * 2)
      this.ctx.fillStyle = color + '40'
      this.ctx.fill()
    }

    // Center dot
    this.ctx.beginPath()
    this.ctx.arc(x, y, 2, 0, Math.PI * 2)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    this.ctx.fill()
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
