import type { RollerDimensions } from './types'

export type RollerRole = 'male' | 'female'

export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
  triangleCount: number
}

interface BuildOptions {
  dimensions: RollerDimensions
  heightmap: Float32Array
  cols: number
  rows: number
  role: RollerRole
  referenceMark?: boolean
}

type V = [number, number, number]

/**
 * Watertight embosser roller (mm). Closed manifold shell for slicer volume checks.
 */
export function buildRollerMesh(opts: BuildOptions): MeshData {
  const { dimensions: d, heightmap, cols, rows, role, referenceMark = true } = opts
  const baseR = d.diameter / 2
  const halfLen = d.length / 2
  const relief =
    role === 'male' ? d.relief : Math.max(0.05, d.relief - d.clearance)
  const half = d.driveSize / 2
  const depth = Math.min(d.driveDepth, d.length / 2 - 0.5)
  const hasDrive = depth > 0.2 && half > 0.2 && half < baseR - 1

  const verts: V[] = []
  const tris: number[] = []
  const v = (x: number, y: number, z: number) => {
    verts.push([x, y, z])
    return verts.length - 1
  }
  const t = (a: number, b: number, c: number) => {
    tris.push(a, b, c)
  }

  // Cylinder grid
  const grid: number[][] = Array.from({ length: rows }, () => [])
  for (let r = 0; r < rows; r++) {
    const z = -halfLen + (r / (rows - 1)) * d.length
    const edgeT = edgeFalloff(r, rows, d.edgeFillet, d.length)
    for (let c = 0; c < cols; c++) {
      const theta = (c / cols) * Math.PI * 2
      const h = heightmap[r * cols + c] ?? 0
      const signed = role === 'male' ? h : -h
      const radius = Math.max(baseR * 0.35, baseR + signed * relief * edgeT)
      grid[r][c] = v(Math.cos(theta) * radius, Math.sin(theta) * radius, z)
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const c2 = (c + 1) % cols
      const a = grid[r][c]
      const b = grid[r][c2]
      const cc = grid[r + 1][c]
      const dd = grid[r + 1][c2]
      t(a, b, dd)
      t(a, dd, cc)
    }
  }

  const bot = grid[0]
  const top = grid[rows - 1]

  if (hasDrive) {
    capWithSquareDrive(bot, -halfLen, -halfLen + depth, half, cols, true, v, t, referenceMark, baseR)
    capWithSquareDrive(top, halfLen, halfLen - depth, half, cols, false, v, t, false, baseR)
  } else {
    const bc = v(0, 0, -halfLen)
    const tc = v(0, 0, halfLen)
    for (let c = 0; c < cols; c++) {
      const c2 = (c + 1) % cols
      t(bc, bot[c2], bot[c])
      t(tc, top[c], top[c2])
    }
  }

  // Strip degenerate faces
  const clean: number[] = []
  for (let i = 0; i < tris.length; i += 3) {
    const A = verts[tris[i]]
    const B = verts[tris[i + 1]]
    const C = verts[tris[i + 2]]
    const nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1])
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2])
    const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])
    if (nx * nx + ny * ny + nz * nz > 1e-12) clean.push(tris[i], tris[i + 1], tris[i + 2])
  }

  const positions = new Float32Array(verts.length * 3)
  for (let i = 0; i < verts.length; i++) {
    positions[i * 3] = verts[i][0]
    positions[i * 3 + 1] = verts[i][1]
    positions[i * 3 + 2] = verts[i][2]
  }
  const indices = new Uint32Array(clean)

  if (signedVolume(positions, indices) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]
      indices[i + 1] = indices[i + 2]
      indices[i + 2] = tmp
    }
  }

  const normals = new Float32Array(positions.length)
  recomputeNormals(positions, indices, normals)

  return {
    positions,
    normals,
    indices,
    triangleCount: indices.length / 3,
  }
}

/**
 * Close one cylinder end with a square drive socket and optional end-cap reference mark.
 * `outerIsMinZ`: true for the z=-halfLen end.
 */
