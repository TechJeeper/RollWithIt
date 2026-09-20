import type { PatternSettings, PresetId } from './types'

export interface PatternDrawContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  /** Pixels per millimeter — all preset geometry is authored in mm. */
  pxPerMm: number
  settings: PatternSettings
  image: HTMLImageElement | null
}

function clearPaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
}

function ink(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#000000'
  ctx.strokeStyle = '#000000'
}

function mm(p: PatternDrawContext, value: number) {
  return value * p.pxPerMm
}

function drawPolkadot(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const step = mm(p, (3.5 / settings.density) * settings.scale)
  const r = Math.max(mm(p, 0.45), step * 0.28)
  for (let y = step / 2; y < height; y += step) {
    const offset = Math.floor(y / step) % 2 === 0 ? 0 : step / 2
    for (let x = offset; x < width; x += step) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawZigzag(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const amp = mm(p, 1.8 * settings.scale)
  const period = mm(p, (4.5 / settings.density) * settings.scale)
  const rowGap = mm(p, (4 / settings.density) * settings.scale)
  ctx.lineWidth = Math.max(mm(p, 0.45), mm(p, 0.6 * settings.scale))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (let y = rowGap / 2; y < height; y += rowGap) {
    ctx.beginPath()
    for (let x = 0; x <= width; x += Math.max(1, mm(p, 0.25))) {
      const yy = y + Math.sin((x / period) * Math.PI * 2) * amp
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
}

function drawConfetti(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const areaMm2 = (width / p.pxPerMm) * (height / p.pxPerMm)
  const count = Math.round(areaMm2 * 0.035 * settings.density * settings.scale)
  const rng = mulberry32(42)
  for (let i = 0; i < count; i++) {
    const x = rng() * width
    const y = rng() * height
    const w = mm(p, (0.6 + rng() * 1.4) * settings.scale)
    const h = mm(p, (0.3 + rng() * 0.7) * settings.scale)
    const rot = rng() * Math.PI
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

function drawWaves(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const period = mm(p, (7 / settings.density) * settings.scale)
  const amp = mm(p, 1.3 * settings.scale)
  const gap = Math.max(mm(p, 1.2), mm(p, (2.5 / settings.density) * settings.scale))
  ctx.lineWidth = Math.max(mm(p, 0.4), mm(p, 0.55 * settings.scale))
  ctx.lineCap = 'round'
  for (let y = gap; y < height; y += gap) {
    ctx.beginPath()
    for (let x = 0; x <= width; x += Math.max(1, mm(p, 0.25))) {
      const yy = y + Math.sin((x / period) * Math.PI * 2 + y * 0.01) * amp
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
}

function drawDiamonds(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const step = mm(p, (4 / settings.density) * settings.scale)
  const s = step * 0.38
  for (let y = 0; y < height + step; y += step) {
    for (let x = 0; x < width + step; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.lineTo(x + s, y)
      ctx.lineTo(x, y + s)
      ctx.lineTo(x - s, y)
      ctx.closePath()
      ctx.fill()
    }
  }
}

function drawChevrons(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const step = mm(p, (3 / settings.density) * settings.scale)
  ctx.lineWidth = Math.max(mm(p, 0.4), mm(p, 0.55 * settings.scale))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let y = step; y < height; y += step) {
    for (let x = 0; x < width; x += step * 2) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + step * 0.7, y - step * 0.45)
      ctx.lineTo(x + step * 1.4, y)
      ctx.stroke()
    }
  }
}

function drawHearts(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const stepX = mm(p, (4.5 / settings.density) * settings.scale)
  const stepY = mm(p, (4 / settings.density) * settings.scale)
  const size = mm(p, 1.4 * settings.scale)
  for (let row = 0, y = stepY / 2; y < height; y += stepY, row++) {
    const ox = row % 2 === 0 ? 0 : stepX / 2
    for (let x = ox; x < width; x += stepX) {
      heart(ctx, x, y, size)
    }
  }
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.35)
  ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s * 1.05, x, y + s * 1.3)
  ctx.bezierCurveTo(x, y + s * 1.05, x + s, y + s * 0.7, x + s, y + s * 0.35)
  ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3)
  ctx.fill()
}

function drawText(p: PatternDrawContext) {
  const { ctx, width, height, settings } = p
  clearPaper(ctx, width, height)
  ink(ctx)
  const text = settings.text.trim() || 'YOUR MARK'
  // fontSize control is treated as mm height
  const size = mm(p, Math.max(2, settings.fontSize * 0.35 * settings.scale))
  ctx.font = `700 ${size}px Fraunces, Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(text)
  const gapX = Math.max(metrics.width + mm(p, 2.5), mm(p, 10))
  const gapY = size * 1.7
  for (let y = gapY / 2; y < height; y += gapY) {
    for (let x = gapX / 2; x < width; x += gapX) {
      ctx.fillText(text, x, y)
    }
  }
}

function drawImagePreset(p: PatternDrawContext) {
  clearPaper(p.ctx, p.width, p.height)
}

function drawImageOverlay(p: PatternDrawContext) {
  if (!p.image) return
  const { ctx, width, height, settings } = p
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.globalAlpha = settings.imageOpacity
  const targetW = width * settings.scale
  const aspect = p.image.height / Math.max(1, p.image.width)
  const iw = targetW
  const ih = targetW * aspect
  for (let y = 0; y < height; y += ih) {
    for (let x = 0; x < width; x += iw) {
      ctx.drawImage(p.image, x, y, iw, ih)
    }
  }
  ctx.restore()

  // Soften upscaled pixel blocks, then re-threshold so emboss edges follow
  // the design instead of source-image texels.
  const copy = document.createElement('canvas')
  copy.width = width
  copy.height = height
  copy.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
  ctx.save()
  ctx.filter = `blur(${Math.max(0.6, p.pxPerMm * 0.08)}px)`
  ctx.drawImage(copy, 0, 0)
  ctx.restore()

  const img = ctx.getImageData(0, 0, width, height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
    const v = lum < 0.5 ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

const PRESET_DRAWERS: Record<PresetId, (p: PatternDrawContext) => void> = {
  polkadot: drawPolkadot,
  zigzag: drawZigzag,
  confetti: drawConfetti,
  waves: drawWaves,
  diamonds: drawDiamonds,
  chevrons: drawChevrons,
  hearts: drawHearts,
  text: drawText,
  image: drawImagePreset,
}

export function drawPreset(
  preset: PresetId,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: PatternSettings,
  image: HTMLImageElement | null,
  pxPerMm: number,
) {
  const payload: PatternDrawContext = { ctx, width, height, pxPerMm, settings, image }
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.translate(width / 2, height / 2)
  ctx.rotate((settings.rotation * Math.PI) / 180)
  ctx.translate(-width / 2, -height / 2)

  if (image && preset === 'image') {
    clearPaper(ctx, width, height)
    drawImageOverlay(payload)
  } else {
    PRESET_DRAWERS[preset](payload)
    if (image && preset === 'image') drawImageOverlay(payload)
  }
  ctx.restore()

  if (settings.invert) {
    const img = ctx.getImageData(0, 0, width, height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]
      d[i + 1] = 255 - d[i + 1]
      d[i + 2] = 255 - d[i + 2]
    }
    ctx.putImageData(img, 0, 0)
  }
}

/** Fast luminance heightmap for live preview. */
export function sampleHeightmap(
  canvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  mirror = false,
): Float32Array {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return new Float32Array(cols * rows)
  const { width, height } = canvas
  const src = ctx.getImageData(0, 0, width, height).data
  const out = new Float32Array(cols * rows)

  const lumAt = (x: number, y: number) => {
    const xi = Math.max(0, Math.min(width - 1, x))
    const yi = Math.max(0, Math.min(height - 1, y))
    const i = (yi * width + xi) * 4
    return (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255
  }

  const sampleLum = (fx: number, fy: number) => {
    const x = ((fx % width) + width) % width
    const y = Math.max(0, Math.min(height - 1, fy))
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const x1 = (x0 + 1) % width
    const y1 = Math.min(height - 1, y0 + 1)
    const tx = x - x0
    const ty = y - y0
    const a = lumAt(x0, y0)
    const b = lumAt(x1, y0)
    const c = lumAt(x0, y1)
    const d = lumAt(x1, y1)
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = mirror ? 1 - (c + 0.5) / cols : (c + 0.5) / cols
      const v = rows === 1 ? 0.5 : r / (rows - 1)
      out[r * cols + c] = 1 - sampleLum(u * width, v * (height - 1))
    }
  }
  return out
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const PRESET_LABELS: Record<PresetId, string> = {
  polkadot: 'Polkadot',
  zigzag: 'ZigZag',
  confetti: 'Confetti',
  waves: 'Waves',
  diamonds: 'Diamonds',
  chevrons: 'Chevrons',
  hearts: 'Hearts',
  text: 'Text',
  image: 'Image',
}
