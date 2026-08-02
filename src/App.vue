<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CircleHelp, Copy, Download, Eraser, ImagePlus, Languages, PaintBucket, Pencil, Redo2, RotateCcw, Trash2, TriangleAlert, Undo2,
} from 'lucide-vue-next'
import { useEditorStore } from '@/stores/editor'
import { setLocale } from '@/i18n'
import { useI18n } from 'vue-i18n'

const editor = useEditorStore()
const { t, locale } = useI18n()
const fileInput = ref<HTMLInputElement>()
const isDrawing = ref(false)
const copied = ref(false)
const expandFunctions = ref(false)
const draftWidth = ref(editor.width)
const draftHeight = ref(editor.height)
const totalPixels = computed(() => editor.width * editor.height)
const shouldWarnForLargeExport = computed(() => totalPixels.value >= 1225)

watch(() => [editor.width, editor.height], ([width, height]) => {
  draftWidth.value = width
  draftHeight.value = height
})

const palette = [
  '1a1c2c', '5d275d', 'b13e53', 'ef7d57', 'ffcd75', 'a7f070', '38b764', '257179',
  '29366f', '3b5dc9', '41a6f6', '73eff7', 'f4f4f4', '94b0c2', '566c86', '333c57',
]

const lineCorrectionBySize: Record<number, number> = {
  4: -8,
  5: -7,
  6: -6,
  7: -5,
  8: -4,
  9: -4,
  10: -4,
  11: -4,
  12: -4,
  13: -3,
  14: -3,
  15: -3,
  16: -3,
  17: -3,
  18: -3.5,
}

function getLineCorrection(size: number) {
  return lineCorrectionBySize[size] ?? -3
}

const autoLineCorrection = ref(true)
const customLineCorrection = ref(-4)
const lineCorrection = computed<number>({
  get: () => autoLineCorrection.value
    ? getLineCorrection(editor.cellSize)
    : customLineCorrection.value,
  set: (value) => {
    if (Number.isFinite(value)) customLineCorrection.value = Math.min(0, Math.max(-20, value))
  },
})

const latexCode = computed(() => {
  const size = editor.cellSize
  const pixel = (color: string) => expandFunctions.value
    ? `\\color{${color}}{\\rule{${size}pt}{${size}pt}}`
    : `\\px{${color}}`
  const rows = editor.grid.map((row) => row.map(pixel).join(' ') + ` \\\\[${lineCorrection.value}pt]`)
  const macro = expandFunctions.value
    ? ''
    : `\\newcommand{\\px}[1]{\\color{#1}{\\rule{${size}pt}{${size}pt}}}\n`
  return `$$\n${macro}${rows.join('\n')}\n$$`
})

const cells = computed(() => editor.grid.flatMap((row, rowIndex) =>
  row.map((color, columnIndex) => ({ row: rowIndex, column: columnIndex, color })),
))

function paint(row: number, column: number, record: boolean) {
  const color = editor.currentTool === 'eraser' ? 'ffffff' : editor.currentColor
  if (editor.currentTool === 'bucket') {
    editor.fillArea(row, column, color)
    return
  }
  editor.setPixel(row, column, color, record)
}

function beginPaint(row: number, column: number) {
  isDrawing.value = true
  paint(row, column, true)
}

function dragPaint(row: number, column: number) {
  if (isDrawing.value && editor.currentTool !== 'bucket') paint(row, column, false)
}

function stopPaint() {
  isDrawing.value = false
}

function handleKeyboardShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
  if (!event.metaKey && !event.ctrlKey) return

  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
    return
  }

  if (key === 'y' && event.ctrlKey) {
    event.preventDefault()
    editor.redo()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyboardShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyboardShortcut))

function toggleLocale() {
  setLocale(locale.value === 'zh-CN' ? 'en' : 'zh-CN')
}

function toggleLineCorrectionMode() {
  if (autoLineCorrection.value) customLineCorrection.value = getLineCorrection(editor.cellSize)
  autoLineCorrection.value = !autoLineCorrection.value
}

