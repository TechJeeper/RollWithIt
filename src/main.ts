import './style.css'
import {
  DEFAULT_STATE,
  QUALITY_PRESETS,
  circumferenceMm,
  gridForQuality,
  type AppState,
  type MeshQuality,
  type PresetId,
} from './types'
import { PRESET_LABELS, drawPreset, sampleHeightmap } from './pattern'
import { sampleSmoothHeightmap } from './sdf'
import { buildRollerMesh } from './mesh'
import { canvasToSvg, downloadBlob, downloadRollersStlZip } from './stl'
import { RollerPreview } from './preview'

/** Live preview stays lighter; exports use the selected quality. */
const PREVIEW_QUALITY: MeshQuality = 'normal'

function mount() {
  const state: AppState = structuredClone(DEFAULT_STATE)
  let image: HTMLImageElement | null = null
  let imageFileName = ''
  let drawing = false
  let brushMode: 'paint' | 'erase' | 'off' = 'off'
  let rebuildTimer = 0
  const previewGrid = gridForQuality(
    state.dimensions.diameter,
    state.dimensions.length,
    PREVIEW_QUALITY,
  )
  let lastMale = buildRollerMesh({
    dimensions: state.dimensions,
    heightmap: new Float32Array(previewGrid.cols * previewGrid.rows),
    cols: previewGrid.cols,
    rows: previewGrid.rows,
    role: 'male',
  })
  let lastFemale = lastMale
  let exportMale = lastMale
  let exportFemale = lastFemale

  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) throw new Error('#app missing')

  app.innerHTML = `
    <header class="hero">
      <div>
        <p class="brand-sub">TechJeeper Designs</p>
        <h1 class="brand">RollWithIt</h1>
      </div>
      <p class="tagline">
        Generate custom 3D printable embossing rollers made specifically for the snap-together
        <a href="https://makerworld.com/en/models/148536-business-card-embosser-level-up-your-cards" target="_blank" rel="noopener" style="color:var(--brass-hot);text-decoration:underline">Business Card Embosser 3D Model</a>.
        Upload custom artwork, select patterns, or hand-draw designs to download ready-to-print male &amp; female STL rollers.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary" id="btn-download" type="button">Download STL ZIP (both)</button>
        <button class="btn btn-secondary" id="btn-svg" type="button">Export pattern SVG</button>
        <a class="btn btn-ghost" href="https://makerworld.com/en/models/148536-business-card-embosser-level-up-your-cards" target="_blank" rel="noopener">Get 3D Embosser Model ↗</a>
      </div>
    </header>

    <div class="layout">
      <section class="panel">
        <div class="panel-head">
          <h2>Pattern</h2>
          <span id="unwrap-size"></span>
        </div>
        <div class="canvas-wrap">
          <canvas id="pattern-canvas" width="1200" height="480"></canvas>
        </div>
        <div class="canvas-meta">
          <span>Unwrapped circumference × roller length</span>
          <span>Black = raised on male · recessed on female</span>
          <span id="status" class="status"></span>
        </div>
        <div class="controls">
          <p class="section-label">Presets</p>
          <div class="presets" id="presets"></div>

          <div class="field" id="image-options-field" style="display:none">
            <p class="section-label" style="margin-top:0">Image Options</p>
            <div class="image-box">
              <label class="btn btn-primary" style="display:inline-flex;align-items:center;gap:.4rem;cursor:pointer">
                📁 Upload image
                <input id="image-input" type="file" accept="image/*" hidden />
              </label>
              <div id="image-badge-container"></div>
            </div>
            <p class="hint">Upload a logo or artwork. High-contrast PNG or SVG works best for crisp emboss relief.</p>
          </div>

          <div class="field" id="text-field" style="display:none">
            <label for="text-input">Repeating text</label>
            <input id="text-input" type="text" maxlength="48" value="${escapeAttr(state.pattern.text)}" />
          </div>

          <p class="section-label">Draw &amp; paint</p>
          <div class="tool-row">
            <button class="btn btn-ghost" type="button" data-brush="paint">Paint</button>
            <button class="btn btn-ghost" type="button" data-brush="erase">Erase</button>
            <button class="btn btn-ghost" type="button" id="btn-clear-drawing">Clear drawing</button>
          </div>

          <div class="grid-2">
            ${slider('scale', 'Pattern scale', state.pattern.scale, 0.4, 2.5, 0.05)}
            <div id="density-slider-container">
              ${slider('density', 'Density', state.pattern.density, 0.4, 2.5, 0.05)}
            </div>
            ${slider('rotation', 'Rotation °', state.pattern.rotation, 0, 180, 1)}
            <div id="fontsize-slider-container" style="display:none">
              ${slider('fontSize', 'Text size', state.pattern.fontSize, 6, 36, 1)}
            </div>
            ${slider('designDepth', 'Design depth mm', state.dimensions.relief, 0.2, 3.0, 0.05)}
          </div>

          <label class="check"><input type="checkbox" id="invert" ${state.pattern.invert ? 'checked' : ''}/> Invert pattern</label>
          <label class="check"><input type="checkbox" id="mirrorFemale" ${state.pattern.mirrorFemale ? 'checked' : ''}/> Mirror female (recommended)</label>
          <p class="hint">Tip: click Paint, then draw directly on the unwrapped surface.</p>
        </div>
      </section>

      <div style="display:grid;gap:1.1rem">
        <section class="panel">
          <div class="panel-head">
            <h2>3D rollers</h2>
            <span>Drag to orbit</span>
          </div>
          <div class="preview-wrap">
            <canvas id="preview-canvas"></canvas>
            <div class="legend">
              <span class="swatch male"><i></i> Male</span>
              <span class="swatch female"><i></i> Female</span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Roller specs</h2>
            <span>mm</span>
          </div>
          <div class="controls">
            <div class="grid-2">
              ${numberField('diameter', 'Diameter', state.dimensions.diameter, 20, 40, 0.1)}
              ${numberField('length', 'Length', state.dimensions.length, 40, 80, 0.1)}
              ${numberField('driveSize', 'Square drive', state.dimensions.driveSize, 8, 16, 0.1)}
              ${numberField('driveDepth', 'Drive depth', state.dimensions.driveDepth, 4, 20, 0.1)}
              ${numberField('relief', 'Design depth', state.dimensions.relief, 0.2, 3.0, 0.05)}
              ${numberField('clearance', 'Mating tolerance', state.dimensions.clearance, 0.05, 1.0, 0.05)}
              ${numberField('bevel', 'Edge soft (≥0.45)', state.dimensions.bevel, 0.15, 1.2, 0.05)}
            </div>
            <div class="field">
              <label for="quality">Mesh quality</label>
              <select id="quality">
                ${(Object.keys(QUALITY_PRESETS) as MeshQuality[])
                  .map(
                    (q) =>
                      `<option value="${q}"${state.quality === q ? ' selected' : ''}>${QUALITY_PRESETS[q].label}</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <p class="hint">Defaults match the MakerSpace embosser: Ø30 × 60 mm blank, 12.2 mm drive, 1.2 mm design depth. <em>Mating tolerance</em> controls the fit gap between male &amp; female surfaces (0.15–0.25 mm recommended for tight, crisp embossing).</p>
            <div class="tool-row">
              <button class="btn btn-primary" id="btn-rebuild" type="button">Rebuild preview</button>
              <button class="btn btn-secondary" id="btn-reset" type="button">Reset defaults</button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <footer id="main-footer" class="main-footer">
      <div class="footer-container">
        <p class="footer-brand">
          RollWithIt by
          <a href="https://techjeeper.com" target="_blank" rel="noopener noreferrer" class="footer-link-blue">TechJeeper Designs</a>
        </p>
        <div class="footer-links">
          <a href="https://github.com/TechJeeper/RollWithIt" target="_blank" rel="noopener noreferrer" class="footer-link">GitHub</a>
          <span class="footer-dot">•</span>
          <a href="https://discord.gg/BH2ebjcSjz" target="_blank" rel="noopener noreferrer" class="footer-link">Discord</a>
          <span class="footer-dot">•</span>
          <a href="https://github.com/TechJeeper/RollWithIt/issues" target="_blank" rel="noopener noreferrer" class="footer-link">Report Issue</a>
          <span class="footer-dot">•</span>
          <a href="https://techjeeper.com/support.html" target="_blank" rel="noopener noreferrer" class="btn-support">Support Projects</a>
        </div>
      </div>
    </footer>
  `

  const patternCanvas = app.querySelector<HTMLCanvasElement>('#pattern-canvas')!
  const patternCtx = patternCanvas.getContext('2d', { willReadFrequently: true })!
  const previewCanvas = app.querySelector<HTMLCanvasElement>('#preview-canvas')!
  const statusEl = app.querySelector<HTMLElement>('#status')!
  const unwrapEl = app.querySelector<HTMLElement>('#unwrap-size')!
  const presetsEl = app.querySelector<HTMLElement>('#presets')!
  const imageOptionsField = app.querySelector<HTMLElement>('#image-options-field')!
  const textField = app.querySelector<HTMLElement>('#text-field')!
  const densityContainer = app.querySelector<HTMLElement>('#density-slider-container')!
  const fontSizeContainer = app.querySelector<HTMLElement>('#fontsize-slider-container')!
  const imageBadgeContainer = app.querySelector<HTMLElement>('#image-badge-container')!
  const preview = new RollerPreview(previewCanvas)

  function updatePresetChips() {
    presetsEl.querySelectorAll('.chip').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.preset === state.preset)
    })
  }

  function updatePresetUI() {
    const isImage = state.preset === 'image'
    const isText = state.preset === 'text'
    const isPattern = !isImage && !isText

    imageOptionsField.style.display = isImage ? 'grid' : 'none'
    textField.style.display = isText ? 'grid' : 'none'

    fontSizeContainer.style.display = isText ? 'block' : 'none'
    densityContainer.style.display = isPattern ? 'block' : 'none'
  }

  function updateImageBadge() {
    if (image && imageFileName) {
      imageBadgeContainer.innerHTML = `
        <span class="image-badge">📷 ${escapeAttr(imageFileName)}</span>
        <button class="btn btn-ghost" type="button" id="btn-clear-image" style="padding:0.35rem 0.65rem;font-size:0.78rem">Remove image</button>
      `
      app.querySelector('#btn-clear-image')?.addEventListener('click', () => {
        image = null
        imageFileName = ''
        updateImageBadge()
        redrawPattern()
        scheduleRebuild()
      })
    } else {
      imageBadgeContainer.innerHTML = `<span class="hint">No image selected yet</span>`
    }
  }

  for (const [id, label] of Object.entries(PRESET_LABELS) as Array<[PresetId, string]>) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `chip${state.preset === id ? ' active' : ''}`
    btn.textContent = label
    btn.dataset.preset = id
    btn.addEventListener('click', () => {
      state.preset = id
      updatePresetChips()
      updatePresetUI()
      redrawPattern()
      scheduleRebuild()
    })
    presetsEl.append(btn)
  }

  function resizePatternCanvas() {
    const circ = circumferenceMm(state.dimensions.diameter)
    const len = state.dimensions.length
    const px = QUALITY_PRESETS[state.quality].pxPerMm
    patternCanvas.width = Math.round(circ * px)
    patternCanvas.height = Math.round(len * px)
    unwrapEl.textContent = `${circ.toFixed(1)} × ${len.toFixed(1)} mm`
  }

  function redrawPattern() {
    resizePatternCanvas()
    const px = QUALITY_PRESETS[state.quality].pxPerMm
    drawPreset(
      state.preset,
      patternCtx,
      patternCanvas.width,
      patternCanvas.height,
      state.pattern,
      image,
      px,
    )
  }

  function setStatus(msg: string, error = false) {
    statusEl.textContent = msg
    statusEl.classList.toggle('error', error)
  }

  function rebuildMeshes(forExport = false) {
    try {
      const quality = forExport ? state.quality : PREVIEW_QUALITY
      const { cols, rows } = gridForQuality(
        state.dimensions.diameter,
        state.dimensions.length,
        quality,
      )
      const circ = circumferenceMm(state.dimensions.diameter)
      const useSdf = forExport && state.dimensions.bevel >= 0.45
      const maleMap = useSdf
        ? sampleSmoothHeightmap(
            patternCanvas,
            cols,
            rows,
            circ,
            state.dimensions.length,
            state.dimensions.bevel,
            false,
          )
        : sampleHeightmap(patternCanvas, cols, rows, false)
      const femaleMap = useSdf
        ? sampleSmoothHeightmap(
            patternCanvas,
            cols,
            rows,
            circ,
            state.dimensions.length,
            state.dimensions.bevel,
            state.pattern.mirrorFemale,
          )
        : sampleHeightmap(patternCanvas, cols, rows, state.pattern.mirrorFemale)
      const male = buildRollerMesh({
        dimensions: state.dimensions,
        heightmap: maleMap,
        cols,
        rows,
        role: 'male',
      })
      const female = buildRollerMesh({
        dimensions: state.dimensions,
        heightmap: femaleMap,
        cols,
        rows,
        role: 'female',
      })
      if (forExport) {
        exportMale = male
        exportFemale = female
      } else {
        lastMale = male
        lastFemale = female
        preview.setMeshes(lastMale, lastFemale)
        let maxH = 0
        for (let i = 0; i < maleMap.length; i++) if (maleMap[i] > maxH) maxH = maleMap[i]
        setStatus(
          `Preview · ${lastMale.triangleCount.toLocaleString()} tris · relief ${(maxH * state.dimensions.relief).toFixed(2)} mm peak · export ${QUALITY_PRESETS[state.quality].label}`,
        )
      }
    } catch (err) {
      console.error(err)
      setStatus('Mesh rebuild failed', true)
    }
  }

  function scheduleRebuild() {
    window.clearTimeout(rebuildTimer)
    rebuildTimer = window.setTimeout(rebuildMeshes, 180)
  }

  // Sliders
  bindSlider('scale', (v) => {
    state.pattern.scale = v
  })
  bindSlider('density', (v) => {
    state.pattern.density = v
  })
  bindSlider('rotation', (v) => {
    state.pattern.rotation = v
  })
  bindSlider('fontSize', (v) => {
    state.pattern.fontSize = v
  })
  bindSlider('designDepth', (v) => {
    state.dimensions.relief = v
    const reliefNumInput = app.querySelector<HTMLInputElement>('#relief')
    if (reliefNumInput) reliefNumInput.value = String(v)
  })

  function bindSlider(id: string, apply: (v: number) => void) {
    const root = app!
    const input = root.querySelector<HTMLInputElement>(`#${id}`)!
    const value = root.querySelector<HTMLElement>(`[data-value="${id}"]`)!
    const sync = () => {
      const v = Number(input.value)
      value.textContent = Number.isInteger(v) || id === 'rotation' ? String(v) : v.toFixed(2)
      apply(v)
      redrawPattern()
      scheduleRebuild()
    }
    input.addEventListener('input', sync)
  }

  // Dimension fields
  for (const key of [
    'diameter',
    'length',
    'driveSize',
    'driveDepth',
    'relief',
    'clearance',
    'bevel',
  ] as const) {
    const input = app.querySelector<HTMLInputElement>(`#${key}`)!
    input.addEventListener('change', () => {
      state.dimensions[key] = Number(input.value)
      if (key === 'relief') {
        const depthSlider = app.querySelector<HTMLInputElement>('#designDepth')
        const depthVal = app.querySelector<HTMLElement>('[data-value="designDepth"]')
        if (depthSlider) depthSlider.value = input.value
        if (depthVal) depthVal.textContent = Number(input.value).toFixed(2)
      }
      redrawPattern()
      scheduleRebuild()
    })
  }

  app.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change', (e) => {
    state.quality = (e.target as HTMLSelectElement).value as MeshQuality
    redrawPattern()
    scheduleRebuild()
  })

  app.querySelector<HTMLInputElement>('#text-input')!.addEventListener('input', (e) => {
    state.pattern.text = (e.target as HTMLInputElement).value
    if (state.preset === 'text') {
      redrawPattern()
      scheduleRebuild()
    }
  })

  app.querySelector<HTMLInputElement>('#invert')!.addEventListener('change', (e) => {
    state.pattern.invert = (e.target as HTMLInputElement).checked
    redrawPattern()
    scheduleRebuild()
  })

  app.querySelector<HTMLInputElement>('#mirrorFemale')!.addEventListener('change', (e) => {
    state.pattern.mirrorFemale = (e.target as HTMLInputElement).checked
    scheduleRebuild()
  })

  app.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.brush as 'paint' | 'erase'
      brushMode = brushMode === mode ? 'off' : mode
      app.querySelectorAll('[data-brush]').forEach((el) => {
        el.classList.toggle(
          'btn-primary',
          brushMode !== 'off' && (el as HTMLElement).dataset.brush === brushMode,
        )
        el.classList.toggle(
          'btn-ghost',
          !(brushMode !== 'off' && (el as HTMLElement).dataset.brush === brushMode),
        )
      })
      setStatus(brushMode === 'off' ? '' : `${brushMode === 'paint' ? 'Painting' : 'Erasing'}…`)
    })
  })

  function paintAt(ev: PointerEvent) {
    if (brushMode === 'off') return
    const rect = patternCanvas.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width) * patternCanvas.width
    const y = ((ev.clientY - rect.top) / rect.height) * patternCanvas.height
    const px = QUALITY_PRESETS[state.quality].pxPerMm
    const r = Math.max(2, 0.7 * state.pattern.scale * px)
    patternCtx.fillStyle = brushMode === 'paint' ? '#000' : '#fff'
    patternCtx.beginPath()
    patternCtx.arc(x, y, r, 0, Math.PI * 2)
    patternCtx.fill()
  }

  patternCanvas.addEventListener('pointerdown', (ev) => {
    if (brushMode === 'off') return
    drawing = true
    patternCanvas.setPointerCapture(ev.pointerId)
    paintAt(ev)
  })
  patternCanvas.addEventListener('pointermove', (ev) => {
    if (!drawing) return
    paintAt(ev)
  })
  patternCanvas.addEventListener('pointerup', () => {
    if (!drawing) return
    drawing = false
    scheduleRebuild()
  })

  app.querySelector<HTMLInputElement>('#image-input')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    imageFileName = file.name.replace(/\.[^/.]+$/, '')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      image = img
      state.preset = 'image'
      updatePresetChips()
      updatePresetUI()
      updateImageBadge()
      redrawPattern()
      scheduleRebuild()
      URL.revokeObjectURL(url)
      setStatus(`Loaded ${file.name}`)
    }
    img.onerror = () => setStatus('Could not load image', true)
    img.src = url
  })

  app.querySelector('#btn-clear-drawing')!.addEventListener('click', () => {
    redrawPattern()
    scheduleRebuild()
  })

  app.querySelector('#btn-rebuild')!.addEventListener('click', () => {
    rebuildMeshes()
  })

  app.querySelector('#btn-reset')!.addEventListener('click', () => {
    Object.assign(state, structuredClone(DEFAULT_STATE))
    image = null
    imageFileName = ''
    brushMode = 'off'
    location.reload()
  })

  app.querySelector('#btn-download')!.addEventListener('click', () => {
    const btn = app.querySelector<HTMLButtonElement>('#btn-download')!
    btn.disabled = true
    setStatus('Building STL ZIP…')
    window.setTimeout(async () => {
      try {
        rebuildMeshes(true)
        await downloadRollersStlZip(
          exportMale,
          exportFemale,
          state.preset,
          state.dimensions.diameter,
          imageFileName,
        )
        setStatus(
          `Downloaded STL ZIP · ${exportMale.triangleCount.toLocaleString()} tris/roller`,
        )
      } catch (err) {
        console.error(err)
        setStatus('STL export failed', true)
      } finally {
        btn.disabled = false
      }
    }, 30)
  })

  app.querySelector('#btn-svg')!.addEventListener('click', () => {
    const circ = circumferenceMm(state.dimensions.diameter)
    const svg = canvasToSvg(patternCanvas, circ, state.dimensions.length)
    const tag = state.preset === 'image' && imageFileName ? imageFileName : state.preset
    downloadBlob(`rollwithit-pattern-${tag}.svg`, svg, 'image/svg+xml')
    setStatus('Pattern SVG exported')
  })

  window.addEventListener('resize', () => preview.resize())

  updatePresetUI()
  updateImageBadge()
  redrawPattern()
  rebuildMeshes()
}

function slider(id: string, label: string, value: number, min: number, max: number, step: number) {
  return `<div class="field row">
    <label for="${id}">${label}</label>
    <span class="value" data-value="${id}">${formatNum(value)}</span>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" style="grid-column:1/-1" />
  </div>`
}

function numberField(
  id: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
) {
  return `<div class="field">
    <label for="${id}">${label}</label>
    <input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
  </div>`
}

function formatNum(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

mount()
