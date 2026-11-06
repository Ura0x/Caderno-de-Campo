import type { CellStyle } from '@/lib/types'
import { content, table, type BlockSpec, type CellSpec, type ColumnSpec } from './build'
import type { SheetTemplate } from './index'

/**
 * Planilhas de adubação de goiaba (PRIME): grade de 26 semanas (dia 7 a 182) por fase,
 * com uma coluna por produto, seguida da legenda dos produtos.
 */

const HEADER: CellStyle = { bold: true, bg: '#1f2937', color: '#ffffff', align: 'center', vAlign: 'middle' }
const TOTAL: CellStyle = { bold: true, bg: '#374151', color: '#ffffff', align: 'center', vAlign: 'middle' }

interface Phase {
  name: string
  /** Fundo da célula da fase (texto branco). */
  label: string
  /** Fundo das linhas da fase. */
  row: string
  /** Semanas da fase (1 a 26). */
  from: number
  to: number
}

const PHASES: Phase[] = [
  { name: 'VEGETAÇÃO', label: '#15803d', row: '#dcfce7', from: 1, to: 5 },
  { name: 'FLORAÇÃO', label: '#b45309', row: '#fef3c7', from: 6, to: 10 },
  { name: 'PEGAMENTO E ENCHIMENTO', label: '#0f766e', row: '#d1fae5', from: 11, to: 17 },
  { name: 'PRÉ-COLHEITA E COLHEITA', label: '#1d4ed8', row: '#dbeafe', from: 18, to: 26 },
]

/** Doses por semana: { produto: { semana: dose } }. Semanas sem dose ficam em branco. */
type Doses = Record<string, Record<number, string>>

const styled = (text: string, style: CellStyle): CellSpec => ({ text, style })

/**
 * Grade compacta: cabeçalho, um bloco por fase (fase deitada e mesclada + uma linha por semana)
 * e, opcional, a linha de total (calculada com =SOMA). `caption` vai acima da grade (produtor, área).
 */
function grid(title: string, caption: string, products: string[], doses: Doses, withTotal = false) {
  const columns: ColumnSpec[] = [
    { width: 0.6 }, // Fase (texto deitado)
    { width: 0.5 }, // Dia
    { width: 0.8 }, // Semana
    // Nomes compostos ("S. POTÁSSIO") um pouco mais largos, para o cabeçalho não quebrar.
    ...products.map((p): ColumnSpec => ({
      style: { align: 'center', vAlign: 'middle' },
      ...(p.length > 10 && { width: 1.15 }),
    })),
  ]
  const header: BlockSpec = ['FASE', 'DIA', 'SEMANA', ...products].map((t) => [styled(t, HEADER)])

  const phaseBlock = (p: Phase): BlockSpec => {
    const weeks = Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i)
    const rowStyle: CellStyle = { bg: p.row, align: 'center', vAlign: 'middle' }
    const keyStyle: CellStyle = { ...rowStyle, bold: true }
    return [
      [styled(p.name, { bold: true, bg: p.label, color: '#ffffff', align: 'center', vAlign: 'middle', vertical: true })],
      weeks.map((w) => styled(String(w * 7), keyStyle)),
      weeks.map((w) => styled(`Sem. ${w}`, keyStyle)),
      ...products.map((product) => weeks.map((w) => styled(doses[product]?.[w] ?? '', rowStyle))),
    ]
  }

  const blocks: BlockSpec[] = [header, ...PHASES.map(phaseBlock)]
  // Total calculado: =SOMA soma a coluna, convertendo ml/L e g/Kg.
  if (withTotal)
    blocks.push([[styled('TOTAL', TOTAL)], [styled('', TOTAL)], [styled('', TOTAL)], ...products.map(() => [styled('=SOMA', TOTAL)])])
  const [first, ...rest] = blocks
  return table(title, columns, [{ cells: first, caption }, ...rest], { dense: true })
}

/** Legenda compacta de duas colunas (produto em negrito + descrição), com as observações no fim. */
const legend = (rows: [string, string][]) =>
  table(
    'Legenda dos produtos',
    [{ style: { bold: true, vAlign: 'middle' }, width: 1.2 }, { width: 6 }],
    [
      [[styled('PRODUTO', HEADER)], [styled('DESCRIÇÃO', HEADER)]],
      [rows.map(([product]) => product), rows.map(([, text]) => text)],
    ],
    { dense: true },
  )