function capWithSquareDrive(
  ring: number[],
  apertureZ: number,
  floorZ: number,
  half: number,
  cols: number,
  outerIsMinZ: boolean,
  v: (x: number, y: number, z: number) => number,
  t: (a: number, b: number, c: number) => void,
  hasReferenceMark = false,
  baseR = 15,
) {
  const aperture: number[] = []
  const mid: number[] = []
  const floor: number[] = []

  for (let c = 0; c < cols; c++) {
    const theta = (c / cols) * Math.PI * 2
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    const [sqX, sqY] = pointOnSquare(theta, half)
    aperture.push(v(sqX, sqY, apertureZ))
    floor.push(v(sqX, sqY, floorZ))

    const rSq = Math.hypot(sqX, sqY)
    const rMid = (rSq + baseR) / 2
    const xMid = cosT * rMid
    const yMid = sinT * rMid
    let zMid = apertureZ

    if (hasReferenceMark && outerIsMinZ) {
      // 3D reference dimple on top end-cap face right above square socket (theta = 0)
      const dotX = (half * 1.15 + baseR * 0.85) / 2
      const dotY = 0
      const dist = Math.hypot(xMid - dotX, yMid - dotY)
      const rDot = 2.2 // 4.4 mm diameter dimple zone
      if (dist < rDot) {
        const u = dist / rDot
        zMid = apertureZ + 1.2 * (1 - u * u) // 1.2 mm deep dimple into end face (+Z)
      }
    }

    mid.push(v(xMid, yMid, zMid))
  }

  for (let c = 0; c < cols; c++) {
    const c2 = (c + 1) % cols
    if (outerIsMinZ) {
      // Annulus face split into inner and outer ring
      t(aperture[c], mid[c], mid[c2])
      t(aperture[c], mid[c2], aperture[c2])
      t(mid[c], ring[c], ring[c2])
      t(mid[c], ring[c2], mid[c2])
      // Cavity wall
      t(aperture[c], floor[c], floor[c2])
      t(aperture[c], floor[c2], aperture[c2])
    } else {
      t(ring[c], ring[c2], mid[c2])
      t(ring[c], mid[c2], mid[c])
      t(mid[c], mid[c2], aperture[c2])
      t(mid[c], aperture[c2], aperture[c])
      t(aperture[c], aperture[c2], floor[c2])
      t(aperture[c], floor[c2], floor[c])
    }
  }

  // Floor center cap
  const floorCenter = v(0, 0, floorZ)
  for (let c = 0; c < cols; c++) {
    const c2 = (c + 1) % cols
    if (outerIsMinZ) {
      t(floorCenter, floor[c2], floor[c])
    } else {
      t(floorCenter, floor[c], floor[c2])
    }
  }
}

function pointOnSquare(theta: number, half: number): [number, number] {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const tx = Math.abs(c) < 1e-8 ? Number.POSITIVE_INFINITY : half / Math.abs(c)
  const ty = Math.abs(s) < 1e-8 ? Number.POSITIVE_INFINITY : half / Math.abs(s)
  const t = Math.min(tx, ty)
  return [c * t, s * t]
}

function edgeFalloff(row: number, rows: number, fillet: number, length: number): number {
  if (fillet <= 0) return 1
  const zNorm = row / (rows - 1)
  const mmFromEnd = Math.min(zNorm, 1 - zNorm) * length
  if (mmFromEnd >= fillet) return 1
  const u = mmFromEnd / fillet
  return 0.15 + 0.85 * (u * u * (3 - 2 * u))
}

function signedVolume(pos: Float32Array, idx: Uint32Array): number {
  let vol = 0
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] * 3
    const ib = idx[i + 1] * 3
    const ic = idx[i + 2] * 3
    const ax = pos[ia]
    const ay = pos[ia + 1]
    const az = pos[ia + 2]
    const bx = pos[ib]
    const by = pos[ib + 1]
    const bz = pos[ib + 2]
    const cx = pos[ic]
    const cy = pos[ic + 1]
    const cz = pos[ic + 2]
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)
  }
  return vol / 6
}

function recomputeNormals(pos: Float32Array, idx: Uint32Array, nor: Float32Array) {
  nor.fill(0)
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] * 3
    const ib = idx[i + 1] * 3
    const ic = idx[i + 2] * 3
    const ax = pos[ib] - pos[ia]
    const ay = pos[ib + 1] - pos[ia + 1]
    const az = pos[ib + 2] - pos[ia + 2]
    const bx = pos[ic] - pos[ia]
    const by = pos[ic + 1] - pos[ia + 1]
    const bz = pos[ic + 2] - pos[ia + 2]
    const nx = ay * bz - az * by
    const ny = az * bx - ax * bz
    const nz = ax * by - ay * bx
    nor[ia] += nx
    nor[ia + 1] += ny
    nor[ia + 2] += nz
    nor[ib] += nx
    nor[ib + 1] += ny
    nor[ib + 2] += nz
    nor[ic] += nx
    nor[ic + 1] += ny
    nor[ic + 2] += nz
  }
  for (let i = 0; i < pos.length / 3; i++) {
    const o = i * 3
    const len = Math.hypot(nor[o], nor[o + 1], nor[o + 2]) || 1
    nor[o] /= len
    nor[o + 1] /= len
    nor[o + 2] /= len
  }
}
