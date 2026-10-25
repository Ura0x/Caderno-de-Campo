import { nanoid } from 'nanoid'
import type { Block, Cell, CellStyle, Column, Section, SheetContent, SheetTable, TextSection, Tone } from '@/lib/types'

export type Scope = 'cell' | 'row' | 'column'

/** Posição de uma célula: tabela → bloco → coluna → índice dentro da coluna no bloco. */
export interface Selection {
  tableId: string
  blockId: string
  colId: string
  cellIndex: number
}

const MIN_ROWS = 2

/** Valor de flexbox para cada alinhamento vertical (editor e PDF). */
export const V_ALIGN_FLEX = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

/** Fundo das linhas alternadas (zebrado) nas listas de colunas alinhadas. */
export const ZEBRA_BG = '#f4f7f6'

/** Linha zebrada: linhas ímpares de grupos com mais de uma linha. */
export const isZebraRow = (rows: number, index: number) => rows > 1 && index % 2 === 1

export const DEFAULT_FONT_SIZE = 14
export const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40]

/** Próximo tamanho da lista, para cima (+1) ou para baixo (-1). */
export function stepFontSize(current: number, dir: 1 | -1): number {
  const next = dir > 0 ? FONT_SIZES.find((s) => s > current) : FONT_SIZES.findLast((s) => s < current)
  return next ?? current
}

export const newCell = (raw = ''): Cell => ({ id: nanoid(8), raw })

const newCells = (rows: number) => Array.from({ length: Math.max(1, rows) }, () => newCell())

export const newColumn = (): Column => ({ id: nanoid(8) })

export const newBlock = (columns: Column[], rows = 1): Block => ({
  id: nanoid(8),
  cells: Object.fromEntries(columns.map((c) => [c.id, newCells(rows)])),
})

export function newTable(): SheetTable {
  const columns = [newColumn(), newColumn(), newColumn()]
  return { id: nanoid(8), title: 'Nova tabela', columns, blocks: [newBlock(columns, MIN_ROWS)] }
}

export const newTextSection = (title = 'Observações', text = '', tone: Tone = 'amber'): TextSection => ({
  id: nanoid(8),
  type: 'text',
  title,
  text,
  tone,
})

export const isText = (s: Section): s is TextSection => s.type === 'text'

export const emptyContent = (): SheetContent => ({ version: 3, sections: [] })

/** Formato antigo (v1): cada coluna guardava suas células, sem blocos. */
interface LegacyTable {
  id: string
  title: string
  columns: (Column & { cells?: Cell[] })[]
  blocks?: Block[]
}

/**
 * Lê o conteúdo salvo, convertendo formatos antigos:
 * v1 (colunas com células, sem blocos) → um bloco único; v1/v2 (`tables`) → `sections`.
 */
export function normalizeContent(value: unknown): SheetContent {
  const v = value as { sections?: Section[]; tables?: LegacyTable[] } | null
  const raw = v?.sections ?? v?.tables
  if (!Array.isArray(raw)) return emptyContent()
  const sections = raw.map((s): Section => {
    if ((s as Section).type === 'text') return s as TextSection
    const t = s as LegacyTable
    if (t.blocks) return t as SheetTable
    const columns = t.columns.map(({ cells: _cells, ...col }) => col)
    const block: Block = {
      id: nanoid(8),
      cells: Object.fromEntries(t.columns.map((c) => [c.id, c.cells?.length ? c.cells : newCells(1)])),
    }
    return { id: t.id, title: t.title, columns, blocks: [block] }
  })
  return { version: 3, sections }
}

export const effectiveStyle = (col: Column, cell: Cell): CellStyle => ({ ...col.style, ...cell.style })

export const cellsOf = (block: Block, colId: string): Cell[] => block.cells[colId] ?? []

/** Nome da coluna no estilo planilha: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

export const MIN_WIDTH = 0.5
export const MAX_WIDTH = 4
export const WIDTH_STEP = 0.25

export const columnWidth = (col: Column) => col.width ?? 1

/**
 * Agrupa colunas vizinhas que têm o mesmo número de células (> 1) no bloco.
 * Dentro de um grupo as linhas ficam alinhadas (ex.: PRODUTO e DOSE);
 * colunas sozinhas continuam com as células esticando livremente.
 */
export function columnGroups(block: Block, columns: Column[]) {
  const groups: { cols: { col: Column; index: number }[]; rows: number }[] = []
  columns.forEach((col, index) => {
    const rows = cellsOf(block, col.id).length
    const last = groups.at(-1)
    if (last && rows > 1 && last.rows === rows) last.cols.push({ col, index })
    else groups.push({ cols: [{ col, index }], rows })
  })
  return groups
}