const LEGEND: Record<string, [string, string]> = {
  ballard: [
    'BALLARD (Mg) 31,92%',
    'Magnésio de alta concentração para otimizar a fotossíntese e aumentar as reservas. Alta compatibilidade de misturas, melhora qualidade do fruto e grau brix. Liberação gradativa e baixo índice salino.',
  ],
  massivo: ['MASSIVO (Zn) 146,66%', 'Óxido de zinco com partículas nanométricas, de alta concentração e baixo índice salino.'],
  arquiteto: [
    'ARQUITETO (Citocinina)',
    'Citocinina para melhorar a divisão celular e consequentemente ajudar no pegamento e desenvolvimento equilibrado da planta.',
  ],
  nutreK: [
    'NUTRE K (K2O) 44,40%',
    'Potássio de alta mobilidade e resposta na planta. Fonte segura. Baixo ponto de deliquescência evitando salinização do limbo foliar e fitotoxidez. Melhor enchimento e brix de frutos.',
  ],
  vital: [
    'VITAL (Enraizador)',
    'Extrato de algas; Alto teor de Auxina. Baixo índice salino. Alongamento celular. Desenvolvimento radicular. Ativa o transporte de fotoassimilados para enchimento de frutos. Alta eficiência na mitigação de estresses.',
  ],
  supremo: [
    'SUPREMO (N) 31,25%',
    'Metaboliza o nitrogênio, deixa a planta mais equilibrada e ajuda no acúmulo de reserva. Evita o aborto na floração e melhora resistência de bagas no final do ciclo melhorando a pós-colheita.',
  ],
  percurso: [
    'PERCURSO (Ca) 53,09%',
    'Cálcio de alta concentração com partículas de tamanho nanométrico e alta reatividade. Baixo índice salino e livre de metais pesados. Aumenta a qualidade e firmeza dos frutos. Boa compatibilidade de mistura.',
  ],
  outard: ['OUTARD (B) 12,00%', 'Dupla fonte nutricional de Boro, complexado com etalonamina, rápida absorção e baixa lixiviação.'],
  energy: [
    'ENERGY (P2O5) 46,58%',
    'Fonte de fósforo com disponibilidade imediata e gradativa para planta. Maior aproveitamento e segurança comparado a sais. Maior disponibilidade no solo.',
  ],
}

/** Repete a mesma dose em várias semanas. */
const at = (dose: string, weeks: number[]) => Object.fromEntries(weeks.map((w) => [w, dose]))

const SOLO_DOSES: Doses = {
  ESTERCO: { 1: '20L' },
  BALLARD: { ...at('1L', [2, 3, 4, 5]), ...at('500ml', [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) },
  MASSIVO: { 3: '300ml' },
  'NUTRE K': at('3L', [9, 12, 13, 14, 15, 16]),
  VITAL: at('500ml', [3, 8]),
  SUPREMO: { ...at('5L', [1, 3]), ...at('2L', [5, 8, 12, 17, 19, 21]) },
  PERCURSO: { ...at('500ml', [3, 4, 5, 7, 9, 11, 12, 13, 14, 15, 16]), ...at('1L', [6, 8, 10]) },
  OUTARD: at('1L', [4, 7, 11]),
  ENERGY: { ...at('5L', [1, 3, 17]), ...at('3L', [4, 5]), ...at('2L', [13, 14, 15]) },
  BLINDEX: at('800g', [3, 4, 5, 7, 10]),
  'S. POTÁSSIO': at('10Kg', [9, 12, 13, 14, 15]),
  'NIT. CÁLCIO': at('50Kg', [17, 19, 21]),
  'S. AMÔNIO': { ...at('50Kg', [1, 3]), 5: '30Kg' },
}

export const adubacaoGoiabaSolo: SheetTemplate = {
  id: 'adubacao-goiaba-solo',
  name: 'Adubação via Solo',
  description: '26 semanas por fase (esterco, Ballard, Nutre K, Supremo, Energy, sais…) com totais, observações e legenda.',
  build: () =>
    content(
      grid(
        'Planilha de Adubação via Solo',
        'PRODUTOR: ________________    ÁREA: 1 ha',
        Object.keys(SOLO_DOSES).concat('CALCÁRIO'),
        SOLO_DOSES,
        true,
      ),
      legend([
        LEGEND.ballard, LEGEND.massivo, LEGEND.nutreK, LEGEND.vital,
        LEGEND.supremo, LEGEND.percurso, LEGEND.outard, LEGEND.energy,
        ['AUGEN', 'De acordo com a necessidade.'],
        ['CALCÁRIO DOLOMÍTICO', '500g por planta se necessário.'],
        ['ENERGY', 'Deve ser aplicado sozinho.'],
      ]),
    ),
}

const FOLIAR_DOSES: Doses = {
  ENERGY: at('300ml/100L', [17, 19]),
  'NUTRE BORO': at('50ml/100L', [5, 7, 11, 15]),
  PERCURSO: at('100ml/100L', [3, 5, 7, 9, 11, 13, 15]),
  BALLARD: at('100ml/100L', [3, 5, 7, 9, 11, 13, 15]),
  MASSIVO: at('15ml/100L', [9, 13]),
  'NUTRE K': at('200ml/100L', [17, 19]),
  VITAL: at('50ml/100L', [7, 11, 15]),
  SUPREMO: at('200ml/100L', [3, 5, 7, 9, 11, 13, 15]),
  ARQUITETO: at('100ml/100L', [2, 5, 8]),
}

export const adubacaoGoiabaFoliar: SheetTemplate = {
  id: 'adubacao-goiaba-foliar',
  name: 'Adubação via Foliar',
  description: '26 semanas por fase com doses foliares por 100 L (Percurso, Ballard, Supremo, Arquiteto…) e legenda.',
  build: () =>
    content(
      grid('Planilha de Adubação via Foliar', 'PRODUTOR: ________________', Object.keys(FOLIAR_DOSES), FOLIAR_DOSES),
      legend([
        LEGEND.ballard, LEGEND.massivo, LEGEND.arquiteto, LEGEND.nutreK, LEGEND.vital,
        LEGEND.supremo, LEGEND.percurso, LEGEND.outard, LEGEND.energy,
      ]),
    ),
}
