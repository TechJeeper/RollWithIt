import type { MeshData } from './mesh'

/** Binary STL (little-endian), units = millimeters. */
export function meshToStl(mesh: MeshData, name = 'roller'): ArrayBuffer {
  const tris = mesh.triangleCount
  const buffer = new ArrayBuffer(84 + tris * 50)
  const view = new DataView(buffer)
  const encoder = new TextEncoder()
  const title = encoder.encode(name.slice(0, 80))
  for (let i = 0; i < 80; i++) view.setUint8(i, title[i] ?? 0)
  view.setUint32(80, tris, true)

  let offset = 84
  const { positions, indices } = mesh
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t] * 3
    const ib = indices[t + 1] * 3
    const ic = indices[t + 2] * 3
    const ax = positions[ia]
    const ay = positions[ia + 1]
    const az = positions[ia + 2]
    const bx = positions[ib]
    const by = positions[ib + 1]
    const bz = positions[ib + 2]
    const cx = positions[ic]
    const cy = positions[ic + 1]
    const cz = positions[ic + 2]

    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cx - ax
    const vy = cy - ay
    const vz = cz - az
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len

    view.setFloat32(offset, nx, true)
    view.setFloat32(offset + 4, ny, true)
    view.setFloat32(offset + 8, nz, true)
    view.setFloat32(offset + 12, ax, true)
    view.setFloat32(offset + 16, ay, true)
    view.setFloat32(offset + 20, az, true)
    view.setFloat32(offset + 24, bx, true)
    view.setFloat32(offset + 28, by, true)
    view.setFloat32(offset + 32, bz, true)
    view.setFloat32(offset + 36, cx, true)
    view.setFloat32(offset + 40, cy, true)
    view.setFloat32(offset + 44, cz, true)
    view.setUint16(offset + 48, 0, true)
    offset += 50
  }
  return buffer
}

export function downloadBlob(filename: string, data: BlobPart, type: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on next tick so the download can start
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** ZIP with deflate-raw (method 8) when CompressionStream is available. */
export async function zipDeflate(
  files: Array<{ name: string; data: Uint8Array }>,
): Promise<Blob> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const canDeflate = typeof CompressionStream !== 'undefined'

  for (const file of files) {
    const nameBytes = enc.encode(file.name)
    const raw = file.data
    const compressed = canDeflate ? await deflateRaw(raw) : raw
    const method = canDeflate && compressed.length < raw.length ? 8 : 0
    const payload = method === 8 ? compressed : raw
    const version = method === 8 ? 20 : 10
    const crc = crc32(raw)

    // Local file header (PK\x03\x04)
    const local = new Uint8Array(30 + nameBytes.length + payload.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, version, true) // version needed
    lv.setUint16(6, 0, true) // flags
    lv.setUint16(8, method, true)
    lv.setUint16(10, 0, true) // mod time
    lv.setUint16(12, 0, true) // mod date
    lv.setUint32(14, crc, true)
    lv.setUint32(18, payload.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // extra len
    local.set(nameBytes, 30)
    local.set(payload, 30 + nameBytes.length)
    locals.push(local)

    // Central directory header (PK\x01\x02)
    // NOTE: compression method is at offset 10 (flags are at 8) — easy to mix up.
    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, version, true) // version made by
    cv.setUint16(6, version, true) // version needed
    cv.setUint16(8, 0, true) // flags
    cv.setUint16(10, method, true)
    cv.setUint16(12, 0, true) // mod time
    cv.setUint16(14, 0, true) // mod date
    cv.setUint32(16, crc, true)
    cv.setUint32(20, payload.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true) // extra
    cv.setUint16(32, 0, true) // comment
    cv.setUint16(34, 0, true) // disk start
    cv.setUint16(36, 0, true) // internal attrs
    cv.setUint32(38, 0, true) // external attrs
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)

    offset += local.length
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  return new Blob([...locals, ...centrals, end] as BlobPart[], {
    type: 'application/zip',
  })
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** @deprecated prefer zipDeflate — kept for simple store-only needs */
export function zipStore(
  files: Array<{ name: string; data: ArrayBuffer | Uint8Array }>,
): Blob {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = enc.encode(file.name)
    const data =
      file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, 0, true)
    lv.setUint32(14, crc32(data), true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(8, 0, true)
    cv.setUint32(16, crc32(data), true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)

    offset += local.length
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...locals, ...centrals, end] as BlobPart[], {
    type: 'application/zip',
  })
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function canvasToSvg(canvas: HTMLCanvasElement, mmW: number, mmH: number): string {
  const data = canvas.toDataURL('image/png')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${mmW}mm" height="${mmH}mm" viewBox="0 0 ${mmW} ${mmH}">
  <title>RollWithIt unwrapped pattern</title>
  <image width="${mmW}" height="${mmH}" xlink:href="${data}" />
</svg>`
}
