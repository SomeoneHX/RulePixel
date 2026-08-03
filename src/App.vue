<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Bot, CircleHelp, ClipboardPaste, Copy, Download, Eraser, FileText, ImagePlus, Languages, PaintBucket, Pencil, Redo2, RotateCcw, Trash2, TriangleAlert, Undo2, Upload, X,
} from 'lucide-vue-next'
import { useEditorStore } from '@/stores/editor'
import { setLocale } from '@/i18n'
import { useI18n } from 'vue-i18n'
import { parseLatexToCanvas, type ParsedLatex } from '@/utils/latex'

const editor = useEditorStore()
const { t, locale } = useI18n()
const fileInput = ref<HTMLInputElement>()
const isDrawing = ref(false)
const copied = ref(false)
const expandFunctions = ref(false)
const isTextImportOpen = ref(false)
const isImageImportOpen = ref(false)
const isImageDragging = ref(false)
const imageImportError = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const imageImportSize = ref<{ width: number; height: number } | null>(null)
const imageImportGrid = ref<string[][] | null>(null)
const autoResizeImageCanvas = ref(true)
const latexInput = ref('')
const draftWidth = ref(editor.width)
const draftHeight = ref(editor.height)
const totalPixels = computed(() => editor.width * editor.height)
const shouldWarnForLargeExport = computed(() => totalPixels.value >= 1225)
const parsedLatex = computed(() => parseLatexToCanvas(latexInput.value))

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

function setCustomColor(event: Event) {
  const color = (event.target as HTMLInputElement).value
  if (/^#[0-9a-f]{6}$/i.test(color)) editor.currentColor = color.slice(1).toLowerCase()
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

function handleWindowPaste(event: ClipboardEvent) {
  if (isImageImportOpen.value) handleImagePaste(event)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyboardShortcut)
  window.addEventListener('paste', handleWindowPaste)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyboardShortcut)
  window.removeEventListener('paste', handleWindowPaste)
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
})

function toggleLocale() {
  setLocale(locale.value === 'zh-CN' ? 'en' : 'zh-CN')
}

function openTextImporter() {
  latexInput.value = ''
  isTextImportOpen.value = true
}

function openAiGuide() {
  window.open('https://www.luogu.com.cn/article/kh6ygljj', '_blank', 'noopener,noreferrer')
}

function closeTextImporter() {
  isTextImportOpen.value = false
}

function applyParsedCanvas(parsed: ParsedLatex) {
  editor.replaceGrid(parsed.grid, parsed.width, parsed.height)
  editor.cellSize = parsed.cellSize
  if (parsed.lineCorrection === getLineCorrection(parsed.cellSize)) {
    autoLineCorrection.value = true
  } else {
    autoLineCorrection.value = false
    customLineCorrection.value = parsed.lineCorrection
  }
  closeTextImporter()
}

function importTextCanvas() {
  if (parsedLatex.value.ok) applyParsedCanvas(parsedLatex.value.value)
}

function openImageImporter() {
  imageImportError.value = ''
  imageFile.value = null
  imageImportSize.value = null
  imageImportGrid.value = null
  autoResizeImageCanvas.value = true
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = ''
  isImageImportOpen.value = true
}

function closeImageImporter() {
  isImageImportOpen.value = false
  isImageDragging.value = false
  imageFile.value = null
  imageImportSize.value = null
  imageImportGrid.value = null
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = ''
  if (fileInput.value) fileInput.value.value = ''
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

function chooseImageFile() {
  fileInput.value?.click()
}

async function prepareImage(file: File) {
  if (!file.type.startsWith('image/')) {
    imageImportError.value = t('imageImport.invalidType')
    return
  }

  imageImportError.value = ''
  imageFile.value = file
  imageImportSize.value = null
  imageImportGrid.value = null
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = URL.createObjectURL(file)

  try {
    const bitmap = await createImageBitmap(file)
    const width = autoResizeImageCanvas.value ? Math.max(4, Math.min(40, bitmap.width)) : editor.width
    const height = autoResizeImageCanvas.value ? Math.max(4, Math.min(40, bitmap.height)) : editor.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas context unavailable')
    context.imageSmoothingEnabled = false
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    const data = context.getImageData(0, 0, width, height).data
    imageImportGrid.value = Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, column) => {
        const offset = (row * width + column) * 4
        const alpha = data[offset + 3] / 255
        const channel = (index: number) => Math.round(data[offset + index] * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0')
        return `${channel(0)}${channel(1)}${channel(2)}`
      }),
    )
    imageImportSize.value = { width, height }
    bitmap.close()
  } catch {
    imageImportError.value = t('imageImport.invalidImage')
    imageFile.value = null
  }
}

function toggleImageCanvasResize() {
  autoResizeImageCanvas.value = !autoResizeImageCanvas.value
  if (imageFile.value) void prepareImage(imageFile.value)
}

function importImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void prepareImage(file)
}

function handleImageDrop(event: DragEvent) {
  isImageDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void prepareImage(file)
}

function handleImagePaste(event: ClipboardEvent) {
  const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'))
  if (file) {
    event.preventDefault()
    void prepareImage(file)
  }
}

