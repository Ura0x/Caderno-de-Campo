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

// Planilhas ------------------------------------------------------------------

export interface SheetMeta {
  title: string
  crop_id: string | null
  variety_id: string | null
  /** Data da poda (AAAA-MM-DD), opcional. */
  pruning_date: string | null
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
// Uma tabela tem colunas (compartilhadas) e blocos empilhados na vertical.
// Dentro de cada bloco, cada coluna tem sua própria lista de células: colunas
// podem ter quantidades diferentes de linhas e todas se esticam até a mesma
// altura do bloco.

export type Align = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'

export interface CellStyle {
  bg?: string
  color?: string
  bold?: boolean
  italic?: boolean
  align?: Align
  /** Alinhamento vertical; sem valor = topo. */
  vAlign?: VAlign
  /** Tamanho da letra em px; sem valor = tamanho padrão (DEFAULT_FONT_SIZE). */
  fontSize?: number
}

export interface Cell {
  id: string
  /** O que foi digitado. Quando houver fórmulas, o valor exibido será calculado a partir daqui. */
  raw: string
  style?: CellStyle
}

export interface Column {
  id: string
  /** Estilo padrão da coluna (em todos os blocos); o estilo da célula tem prioridade. */
  style?: CellStyle
  /** Largura relativa (1 = padrão; 2 = o dobro das outras). */
  width?: number
  /** Coluna de lista (ex.: PRODUTO e DOSE): recebe uma célula nova a cada produto adicionado. */
  list?: boolean
}

/** Faixa horizontal da tabela (ex.: um período de aplicação). */
export interface Block {
  id: string
  /** Começa um quadro separado, com espaço acima (ex.: outro período da mesma semana). */
  spaced?: boolean
  /** Legenda exibida acima do quadro (usada no 1º bloco de cada quadro). */
  caption?: string
  /** Células de cada coluna neste bloco, por id da coluna. */
  cells: Record<string, Cell[]>
}

export interface SheetTable {
  id: string
  /** Ausente nas planilhas antigas; toda seção sem `type: 'text'` é tabela. */
  type?: 'table'
  title: string
  columns: Column[]
  blocks: Block[]
}

/** Cor de destaque de um bloco de texto. */
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate'

/**
 * Bloco de texto livre. Linhas que começam com "- " viram itens com marcador,
 * e o trecho antes de "->" aparece em destaque (ex.: produto e dose).
 */
export interface TextSection {
  id: string
  type: 'text'
  title: string
  text: string
  tone: Tone
}

/** Uma seção da planilha: tabela ou bloco de texto, na ordem em que aparecem. */
export type Section = SheetTable | TextSection

export interface SheetContent {
  version: 3
  sections: Section[]
}
