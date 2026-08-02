import type { HexColor, PixelGrid } from '@/types'

export type ParsedLatex = {
  width: number
  height: number
  cellSize: number
  lineCorrection: number
  grid: PixelGrid
}

export type LatexParseResult =
  | { ok: true; value: ParsedLatex }
  | { ok: false; error: string }

const MIN_SIZE = 4
const MAX_SIZE = 40
const NUMBER = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)'

function parseNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validateGrid(grid: PixelGrid): string | null {
  if (!grid.length) return '未找到有效的像素行'
  if (grid.length < MIN_SIZE || grid.length > MAX_SIZE) return `画布高度必须在 ${MIN_SIZE} 到 ${MAX_SIZE} 行之间`
  const width = grid[0].length
  if (width < MIN_SIZE || width > MAX_SIZE) return `画布宽度必须在 ${MIN_SIZE} 到 ${MAX_SIZE} 列之间`
  if (grid.some((row) => row.length !== width)) return '每一行的像素数量不一致'
  return null
}

export function parseLatexToCanvas(source: string): LatexParseResult {
  const text = source.trim()
  if (!text) return { ok: false, error: '请输入 TeX 文本' }

  const macroMatch = text.match(new RegExp(`\\\\newcommand[\\s\\S]*?\\\\rule\\s*\\{(${NUMBER})pt\\}\\s*\\{(${NUMBER})pt\\}`))
  const macroSize = macroMatch ? parseNumber(macroMatch[1]) : null
  const expandedSizes = [...text.matchAll(new RegExp(`\\\\rule\\s*\\{(${NUMBER})pt\\}\\s*\\{(${NUMBER})pt\\}`, 'g'))]
  const sizeCandidates = expandedSizes.map((match) => `${match[1]}:${match[2]}`)
  if (sizeCandidates.length && sizeCandidates.some((size) => size !== sizeCandidates[0])) {
    return { ok: false, error: '检测到不一致的规则尺寸' }
  }

  const cellSize = macroSize ?? (expandedSizes[0] ? parseNumber(expandedSizes[0][1]) : null)
  if (cellSize === null || cellSize < 4 || cellSize > 18) return { ok: false, error: '无法识别有效的规则尺寸（应为 4pt 到 18pt）' }

  const correctionPattern = /\\+\[(-?(?:\d+(?:\.\d+)?|\.\d+))pt\]/g
  const correctionMatches = [...text.matchAll(correctionPattern)]
  const lineCorrection = correctionMatches.length ? parseNumber(correctionMatches[0][1]) : null
  if (lineCorrection === null) return { ok: false, error: '未找到有效的行间修正，例如 \\[-4pt]' }
  if (correctionMatches.some((match) => match[1] !== correctionMatches[0][1])) return { ok: false, error: '检测到不一致的行间修正值' }

  const grid: PixelGrid = []
  const pixelPattern = /\\px\{([0-9a-fA-F]{6})\}|\\color\{([0-9a-fA-F]{6})\}\{\\rule\{[-\d.]+pt\}\{[-\d.]+pt\}\}/g
  const compactRows = text.split(/\r?\n/).filter((line) => line.match(pixelPattern))

  for (const rowText of compactRows) {
    pixelPattern.lastIndex = 0
    const colors = [...rowText.matchAll(pixelPattern)]
      .map((match) => (match[1] ?? match[2]).toLowerCase() as HexColor)
    if (!colors.length) continue
    grid.push(colors)
  }

  const gridError = validateGrid(grid)
  if (gridError) return { ok: false, error: gridError }

  return {
    ok: true,
    value: {
      width: grid[0].length,
      height: grid.length,
      cellSize,
      lineCorrection,
      grid,
    },
  }
}
