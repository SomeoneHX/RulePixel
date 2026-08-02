import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HexColor, PixelGrid, Tool } from '@/types'

const WHITE = 'ffffff'
const HISTORY_LIMIT = 50

type CanvasSnapshot = {
  width: number
  height: number
  grid: PixelGrid
}

const makeGrid = (width: number, height: number): PixelGrid =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => WHITE))

const cloneGrid = (grid: PixelGrid): PixelGrid => grid.map((row) => [...row])

export const useEditorStore = defineStore('editor', () => {
  const width = ref(16)
  const height = ref(16)
  const cellSize = ref(9)
  const currentColor = ref<HexColor>('e6484d')
  const currentTool = ref<Tool>('pen')
  const grid = ref<PixelGrid>(makeGrid(width.value, height.value))
  const undoStack = ref<CanvasSnapshot[]>([])
  const redoStack = ref<CanvasSnapshot[]>([])

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
    const isDefault = width.value === 16 && height.value === 16
      && grid.value.every((row) => row.every((color) => color === WHITE))
    if (isDefault) return
    saveHistory()
    width.value = 16
    height.value = 16
    grid.value = makeGrid(16, 16)
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

  return {
    width, height, cellSize, currentColor, currentTool, grid, undoStack, redoStack,
    setPixel, fillArea, replaceGrid, resizeCanvas, clearAll, resetCanvas, undo, redo,
  }
})
