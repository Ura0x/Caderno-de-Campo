import type { Block, SheetTable } from '@/lib/types'

/**
 * Fórmulas de célula. Por enquanto só a soma da coluna:
 *   =SOMA  (ou =SUM) → soma as quantidades das células acima, na mesma coluna da tabela.
 *
 * Quantidades são "número + unidade" ("500ml", "1L", "8,5 L", "800g", "10Kg").
 * Unidades da mesma grandeza são convertidas (ml ↔ L, g ↔ Kg ↔ t); outras unidades
 * são somadas entre iguais. Células que não são quantidade (ex.: cabeçalho) e
 * outras fórmulas (subtotais) ficam de fora.
 */

const SUM_FORMULAS = new Set(['=SOMA', '=SUM'])

export const isFormula = (raw: string) => raw.trimStart().startsWith('=')

/** Grandezas com conversão: fator para a unidade base e as unidades de exibição (da maior para a menor). */
const DIMENSIONS = {
  volume: { units: { ml: 1, l: 1000 }, show: [['L', 1000], ['ml', 1]] },
  mass: { units: { g: 1, kg: 1000, t: 1_000_000 }, show: [['t', 1_000_000], ['Kg', 1000], ['g', 1]] },
} as const

type Dimension = keyof typeof DIMENSIONS

interface Quantity {
  value: number
  /** Grandeza com conversão, ou a unidade literal (minúscula) para as demais. */
  key: Dimension | `unit:${string}`
  /** Como a unidade foi escrita (para exibir unidades sem conversão). */
  unit: string
}

const QUANTITY = /^(\d+(?:[.,]\d+)?)\s*([^\d\s].*)?$/

function parseQuantity(raw: string): Quantity | null {
  const m = QUANTITY.exec(raw.trim())
  if (!m) return null
  const value = Number(m[1].replace(',', '.'))
  const unit = (m[2] ?? '').trim()
  const lower = unit.toLowerCase()
  for (const [dim, { units }] of Object.entries(DIMENSIONS) as [Dimension, (typeof DIMENSIONS)[Dimension]][]) {
    const factor = (units as Record<string, number>)[lower]
    if (factor) return { value: value * factor, key: dim, unit }
  }
  return { value, key: `unit:${lower}`, unit }
}

const formatNumber = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 3, useGrouping: false })

/** Valor na maior unidade em que fica ≥ 1 (1500 ml → "1,5L"; 300 ml → "300ml"). */
function formatDimension(dim: Dimension, base: number): string {
  const show = DIMENSIONS[dim].show
  const [unit, factor] = show.find(([, f]) => base >= f) ?? show[show.length - 1]
  return `${formatNumber(base / factor)}${unit}`
}

/** Soma uma lista de textos de células; '' se nenhuma for quantidade. */
export function sumQuantities(raws: string[]): string {
  const totals = new Map<Quantity['key'], { value: number; unit: string }>()
  for (const raw of raws) {
    if (!raw.trim() || isFormula(raw)) continue
    const q = parseQuantity(raw)
    if (!q) continue
    const t = totals.get(q.key)
    if (t) t.value += q.value
    else totals.set(q.key, { value: q.value, unit: q.unit })
  }
  return [...totals]
    .map(([key, { value, unit }]) =>
      key === 'volume' || key === 'mass' ? formatDimension(key, value) : `${formatNumber(value)}${unit}`,
    )
    .join(' + ')
}

/** Textos das células acima de (bloco, índice) na coluna: blocos anteriores inteiros e o início do bloco atual. */
function cellsAbove(table: SheetTable, blockIndex: number, colId: string, cellIndex: number): string[] {
  return table.blocks.flatMap((b: Block, i) => {
    if (i > blockIndex) return []
    const cells = b.cells[colId] ?? []
    return (i < blockIndex ? cells : cells.slice(0, cellIndex)).map((c) => c.raw)
  })
}

/**
 * O que a célula mostra: o próprio texto ou, se for fórmula, o resultado.
 * Fórmula desconhecida aparece como está, para o usuário perceber.
 */
export function cellDisplay(table: SheetTable, blockIndex: number, colId: string, cellIndex: number): string {
  const raw = table.blocks[blockIndex]?.cells[colId]?.[cellIndex]?.raw ?? ''
  if (!isFormula(raw)) return raw
  if (SUM_FORMULAS.has(raw.trim().toUpperCase())) return sumQuantities(cellsAbove(table, blockIndex, colId, cellIndex))
  return raw
}
