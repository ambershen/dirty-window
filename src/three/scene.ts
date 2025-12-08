import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  sRGBEncoding,
  Mesh,
  SphereGeometry,
  MeshPhysicalMaterial,
  DirectionalLight,
  AmbientLight,
} from 'three'
import { loadEnvironment } from './loaders'

export type GlassParams = {
  transmission: number
  thickness: number
  ior: number
  roughness: number
  specular: number
}

export class ThreeApp {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 100)
  readonly renderer = new WebGLRenderer({ antialias: true, canvas: document.getElementById('webgl') as HTMLCanvasElement })

  private sphere!: Mesh
  private material!: MeshPhysicalMaterial

  constructor() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputEncoding = sRGBEncoding

    this.camera.position.set(0, 0, 4)

    this.scene.background = new Color(0x0a0a0a)

    const dir = new DirectionalLight(0xffffff, 1.0)
    dir.position.set(5, 5, 5)
    this.scene.add(dir)
    this.scene.add(new AmbientLight(0xffffff, 0.2))

    this.createSphere()
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  async initEnv() {
    // Use null to trigger fallback procedural environment since we don't have the HDR file
    await loadEnvironment(this.renderer, this.scene, null)
  }

  private createSphere() {
    const geometry = new SphereGeometry(1, 64, 64)
    this.material = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.15,
      transmission: 0.75,
      thickness: 1.2,
      ior: 1.5,
      specularIntensity: 0.8,
      envMapIntensity: 1.0,
    })
    this.sphere = new Mesh(geometry, this.material)
    this.scene.add(this.sphere)
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  updateGlass(params: Partial<GlassParams>) {
    if (params.transmission !== undefined) this.material.transmission = params.transmission
    if (params.thickness !== undefined) this.material.thickness = params.thickness
    if (params.ior !== undefined) this.material.ior = params.ior
    if (params.roughness !== undefined) this.material.roughness = params.roughness
    if (params.specular !== undefined) this.material.specularIntensity = params.specular
  }

  rotate(dx: number, dy: number) {
    this.sphere.rotation.y += dx
    this.sphere.rotation.x += dy
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
