import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { MeshData } from './mesh'

export class RollerPreview {
  readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly canvas: HTMLCanvasElement
  private maleGroup: THREE.Group | null = null
  private femaleGroup: THREE.Group | null = null
  private maleMesh: THREE.Mesh | null = null
  private femaleMesh: THREE.Mesh | null = null
  private raf = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500)
    // Position camera slightly to the right to reveal the +X end caps
    this.camera.position.set(35, 42, 85)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0, 0)

    const hemi = new THREE.HemisphereLight(0xf2efe8, 0x2a3545, 1.1)
    this.scene.add(hemi)
    const key = new THREE.DirectionalLight(0xfff2d8, 1.35)
    key.position.set(40, 60, 30)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xa8c4b8, 0.45)
    fill.position.set(-30, -10, -40)
    this.scene.add(fill)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2c3646,
        metalness: 0.1,
        roughness: 0.9,
        transparent: true,
        opacity: 0.35,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -28
    this.scene.add(floor)

    this.resize()
    this.loop()
  }

  resize() {
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth || this.canvas.clientWidth || 640
    const h = parent?.clientHeight || 420
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
  }

  setMeshes(male: MeshData, female: MeshData) {
    this.clearRoller(this.maleGroup, this.maleMesh)
    this.clearRoller(this.femaleGroup, this.femaleMesh)

    this.maleMesh = meshFromData(male, 0xc4a574)
    this.femaleMesh = meshFromData(female, 0x7f9b8c)

    // Mesh axis is +Z. Parent tilts that axis onto world +X so rollers lie
    // horizontal; spin is applied on the mesh's local Z only.
    this.maleGroup = new THREE.Group()
    this.femaleGroup = new THREE.Group()
    this.maleGroup.add(this.maleMesh)
    this.femaleGroup.add(this.femaleMesh)

    this.maleGroup.rotation.y = Math.PI / 2
    this.femaleGroup.rotation.y = Math.PI / 2
    this.maleGroup.position.set(0, 8, -16)
    this.femaleGroup.position.set(0, -8, 16)

    this.scene.add(this.maleGroup, this.femaleGroup)
  }

  private clearRoller(group: THREE.Group | null, mesh: THREE.Mesh | null) {
    if (group) this.scene.remove(group)
    if (mesh) {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    // Opposite spin like mating embosser rollers
    if (this.maleMesh) this.maleMesh.rotation.z += 0.012
    if (this.femaleMesh) this.femaleMesh.rotation.z -= 0.012
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    this.renderer.dispose()
  }
}

function meshFromData(data: MeshData, color: number): THREE.Mesh {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1))
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.22,
    roughness: 0.48,
  })
  return new THREE.Mesh(geo, mat)
}
