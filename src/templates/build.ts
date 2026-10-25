import { nanoid } from 'nanoid'
import type { Cell, CellStyle, Column, Section, SheetContent, SheetTable } from '@/lib/types'

/** Célula de um modelo: só o texto, ou texto + estilo. */
export type CellSpec = string | { text: string; style?: CellStyle }

/**
 * Um bloco do modelo: para cada coluna (na ordem), a lista de células.
 * Ex.: [['Fase'], ['', '', ''], ...] → coluna A com 1 célula, B com 3.
 */
export type BlockSpec = CellSpec[][]

/** Coluna do modelo: estilo padrão, largura relativa (1 = padrão) e se é coluna de lista. */
export type ColumnSpec = Omit<Column, 'id'>

/** Bloco com opções: começar um quadro separado (`spaced`) e/ou legenda acima do quadro. */
export interface BlockOptions {
  cells: BlockSpec
  spaced?: boolean
  caption?: string
}

const cell = (c: CellSpec): Cell =>
  typeof c === 'string' ? { id: nanoid(8), raw: c } : { id: nanoid(8), raw: c.text, ...(c.style && { style: c.style }) }

/**
 * Monta uma tabela; ids novos a cada chamada, para cada planilha criada ser independente.
 * `blocks` são as faixas de cima para baixo.
 */
export function table(title: string, columns: ColumnSpec[], blocks: (BlockSpec | BlockOptions)[]): SheetTable {
  const cols: Column[] = columns.map((spec) => ({ id: nanoid(8), ...spec }))
  return {
    id: nanoid(8),
    title,
    columns: cols,
    blocks: blocks.map((b) => {
      const { cells: spec, spaced, caption } = Array.isArray(b) ? { cells: b } : b
      return {
        id: nanoid(8),
        ...(spaced && { spaced }),
        ...(caption && { caption }),
        cells: Object.fromEntries(cols.map((c, i) => [c.id, (spec[i]?.length ? spec[i] : ['']).map(cell)])),
      }
    }),
  }
}

export function content(...sections: Section[]): SheetContent {
  return { version: 3, sections }
}
