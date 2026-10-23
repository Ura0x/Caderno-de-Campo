// Cadastros ------------------------------------------------------------------

export interface Client {
  id: string
  name: string
  farm: string | null
  city: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export interface Crop {
  id: string
  name: string
  created_at: string
}

export interface Variety {
  id: string
  crop_id: string
  name: string
  created_at: string
}

export interface Season {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

// Planilhas ------------------------------------------------------------------

export interface SheetMeta {
  title: string
  crop_id: string | null
  variety_id: string | null
  season_id: string | null
  client_ids: string[]
}

export interface SheetSummary extends SheetMeta {
  id: string
  created_at: string
  updated_at: string
}

export interface Sheet extends SheetSummary {
  content: SheetContent
}

// Conteúdo da planilha (salvo em sheets.content) ------------------------------
//
// Cada coluna tem sua própria lista de células: colunas podem ter quantidades
// diferentes de linhas, e todas se esticam até a mesma altura.

export type Align = 'left' | 'center' | 'right'

export interface CellStyle {
  bg?: string
  color?: string
  bold?: boolean
  italic?: boolean
  align?: Align
}

export interface Cell {
  id: string
  /** O que foi digitado. Quando houver fórmulas, o valor exibido será calculado a partir daqui. */
  raw: string
  style?: CellStyle
}

export interface Column {
  id: string
  /** Estilo padrão da coluna; o estilo da célula tem prioridade. */
  style?: CellStyle
  cells: Cell[]
}

export interface SheetTable {
  id: string
  title: string
  columns: Column[]
}

export interface SheetContent {
  version: 1
  tables: SheetTable[]
}