/** Colunas que formam a "linha" de `colId` no bloco: as do seu grupo alinhado. */
export function rowColumns(block: Block, columns: Column[], colId: string): Column[] {
  const group = columnGroups(block, columns).find((g) => g.cols.some((c) => c.col.id === colId))
  return group ? group.cols.map((c) => c.col) : []
}

/**
 * Colunas que recebem um produto novo: as marcadas como lista (PRODUTO e DOSE nos modelos).
 * Em tabelas sem colunas de lista: o grupo alinhado da célula selecionada ou, sem seleção,
 * o grupo alinhado com mais linhas (ou todas as colunas, se não houver grupo).
 */
function listColumns(block: Block, columns: Column[], colId?: string): Column[] {
  const flagged = columns.filter((c) => c.list)
  if (flagged.length) return flagged
  if (colId) return rowColumns(block, columns, colId)
  const linked = columnGroups(block, columns).filter((g) => g.rows > 1 && g.cols.length > 1)
  if (!linked.length) return columns
  return linked.reduce((a, b) => (b.rows > a.rows ? b : a)).cols.map((c) => c.col)
}

/**
 * Onde entra um produto novo: no bloco da célula selecionada (se for o cabeçalho de um
 * quadro, no bloco seguinte), logo abaixo dela; sem seleção, no fim do último bloco.
 */
function productTarget(t: SheetTable, sel?: Selection | null) {
  const frame = sel && blockFrames(t.blocks).find((f) => f.some((x) => x.block.id === sel.blockId))
  if (!sel || !frame) {
    const block = t.blocks.at(-1)!
    return { block, cols: listColumns(block, t.columns), after: undefined }
  }
  const isHeader = frame.length > 1 && frame[0].block.id === sel.blockId
  const block = isHeader ? frame[1].block : frame.find((x) => x.block.id === sel.blockId)!.block
  const cols = listColumns(block, t.columns, isHeader ? undefined : sel.colId)
  const inList = !isHeader && cols.some((c) => c.id === sel.colId)
  return { block, cols, after: inList ? sel.cellIndex : undefined }
}

/** A linha da célula selecionada pode ser excluída? (coluna de lista, com mais de uma linha) */
export function canRemoveLine(content: SheetContent, sel: Selection | null): boolean {
  const target = resolve(content, sel)
  if (!target || !sel) return false
  const cols = listColumns(target.block, target.table.columns, sel.colId)
  return cols.some((c) => c.id === sel.colId) && target.cells.length > 1
}

/** Divide os blocos em quadros: um novo quadro começa em cada bloco com espaço acima. */
export function blockFrames(blocks: Block[]) {
  const frames: { block: Block; index: number }[][] = []
  blocks.forEach((block, index) => {
    if (!frames.length || (block.spaced && index > 0)) frames.push([])
    frames[frames.length - 1].push({ block, index })
  })
  return frames
}

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

export function resolve(content: SheetContent, sel: Selection | null) {
  if (!sel) return null
  const table = findTable(content, sel.tableId)
  const block = table?.blocks.find((b) => b.id === sel.blockId)
  const col = table?.columns.find((c) => c.id === sel.colId)
  if (!table || !block || !col) return null
  const cells = cellsOf(block, col.id)
  const cell = cells[sel.cellIndex]
  if (!cell) return null
  return { table, block, col, cells, cell, index: sel.cellIndex }
}

// Operações (recebem um rascunho do immer e o modificam) -----------------------

type BlockRef = Pick<Selection, 'tableId' | 'blockId'>
type ColumnRef = Pick<Selection, 'tableId' | 'blockId' | 'colId'>

const findTable = (c: SheetContent, id: string) =>
  c.sections.find((s): s is SheetTable => s.id === id && !isText(s))
const table = findTable
const block = (d: SheetContent, ref: BlockRef) => table(d, ref.tableId)?.blocks.find((b) => b.id === ref.blockId)
const cellList = (d: SheetContent, ref: ColumnRef) => block(d, ref)?.cells[ref.colId]

/** Células atingidas por um estilo no escopo escolhido. */
function scopedCells(t: SheetTable, sel: Selection, scope: Exclude<Scope, 'column'>): Cell[] {
  const b = t.blocks.find((x) => x.id === sel.blockId)
  if (!b) return []
  const cols = scope === 'row' ? rowColumns(b, t.columns, sel.colId) : t.columns.filter((c) => c.id === sel.colId)
  return cols.map((c) => cellsOf(b, c.id)[sel.cellIndex]).filter((c): c is Cell => Boolean(c))
}

