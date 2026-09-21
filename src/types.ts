/** Defaults match compatible remakes of MakerSpace "Business Card Embosser". */
export interface RollerDimensions {
  diameter: number
  length: number
  driveSize: number
  driveDepth: number
  relief: number
  clearance: number
  edgeFillet: number
  /** Edge ramp width in mm — larger = smoother curves, softer emboss. */
  bevel: number
}

export interface PatternSettings {
  scale: number
  density: number
  rotation: number
  invert: boolean
  mirrorFemale: boolean
  text: string
  fontSize: number
  imageOpacity: number
  referenceMark: boolean
}

export type PresetId =
  | 'polkadot'
  | 'zigzag'
  | 'confetti'
  | 'waves'
  | 'diamonds'
  | 'chevrons'
  | 'hearts'
  | 'text'
  | 'image'

export type MeshQuality = 'draft' | 'normal' | 'high' | 'ultra'

export interface AppState {
  dimensions: RollerDimensions
  pattern: PatternSettings
  preset: PresetId
  quality: MeshQuality
}

/** Mesh spacing (mm/sample) and pattern canvas density. */
export const QUALITY_PRESETS: Record<
  MeshQuality,
  { spacingMm: number; pxPerMm: number; label: string }
> = {
  draft: { spacingMm: 0.22, pxPerMm: 10, label: 'Draft (fast)' },
  normal: { spacingMm: 0.12, pxPerMm: 14, label: 'Normal' },
  high: { spacingMm: 0.07, pxPerMm: 20, label: 'High (recommended)' },
  ultra: { spacingMm: 0.045, pxPerMm: 28, label: 'Ultra (slow)' },
}

export const DEFAULT_STATE: AppState = {
  dimensions: {
    diameter: 30,
    length: 60,
    driveSize: 12.2,
    driveDepth: 10,
    relief: 1.2,
    clearance: 0.5,
    edgeFillet: 1,
    bevel: 0.35,
  },
  pattern: {
    scale: 1,
    density: 1,
    rotation: 0,
    invert: false,
    mirrorFemale: true,
    text: 'YOUR MARK',
    fontSize: 14,
    imageOpacity: 1,
    referenceMark: true,
  },
  preset: 'polkadot',
  quality: 'high',
}

export function circumferenceMm(diameter: number): number {
  return Math.PI * diameter
}

export function gridForQuality(
  diameter: number,
  length: number,
  quality: MeshQuality,
): { cols: number; rows: number } {
  const spacing = QUALITY_PRESETS[quality].spacingMm
  const circ = circumferenceMm(diameter)
  return {
    cols: Math.max(96, Math.ceil(circ / spacing)),
    rows: Math.max(48, Math.ceil(length / spacing)),
  }
}