function importPreparedImage() {
  if (!imageImportGrid.value || !imageImportSize.value) return
  if (autoResizeImageCanvas.value) {
    editor.replaceGrid(imageImportGrid.value, imageImportSize.value.width, imageImportSize.value.height)
  } else {
    editor.replaceGrid(imageImportGrid.value)
  }
  closeImageImporter()
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
        <button class="action-button muted" :title="t('actions.ai')" @click="openAiGuide"><Bot :size="17" /><span>{{ t('actions.ai') }}</span></button>
        <button class="action-button muted" :title="t('actions.importText')" @click="openTextImporter"><FileText :size="17" /><span>{{ t('actions.importText') }}</span></button>
         <button class="action-button muted" :title="t('actions.import')" @click="openImageImporter"><ImagePlus :size="17" /><span>{{ t('actions.import') }}</span></button>
        <button class="action-button muted" :title="t('actions.copyLatex')" @click="copyLatex"><Copy :size="17" /><span>{{ copied ? t('actions.copied') : t('actions.copy') }}</span></button>
        <button class="action-button primary" :title="t('actions.download')" @click="downloadLatex"><Download :size="17" /><span>{{ t('actions.export') }}</span></button>
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
          <div class="color-control"><input :value="`#${editor.currentColor}`" type="color" :aria-label="t('color.custom')" @input="setCustomColor" /><div class="current-color" :style="{ backgroundColor: `#${editor.currentColor}` }"></div></div>
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

     <div v-if="isTextImportOpen" class="modal-backdrop" @click.self="closeTextImporter">
      <section class="text-import-modal" role="dialog" aria-modal="true" :aria-label="t('textImport.title')">
        <div class="modal-heading">
          <div><span class="modal-eyebrow"><FileText :size="14" /> TeX</span><h2>{{ t('textImport.title') }}</h2></div>
          <button class="modal-close" type="button" :title="t('textImport.close')" @click="closeTextImporter"><X :size="18" /></button>
        </div>
        <p class="modal-instruction">{{ t('textImport.instruction') }}</p>
        <textarea v-model="latexInput" class="latex-input" :placeholder="t('textImport.placeholder')" spellcheck="false"></textarea>
        <div class="parse-status" :class="parsedLatex.ok ? 'valid' : 'invalid'" role="status">
          <template v-if="parsedLatex.ok">
            <span class="status-dot"></span>
            <div><strong>{{ t('textImport.valid') }}</strong><span>{{ t('textImport.summary', { width: parsedLatex.value.width, height: parsedLatex.value.height, cellSize: parsedLatex.value.cellSize, correction: parsedLatex.value.lineCorrection }) }}</span></div>
          </template>
          <template v-else>
            <TriangleAlert :size="16" /><span>{{ parsedLatex.error }}</span>
          </template>
        </div>
        <div class="modal-actions"><button class="action-button muted" type="button" @click="closeTextImporter">{{ t('textImport.cancel') }}</button><button class="action-button primary" type="button" :disabled="!parsedLatex.ok" @click="importTextCanvas">{{ t('textImport.import') }}</button></div>
       </section>
     </div>

     <div v-if="isImageImportOpen" class="modal-backdrop" @click.self="closeImageImporter">
       <section class="text-import-modal image-import-modal" role="dialog" aria-modal="true" :aria-label="t('imageImport.title')">
         <div class="modal-heading">
           <div><span class="modal-eyebrow"><ImagePlus :size="14" /> Image</span><h2>{{ t('imageImport.title') }}</h2></div>
           <button class="modal-close" type="button" :title="t('imageImport.close')" @click="closeImageImporter"><X :size="18" /></button>
         </div>
         <p class="modal-instruction">{{ t(autoResizeImageCanvas ? 'imageImport.instructionResize' : 'imageImport.instructionKeep') }}</p>
         <button
           class="image-dropzone"
           :class="{ dragging: isImageDragging, 'has-image': imagePreviewUrl }"
           type="button"
           @click="chooseImageFile"
           @dragover.prevent="isImageDragging = true"
           @dragleave.prevent="isImageDragging = false"
           @drop.prevent="handleImageDrop"
         >
           <img v-if="imagePreviewUrl" :src="imagePreviewUrl" :alt="t('imageImport.preview')" />
           <template v-else>
             <Upload :size="25" />
             <strong>{{ t('imageImport.dropTitle') }}</strong>
             <span>{{ t('imageImport.dropHint') }}</span>
             <span class="image-paste-hint"><ClipboardPaste :size="14" /> {{ t('imageImport.pasteHint') }}</span>
           </template>
         </button>
         <label class="image-resize-toggle">
           <span>{{ t('imageImport.autoResize') }}</span>
           <input :checked="autoResizeImageCanvas" type="checkbox" @change="toggleImageCanvasResize" />
           <span class="switch" aria-hidden="true"></span>
         </label>
         <div v-if="imageImportSize && imageFile" class="parse-status valid" role="status">
           <span class="status-dot"></span>
           <div><strong>{{ t('imageImport.ready') }}</strong><span>{{ t(autoResizeImageCanvas ? 'imageImport.summaryResize' : 'imageImport.summaryKeep', { width: imageImportSize.width, height: imageImportSize.height }) }}</span></div>
         </div>
         <div v-else-if="imageImportError" class="parse-status invalid" role="alert"><TriangleAlert :size="16" /><span>{{ imageImportError }}</span></div>
         <div class="modal-actions"><button class="action-button muted" type="button" @click="closeImageImporter">{{ t('imageImport.cancel') }}</button><button class="action-button primary" type="button" :disabled="!imageImportGrid" @click="importPreparedImage">{{ t('imageImport.import') }}</button></div>
         <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="importImage" />
       </section>
     </div>
   </main>
</template>
