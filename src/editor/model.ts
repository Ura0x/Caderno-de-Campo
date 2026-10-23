import { nanoid } from 'nanoid'
import type { Cell, CellStyle, Column, SheetContent, SheetTable } from '@/lib/types'

export type Scope = 'cell' | 'row' | 'column'

export interface Selection {
  tableId: string
  colId: string
  cellIndex: number
}

const MIN_ROWS = 2

/** Valor de flexbox para cada alinhamento vertical (editor e PDF). */
export const V_ALIGN_FLEX = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

export const DEFAULT_FONT_SIZE = 14
export const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40]

/** Próximo tamanho da lista, para cima (+1) ou para baixo (-1). */
export function stepFontSize(current: number, dir: 1 | -1): number {
  const next = dir > 0 ? FONT_SIZES.find((s) => s > current) : FONT_SIZES.findLast((s) => s < current)
  return next ?? current
}

export const newCell = (raw = ''): Cell => ({ id: nanoid(8), raw })

export const newColumn = (rows = 1): Column => ({
  id: nanoid(8),
  cells: Array.from({ length: Math.max(1, rows) }, () => newCell()),
})

export const newTable = (): SheetTable => ({
  id: nanoid(8),
  title: 'Nova tabela',
  columns: [newColumn(MIN_ROWS), newColumn(MIN_ROWS), newColumn(MIN_ROWS)],
})

export const emptyContent = (): SheetContent => ({ version: 1, tables: [] })

export function normalizeContent(value: unknown): SheetContent {
  const v = value as Partial<SheetContent> | null
  return v && Array.isArray(v.tables) ? { version: 1, tables: v.tables } : emptyContent()
}

export const effectiveStyle = (col: Column, cell: Cell): CellStyle => ({ ...col.style, ...cell.style })

/** Nome da coluna no estilo planilha: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

export const maxRows = (table: SheetTable) => Math.max(1, ...table.columns.map((c) => c.cells.length))

/** Aplica um patch de estilo; chaves com `undefined` são removidas. */
function mergeStyle(base: CellStyle | undefined, patch: CellStyle): CellStyle | undefined {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) delete out[k]
    else out[k] = v
  }
  return Object.keys(out).length ? (out as CellStyle) : undefined
}

function withoutKeys(style: CellStyle | undefined, keys: string[]): CellStyle | undefined {
  if (!style) return style
  return mergeStyle(style, Object.fromEntries(keys.map((k) => [k, undefined])))
}

function move<T>(list: T[], from: number, to: number) {
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
}

export function resolve(content: SheetContent, sel: Selection | null) {
  if (!sel) return null
  const table = content.tables.find((t) => t.id === sel.tableId)
  const col = table?.columns.find((c) => c.id === sel.colId)
  const cell = col?.cells[sel.cellIndex]
  if (!table || !col || !cell) return null
  return { table, col, cell, index: sel.cellIndex }
}

// Operações (recebem um rascunho do immer e o modificam) -----------------------

const table = (d: SheetContent, id: string) => d.tables.find((t) => t.id === id)
const column = (d: SheetContent, tableId: string, colId: string) =>
  table(d, tableId)?.columns.find((c) => c.id === colId)

export const ops = {
  addTable(d: SheetContent) {
    const t = newTable()
    d.tables.push(t)
    return t.id
  },

  removeTable(d: SheetContent, tableId: string) {
    d.tables = d.tables.filter((t) => t.id !== tableId)
  },

  moveTable(d: SheetContent, fromId: string, toId: string) {
    const from = d.tables.findIndex((t) => t.id === fromId)
    const to = d.tables.findIndex((t) => t.id === toId)
    if (from >= 0 && to >= 0) move(d.tables, from, to)
  },

  setTitle(d: SheetContent, tableId: string, title: string) {
    const t = table(d, tableId)
    if (t) t.title = title
  },

  setCell(d: SheetContent, tableId: string, colId: string, index: number, raw: string) {
    const cell = column(d, tableId, colId)?.cells[index]
    if (cell) cell.raw = raw
  },

  /** Adiciona uma célula só nesta coluna, na posição `index`. */
  insertCell(d: SheetContent, tableId: string, colId: string, index: number) {
    column(d, tableId, colId)?.cells.splice(index, 0, newCell())
  },

  removeCell(d: SheetContent, tableId: string, colId: string, index: number) {
    const col = column(d, tableId, colId)
    if (col && col.cells.length > 1) col.cells.splice(index, 1)
  },

  /** Adiciona uma linha em todas as colunas (no fim, ou após `afterIndex`). */
  addRow(d: SheetContent, tableId: string, afterIndex?: number) {
    for (const col of table(d, tableId)?.columns ?? []) {
      const at = afterIndex === undefined ? col.cells.length : Math.min(afterIndex + 1, col.cells.length)
      col.cells.splice(at, 0, newCell())
    }
  },

  /** Remove a célula de posição `index` de todas as colunas que a possuem. */
  removeRow(d: SheetContent, tableId: string, index: number) {
    for (const col of table(d, tableId)?.columns ?? []) {
      if (col.cells.length > 1 && index < col.cells.length) col.cells.splice(index, 1)
    }
  },

  addColumn(d: SheetContent, tableId: string, afterColId?: string) {
    const t = table(d, tableId)
    if (!t) return
    const col = newColumn(maxRows(t))
    const at = afterColId ? t.columns.findIndex((c) => c.id === afterColId) + 1 : t.columns.length
    t.columns.splice(at, 0, col)
    return col.id
  },

  removeColumn(d: SheetContent, tableId: string, colId: string) {
    const t = table(d, tableId)
    if (t && t.columns.length > 1) t.columns = t.columns.filter((c) => c.id !== colId)
  },

  moveColumn(d: SheetContent, tableId: string, fromId: string, toId: string) {
    const cols = table(d, tableId)?.columns
    if (!cols) return
    const from = cols.findIndex((c) => c.id === fromId)
    const to = cols.findIndex((c) => c.id === toId)
    if (from >= 0 && to >= 0) move(cols, from, to)
  },

  applyStyle(d: SheetContent, sel: Selection, scope: Scope, patch: CellStyle) {
    const t = table(d, sel.tableId)
    if (!t) return
    if (scope === 'column') {
      const col = t.columns.find((c) => c.id === sel.colId)
      if (!col) return
      col.style = mergeStyle(col.style, patch)
      // Remove sobrescritas das células para o estilo da coluna aparecer.
      const keys = Object.keys(patch)
      for (const cell of col.cells) cell.style = withoutKeys(cell.style, keys)
      return
    }
    const cols = scope === 'row' ? t.columns : t.columns.filter((c) => c.id === sel.colId)
    for (const col of cols) {
      const cell = col.cells[sel.cellIndex]
      if (cell) cell.style = mergeStyle(cell.style, patch)
    }
  },

  clearStyle(d: SheetContent, sel: Selection, scope: Scope) {
    const t = table(d, sel.tableId)
    if (!t) return
    if (scope === 'column') {
      const col = t.columns.find((c) => c.id === sel.colId)
      if (!col) return
      col.style = undefined
      for (const cell of col.cells) cell.style = undefined
      return
    }
    const cols = scope === 'row' ? t.columns : t.columns.filter((c) => c.id === sel.colId)
    for (const col of cols) {
      const cell = col.cells[sel.cellIndex]
      if (cell) cell.style = undefined
    }
  },
}
