import { PMREMGenerator, Texture } from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { WebGLRenderer, Scene } from 'three'

export async function loadEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  hdrUrl: string | null
): Promise<Texture> {
  const pmrem = new PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()

  try {
    if (hdrUrl) {
      const res = await fetch(hdrUrl, { method: 'HEAD' })
      if (res.ok) {
        const hdrTex = await new RGBELoader().loadAsync(hdrUrl)
        const envMap = pmrem.fromEquirectangular(hdrTex).texture
        hdrTex.dispose()
        scene.environment = envMap
        return envMap
      }
    }
  } catch (e) {
    // Fallback to procedural room environment
  }

  const room = new RoomEnvironment()
  const envMap = pmrem.fromScene(room, 0.1).texture
  scene.environment = envMap
  room.dispose()
  return envMap
}
