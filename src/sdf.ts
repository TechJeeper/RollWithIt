/**
 * Smooth emboss heights from a canvas via signed distance field.
 * Avoids the Manhattan stair-steps of raw binary heightmaps.
 */

export function canvasToSignedDistance(
  canvas: HTMLCanvasElement,
  invert = false,
): { width: number; height: number; dist: Float32Array; pxPerMmX: number; pxPerMmY: number } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return {
      width: 1,
      height: 1,
      dist: new Float32Array(1),
      pxPerMmX: 1,
      pxPerMmY: 1,
    }
  }
  const { width, height } = canvas
  const src = ctx.getImageData(0, 0, width, height).data
  const inside = new Uint8Array(width * height)

  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    const lum = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255
    // Black ink = inside emboss region
    let ink = lum < 0.5
    if (invert) ink = !ink
    inside[p] = ink ? 1 : 0
  }

  const dist = signedDistanceTransform(inside, width, height)
  return {
    width,
    height,
    dist,
    pxPerMmX: width,
    pxPerMmY: height,
  }
}

/**
 * Sample a smooth 0..1 heightmap (1 = full relief) onto the roller grid.
 * `bevelMm` controls how wide the edge ramp is — larger = smoother curves.
 */
export function sampleSmoothHeightmap(
  canvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  circMm: number,
  lengthMm: number,
  bevelMm: number,
  mirror = false,
): Float32Array {
  const { width, height, dist } = canvasToSignedDistance(canvas)
  const out = new Float32Array(cols * rows)
  const pxPerMmU = width / circMm
  const pxPerMmV = height / lengthMm
  const bevelPx = Math.max(1.25, bevelMm * Math.min(pxPerMmU, pxPerMmV))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = mirror ? 1 - (c + 0.5) / cols : (c + 0.5) / cols
      const v = rows === 1 ? 0.5 : r / (rows - 1)
      const fx = u * width
      const fy = v * (height - 1)
      const d = sampleDistWrap(dist, width, height, fx, fy)
      // Negative dist = inside ink. Map through smoothstep over bevel width.
      const t = smoothstep(-bevelPx, bevelPx, -d)
      out[r * cols + c] = t
    }
  }
  return out
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function sampleDistWrap(
  dist: Float32Array,
  width: number,
  height: number,
  fx: number,
  fy: number,
): number {
  const x = ((fx % width) + width) % width
  const y = Math.max(0, Math.min(height - 1, fy))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = (x0 + 1) % width
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0
  const a = dist[y0 * width + x0]
  const b = dist[y0 * width + x1]
  const c = dist[y1 * width + x0]
  const d = dist[y1 * width + x1]
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty
}

/**
 * Felzenszwalb & Huttenlocher EDT → signed distance in pixels.
 * Positive = outside ink, negative = inside ink.
 */
function signedDistanceTransform(
  inside: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const outside = new Uint8Array(width * height)
  for (let i = 0; i < inside.length; i++) outside[i] = inside[i] ? 0 : 1

  const distOut = edt2d(outside, width, height)
  const distIn = edt2d(inside, width, height)
  const signed = new Float32Array(width * height)
  for (let i = 0; i < signed.length; i++) {
    // outside pixels: +dist to nearest ink; inside: -dist to nearest non-ink
    signed[i] = inside[i] ? -Math.sqrt(distIn[i]) : Math.sqrt(distOut[i])
  }
  return signed
}

/** Squared Euclidean distance transform (0 = foreground seed). */
function edt2d(foreground: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e20
  const f = new Float32Array(width * height)
  for (let i = 0; i < f.length; i++) f[i] = foreground[i] ? 0 : INF

  const d = new Float32Array(width * height)
  const v = new Int32Array(Math.max(width, height))
  const z = new Float32Array(Math.max(width, height) + 1)

  // Columns
  const col = new Float32Array(height)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) col[y] = f[y * width + x]
    const out = edt1d(col, height, v, z)
    for (let y = 0; y < height; y++) d[y * width + x] = out[y]
  }

  // Rows
  const row = new Float32Array(width)
  const result = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = d[y * width + x]
    const out = edt1d(row, width, v, z)
    for (let x = 0; x < width; x++) result[y * width + x] = out[x]
  }
  return result
}

function edt1d(
  f: Float32Array,
  n: number,
  v: Int32Array,
  z: Float32Array,
): Float32Array {
  // No finite seeds → everywhere "infinitely far"
  let hasSeed = false
  for (let i = 0; i < n; i++) {
    if (f[i] < 1e19) {
      hasSeed = true
      break
    }
  }
  if (!hasSeed) {
    const d = new Float32Array(n)
    d.fill(1e20)
    return d
  }

  let k = 0
  v[0] = 0
  z[0] = -1e20
  z[1] = 1e20
  for (let q = 1; q < n; q++) {
    let s =
      (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = 1e20
  }
  const d = new Float32Array(n)
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dx = q - v[k]
    d[q] = dx * dx + f[v[k]]
  }
  return d
}