export const ops = {
  addTable(d: SheetContent) {
    const t = newTable()
    d.sections.push(t)
    return t.id
  },

  addText(d: SheetContent) {
    const t = newTextSection()
    d.sections.push(t)
    return t.id
  },

  /** Remove uma seção (tabela ou bloco de texto). */
  removeSection(d: SheetContent, id: string) {
    d.sections = d.sections.filter((s) => s.id !== id)
  },

  /** Título de qualquer seção. */
  setTitle(d: SheetContent, id: string, title: string) {
    const s = d.sections.find((x) => x.id === id)
    if (s) s.title = title
  },

  updateText(d: SheetContent, id: string, patch: Partial<Pick<TextSection, 'text' | 'tone'>>) {
    const s = d.sections.find((x) => x.id === id)
    if (s && isText(s)) Object.assign(s, patch)
  },

  setCell(d: SheetContent, sel: Selection, raw: string) {
    const cell = cellList(d, sel)?.[sel.cellIndex]
    if (cell) cell.raw = raw
  },

  /** Adiciona um produto: uma linha nova nas colunas de lista (ver productTarget). */
  addProduct(d: SheetContent, tableId: string, sel?: Selection | null) {
    const t = table(d, tableId)
    if (!t) return
    const { block: b, cols, after } = productTarget(t, sel?.tableId === tableId ? sel : null)
    for (const col of cols) {
      const cells = (b.cells[col.id] ??= [])
      cells.splice(after === undefined ? cells.length : Math.min(after + 1, cells.length), 0, newCell())
    }
  },

  /** Exclui a linha da célula selecionada nas colunas de lista (ex.: o produto e sua dose). */
  removeLine(d: SheetContent, sel: Selection) {
    if (!canRemoveLine(d, sel)) return
    const t = table(d, sel.tableId)!
    const b = block(d, sel)!
    for (const col of listColumns(b, t.columns, sel.colId)) {
      const cells = cellsOf(b, col.id)
      if (cells.length > 1 && sel.cellIndex < cells.length) cells.splice(sel.cellIndex, 1)
    }
  },

  /**
   * Novo quadro (com espaço acima) logo após o quadro que contém `afterBlockId` (ou o último).
   * Se o quadro tem cabeçalho (mais de um bloco), repete o 1º bloco com os textos; os demais
   * blocos vêm em branco, no mesmo formato e com as mesmas cores.
   */
  addFrame(d: SheetContent, tableId: string, afterBlockId?: string) {
    const t = table(d, tableId)
    if (!t) return
    const frames = blockFrames(t.blocks)
    const source = frames.find((f) => f.some((x) => x.block.id === afterBlockId)) ?? frames.at(-1)
    if (!source) return
    const copies = source.map(({ block }, i): Block => ({
      id: nanoid(8),
      ...(i === 0 && { spaced: true }),
      cells: Object.fromEntries(
        Object.entries(block.cells).map(([colId, cells]) => [
          colId,
          cells.map((c) => ({ ...newCell(i === 0 && source.length > 1 ? c.raw : ''), ...(c.style && { style: { ...c.style } }) })),
        ]),
      ),
    }))
    t.blocks.splice(source.at(-1)!.index + 1, 0, ...copies)
    return copies[0].id
  },

  /** Legenda acima do quadro; vazia remove. `ref.blockId` deve ser o 1º bloco do quadro. */
  setCaption(d: SheetContent, ref: BlockRef, caption: string) {
    const b = block(d, ref)
    if (!b) return
    if (caption) b.caption = caption
    else delete b.caption
  },

  /** Exclui o quadro que contém o bloco; a tabela sempre fica com pelo menos um quadro. */
  removeFrame(d: SheetContent, ref: BlockRef) {
    const t = table(d, ref.tableId)
    if (!t) return
    const frames = blockFrames(t.blocks)
    const frame = frames.find((f) => f.some((x) => x.block.id === ref.blockId))
    if (!frame || frames.length < 2) return
    const ids = new Set(frame.map((x) => x.block.id))
    t.blocks = t.blocks.filter((b) => !ids.has(b.id))
    delete t.blocks[0].spaced
  },

  /** Alarga (+1) ou estreita (-1) a coluna em um passo. */
  resizeColumn(d: SheetContent, tableId: string, colId: string, dir: 1 | -1) {
    const col = table(d, tableId)?.columns.find((c) => c.id === colId)
    if (!col) return
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, columnWidth(col) + dir * WIDTH_STEP))
    col.width = width === 1 ? undefined : width
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
      for (const b of t.blocks) for (const cell of cellsOf(b, col.id)) cell.style = withoutKeys(cell.style, keys)
      return
    }
    for (const cell of scopedCells(t, sel, scope)) cell.style = mergeStyle(cell.style, patch)
  },

  clearStyle(d: SheetContent, sel: Selection, scope: Scope) {
    const t = table(d, sel.tableId)
    if (!t) return
    if (scope === 'column') {
      const col = t.columns.find((c) => c.id === sel.colId)
      if (!col) return
      col.style = undefined
      for (const b of t.blocks) for (const cell of cellsOf(b, col.id)) cell.style = undefined
      return
    }
    for (const cell of scopedCells(t, sel, scope)) cell.style = undefined
  },
}