function normalizeCustomLineCorrection() {
  const value = Number(customLineCorrection.value)
  customLineCorrection.value = Number.isFinite(value)
    ? Math.min(0, Math.max(-20, value))
    : getLineCorrection(editor.cellSize)
}

async function copyLatex() {
  await navigator.clipboard.writeText(latexCode.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1600)
}

function downloadLatex() {
  const blob = new Blob([latexCode.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'rulepixel.tex'
  anchor.click()
  URL.revokeObjectURL(url)
}

function updateDimensions() {
  editor.resizeCanvas(draftWidth.value, draftHeight.value)
  draftWidth.value = editor.width
  draftHeight.value = editor.height
}

function openImporter() {
  fileInput.value?.click()
}

async function importImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = editor.width
  canvas.height = editor.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  context.imageSmoothingEnabled = false
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  const nextGrid = Array.from({ length: canvas.height }, (_, row) =>
    Array.from({ length: canvas.width }, (_, column) => {
      const offset = (row * canvas.width + column) * 4
      const alpha = data[offset + 3] / 255
      const channel = (index: number) => Math.round(data[offset + index] * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0')
      return `${channel(0)}${channel(1)}${channel(2)}`
    }),
  )
  editor.replaceGrid(nextGrid)
  ;(event.target as HTMLInputElement).value = ''
}
</script>

<template>
  <main class="app-shell" @pointerup="stopPaint" @pointerleave="stopPaint">
    <header class="topbar">
      <div class="brand" aria-label="RulePixel">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>RulePixel</span>
      </div>

      <div class="toolbar" aria-label="Drawing tools">
        <button class="icon-button" :class="{ active: editor.currentTool === 'pen' }" :title="t('tools.pen')" @click="editor.currentTool = 'pen'"><Pencil :size="18" /></button>
        <button class="icon-button" :class="{ active: editor.currentTool === 'eraser' }" :title="t('tools.eraser')" @click="editor.currentTool = 'eraser'"><Eraser :size="18" /></button>
        <button class="icon-button" :class="{ active: editor.currentTool === 'bucket' }" :title="t('tools.bucket')" @click="editor.currentTool = 'bucket'"><PaintBucket :size="18" /></button>
        <span class="tool-divider"></span>
        <button class="icon-button" :disabled="!editor.undoStack.length" :title="t('tools.undo')" @click="editor.undo"><Undo2 :size="18" /></button>
        <button class="icon-button" :disabled="!editor.redoStack.length" :title="t('tools.redo')" @click="editor.redo"><Redo2 :size="18" /></button>
        <button class="icon-button" :title="t('tools.clear')" @click="editor.clearAll"><Trash2 :size="18" /></button>
      </div>

      <div class="header-actions">
        <button class="action-button muted language-button" :title="t('language.switchTo')" @click="toggleLocale"><Languages :size="17" /><span>{{ locale === 'zh-CN' ? t('language.english') : t('language.chinese') }}</span></button>
        <button class="action-button muted" :title="t('actions.import')" @click="openImporter"><ImagePlus :size="17" /><span>{{ t('actions.import') }}</span></button>
        <button class="action-button muted" :title="t('actions.copyLatex')" @click="copyLatex"><Copy :size="17" /><span>{{ copied ? t('actions.copied') : t('actions.copy') }}</span></button>
        <button class="action-button primary" :title="t('actions.download')" @click="downloadLatex"><Download :size="17" /><span>{{ t('actions.export') }}</span></button>
        <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="importImage" />
      </div>
    </header>

    <section class="workspace">
      <div class="editor-area">
        <div class="section-heading"><span>{{ t('canvas.title') }}</span><span class="dimension-label">{{ editor.width }} x {{ editor.height }}</span></div>
        <div class="canvas-scroll">
          <div class="pixel-grid" :style="{ gridTemplateColumns: `repeat(${editor.width}, 1fr)`, '--cell-size': `${Math.max(16, Math.min(29, editor.cellSize * 3))}px` }">
            <button
              v-for="cell in cells"
              :key="`${cell.row}-${cell.column}`"
              class="pixel-cell"
              :style="{ backgroundColor: `#${cell.color}` }"
              :aria-label="t('canvas.pixel', { row: cell.row + 1, column: cell.column + 1 })"
              @pointerdown.prevent="beginPaint(cell.row, cell.column)"
              @pointerenter="dragPaint(cell.row, cell.column)"
            ></button>
          </div>
        </div>
        <div class="canvas-footer"><span>{{ t('canvas.instruction') }}</span><button class="text-button" @click="editor.resetCanvas(); draftWidth = editor.width; draftHeight = editor.height"><RotateCcw :size="14" /> {{ t('actions.reset') }}</button></div>
      </div>

      <aside class="inspector">
        <section class="panel color-panel">
          <div class="section-heading"><span>{{ t('color.title') }}</span><span class="color-value">#{{ editor.currentColor }}</span></div>
          <div class="color-control"><input v-model="editor.currentColor" type="color" :aria-label="t('color.custom')" /><div class="current-color" :style="{ backgroundColor: `#${editor.currentColor}` }"></div></div>
          <div class="swatches">
            <button v-for="color in palette" :key="color" class="swatch" :class="{ selected: editor.currentColor === color }" :style="{ backgroundColor: `#${color}` }" :title="`#${color}`" @click="editor.currentColor = color"></button>
          </div>
        </section>

        <section class="panel settings-panel">
          <div class="section-heading"><span>{{ t('settings.title') }}</span></div>
          <label>{{ t('settings.width') }} <input v-model.number="draftWidth" type="number" min="4" max="40" @change="updateDimensions" /></label>
          <label>{{ t('settings.height') }} <input v-model.number="draftHeight" type="number" min="4" max="40" @change="updateDimensions" /></label>
          <label>{{ t('settings.ruleSize') }} <span class="input-unit"><input v-model.number="editor.cellSize" type="number" min="4" max="18" />pt</span></label>
          <label class="line-correction-control">
            <span>{{ t('settings.lineCorrection') }}</span>
            <span class="line-correction-input">
              <input v-model.number="lineCorrection" type="number" min="-20" max="0" step="0.5" :disabled="autoLineCorrection" @change="normalizeCustomLineCorrection" />pt
            </span>
            <button class="mode-toggle" type="button" :class="{ active: autoLineCorrection }" @click="toggleLineCorrectionMode">{{ autoLineCorrection ? t('settings.auto') : t('settings.custom') }}</button>
          </label>
          <div v-if="shouldWarnForLargeExport" class="large-canvas-warning" role="alert">
            <TriangleAlert :size="16" aria-hidden="true" />
            <span>{{ t('settings.largeCanvasWarning', { count: totalPixels.toLocaleString() }) }}</span>
          </div>
        </section>

        <section class="panel preview-panel">
          <div class="section-heading"><span>{{ t('preview.title') }}</span><span class="preview-badge">{{ t('preview.ready') }}</span></div>
          <div class="preview-scroll"><div class="preview-grid" :style="{ gridTemplateColumns: `repeat(${editor.width}, ${editor.cellSize}px)`, gridAutoRows: `${editor.cellSize}px` }"><span v-for="cell in cells" :key="`preview-${cell.row}-${cell.column}`" :style="{ backgroundColor: `#${cell.color}`, width: `${editor.cellSize}px`, height: `${editor.cellSize}px` }"></span></div></div>
        </section>
      </aside>
    </section>

    <section class="code-section">
      <div class="code-heading">
        <span>{{ t('output.title') }}</span>
        <div class="code-actions">
          <div class="expand-control">
            <button class="expand-help" type="button" :aria-label="t('output.expandHint')">
              <CircleHelp :size="14" />
              <span class="expand-tooltip" role="tooltip">{{ t('output.expandHint') }}</span>
            </button>
            <label class="expand-toggle">
            <span>{{ t('output.expandFunction') }}</span>
            <input v-model="expandFunctions" type="checkbox" />
            <span class="switch" aria-hidden="true"></span>
            </label>
          </div>
          <button class="text-button" @click="copyLatex"><Copy :size="14" /> {{ copied ? t('actions.copiedToClipboard') : t('actions.copyCode') }}</button>
        </div>
      </div>
      <pre><code>{{ latexCode }}</code></pre>
    </section>
  </main>
</template>
