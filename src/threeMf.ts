import type { MeshData } from './mesh'
import { downloadBlob, meshToStl, zipDeflate } from './stl'

/** Lay roller on its side and shift in Y so both sit on the bed, pattern facing +Z. */
export function orientRollerOnBed(
  mesh: MeshData,
  diameterMm: number,
  yOffsetMm: number,
): MeshData {
  const R = diameterMm / 2
  const positions = new Float32Array(mesh.positions.length)
  const normals = new Float32Array(mesh.normals.length)
  let minZ = Infinity
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i]
    const y = mesh.positions[i + 1]
    const z = mesh.positions[i + 2]
    // x' = z, y' = x + yOffset, z' = y + R
    positions[i] = z
    positions[i + 1] = x + yOffsetMm
    positions[i + 2] = y + R
    if (positions[i + 2] < minZ) minZ = positions[i + 2]
    const nx = mesh.normals[i]
    const ny = mesh.normals[i + 1]
    const nz = mesh.normals[i + 2]
    normals[i] = nz
    normals[i + 1] = nx
    normals[i + 2] = ny
  }
  // Sit flush on the bed (raised emboss can extend past base radius)
  if (minZ !== 0 && Number.isFinite(minZ)) {
    for (let i = 2; i < positions.length; i += 3) positions[i] -= minZ
  }
  return {
    positions,
    normals,
    indices: mesh.indices,
    triangleCount: mesh.triangleCount,
  }
}

/** ZIP with two binary STLs — most reliable for Orca / Bambu / Prusa. */
export async function downloadRollersStlZip(
  male: MeshData,
  female: MeshData,
  preset: string,
  diameterMm: number,
  imageName?: string,
): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10)
  const tag = preset === 'image' && imageName ? sanitizeFilename(imageName) : preset
  const m = orientRollerOnBed(male, diameterMm, 0)
  const f = orientRollerOnBed(female, diameterMm, diameterMm + 8)
  const zip = await zipDeflate([
    {
      name: `rollwithit-male-${tag}.stl`,
      data: new Uint8Array(meshToStl(m, `rollwithit-male-${tag}`)),
    },
    {
      name: `rollwithit-female-${tag}.stl`,
      data: new Uint8Array(meshToStl(f, `rollwithit-female-${tag}`)),
    },
  ])
  downloadBlob(
    `rollwithit-rollers-${tag}-${stamp}-stl.zip`,
    zip,
    'application/zip',
  )
}

function sanitizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
}

