import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { HexColor, PixelGrid, Tool } from '@/types'

const WHITE = 'ffffff'
const HISTORY_LIMIT = 50
const STORAGE_KEY = 'rulepixel-canvas'
const DEFAULT_WIDTH = 16
const DEFAULT_HEIGHT = 16
const DEFAULT_CELL_SIZE = 9
const DEFAULT_COLOR = 'e6484d'

type CanvasSnapshot = {
  width: number
  height: number
  grid: PixelGrid
}

type SavedCanvas = CanvasSnapshot & {
  cellSize: number
  currentColor: HexColor
  currentTool: Tool
}

const makeGrid = (width: number, height: number): PixelGrid =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => WHITE))

const cloneGrid = (grid: PixelGrid): PixelGrid => grid.map((row) => [...row])

function isDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 4 && value <= 40
}

function isHexColor(value: unknown): value is HexColor {
  return typeof value === 'string' && /^[0-9a-f]{6}$/i.test(value)
}

function loadSavedCanvas(): SavedCanvas | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const data: unknown = JSON.parse(saved)
    if (!data || typeof data !== 'object') return null
    const canvas = data as Partial<SavedCanvas>
    if (!isDimension(canvas.width) || !isDimension(canvas.height)) return null
    if (typeof canvas.cellSize !== 'number' || canvas.cellSize < 4 || canvas.cellSize > 18) return null
    if (!isHexColor(canvas.currentColor)) return null
    if (canvas.currentTool !== 'pen' && canvas.currentTool !== 'eraser' && canvas.currentTool !== 'bucket') return null
    if (!Array.isArray(canvas.grid) || canvas.grid.length !== canvas.height) return null
    if (!canvas.grid.every((row) => Array.isArray(row) && row.length === canvas.width && row.every(isHexColor))) return null

    return {
      width: canvas.width,
      height: canvas.height,
      cellSize: canvas.cellSize,
      currentColor: canvas.currentColor.toLowerCase(),
      currentTool: canvas.currentTool,
      grid: canvas.grid.map((row) => row.map((color) => color.toLowerCase())),
    }
  } catch {
    return null
  }
}

export const useEditorStore = defineStore('editor', () => {
  const savedCanvas = loadSavedCanvas()
  const width = ref(savedCanvas?.width ?? DEFAULT_WIDTH)
  const height = ref(savedCanvas?.height ?? DEFAULT_HEIGHT)
  const cellSize = ref(savedCanvas?.cellSize ?? DEFAULT_CELL_SIZE)
  const currentColor = ref<HexColor>(savedCanvas?.currentColor ?? DEFAULT_COLOR)
  const currentTool = ref<Tool>(savedCanvas?.currentTool ?? 'pen')
  const grid = ref<PixelGrid>(savedCanvas?.grid ?? makeGrid(width.value, height.value))
  const undoStack = ref<CanvasSnapshot[]>([])
  const redoStack = ref<CanvasSnapshot[]>([])
  let saveQueued = false

  function snapshot(): CanvasSnapshot {
    return { width: width.value, height: height.value, grid: cloneGrid(grid.value) }
  }

  function saveHistory() {
    undoStack.value.push(snapshot())
    if (undoStack.value.length > HISTORY_LIMIT) undoStack.value.shift()
    redoStack.value = []
  }

  function setPixel(row: number, column: number, color: HexColor, record = true) {
    if (row < 0 || row >= height.value || column < 0 || column >= width.value) return
    if (grid.value[row][column] === color) return
    if (record) saveHistory()
    grid.value[row][column] = color
  }

  function fillArea(row: number, column: number, color: HexColor) {
    const target = grid.value[row]?.[column]
    if (!target || target === color) return
    saveHistory()
    const queue: Array<[number, number]> = [[row, column]]
    while (queue.length) {
      const [currentRow, currentColumn] = queue.pop() as [number, number]
      if (grid.value[currentRow]?.[currentColumn] !== target) continue
      grid.value[currentRow][currentColumn] = color
      queue.push([currentRow - 1, currentColumn], [currentRow + 1, currentColumn])
      queue.push([currentRow, currentColumn - 1], [currentRow, currentColumn + 1])
    }
  }

  function replaceGrid(nextGrid: PixelGrid, nextWidth = width.value, nextHeight = height.value) {
    saveHistory()
    width.value = nextWidth
    height.value = nextHeight
    grid.value = cloneGrid(nextGrid)
  }

  function resizeCanvas(nextWidth: number, nextHeight: number) {
    const safeWidth = Math.max(4, Math.min(40, Math.round(nextWidth)))
    const safeHeight = Math.max(4, Math.min(40, Math.round(nextHeight)))
    if (safeWidth === width.value && safeHeight === height.value) return
    saveHistory()
    const next = makeGrid(safeWidth, safeHeight)
    grid.value.forEach((row, rowIndex) => {
      row.forEach((color, columnIndex) => {
        if (rowIndex < safeHeight && columnIndex < safeWidth) next[rowIndex][columnIndex] = color
      })
    })
    width.value = safeWidth
    height.value = safeHeight
    grid.value = next
  }

  function clearAll() {
    if (grid.value.every((row) => row.every((color) => color === WHITE))) return
    saveHistory()
    grid.value = makeGrid(width.value, height.value)
  }

  function resetCanvas() {
    const isDefault = width.value === DEFAULT_WIDTH && height.value === DEFAULT_HEIGHT && cellSize.value === DEFAULT_CELL_SIZE
      && grid.value.every((row) => row.every((color) => color === WHITE))
    if (isDefault) return
    saveHistory()
    width.value = DEFAULT_WIDTH
    height.value = DEFAULT_HEIGHT
    cellSize.value = DEFAULT_CELL_SIZE
    grid.value = makeGrid(DEFAULT_WIDTH, DEFAULT_HEIGHT)
  }

  function restore(snapshotToRestore: CanvasSnapshot) {
    width.value = snapshotToRestore.width
    height.value = snapshotToRestore.height
    grid.value = cloneGrid(snapshotToRestore.grid)
  }

  function undo() {
    const previous = undoStack.value.pop()
    if (!previous) return
    redoStack.value.push(snapshot())
    restore(previous)
  }

  function redo() {
    const next = redoStack.value.pop()
    if (!next) return
    undoStack.value.push(snapshot())
    restore(next)
  }

  function persist() {
    try {
      const canvas: SavedCanvas = {
        width: width.value,
        height: height.value,
        cellSize: cellSize.value,
        currentColor: currentColor.value,
        currentTool: currentTool.value,
        grid: cloneGrid(grid.value),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(canvas))
    } catch {
      // Storage can be unavailable or full; the editor remains usable without persistence.
    }
  }

  function schedulePersist() {
    if (saveQueued) return
    saveQueued = true
    queueMicrotask(() => {
      saveQueued = false
      persist()
    })
  }

  watch([width, height, cellSize, currentColor, currentTool, grid], schedulePersist, { deep: true })

  return {
    width, height, cellSize, currentColor, currentTool, grid, undoStack, redoStack,
    setPixel, fillArea, replaceGrid, resizeCanvas, clearAll, resetCanvas, undo, redo,
  }
})
