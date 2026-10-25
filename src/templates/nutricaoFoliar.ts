import type { CellStyle } from '@/lib/types'
import { newTextSection } from '@/editor/model'
import { content, table, type BlockSpec, type CellSpec, type ColumnSpec } from './build'
import type { SheetTemplate } from './index'

const HEADER: CellStyle = { bold: true, bg: '#047857', color: '#ffffff', align: 'center', vAlign: 'middle' }

/** PRODUTO mais larga, para os nomes caberem numa linha; PRODUTO e DOSE recebem os produtos novos. */
const COLUMNS: ColumnSpec[] = [
  { style: { bold: true, bg: '#ecfdf5', color: '#065f46', align: 'center', vAlign: 'middle' } }, // Fase
  { width: 2, list: true }, // Produto
  { style: { align: 'center', vAlign: 'middle' }, width: 1.35, list: true }, // Dose/100 (cabe "300 g/100 + 100 g/100")
  { style: { bold: true, bg: '#f0f9ff', color: '#075985', align: 'center', vAlign: 'middle' }, width: 1.25 }, // Volume de calda
]

const header = (dose = 'DOSE/100'): BlockSpec =>
  ['FASE', 'PRODUTO', dose, 'VOLUME DE CALDA'].map((text) => [{ text, style: HEADER }])

/** Um período de aplicação da semana: fase e volume numa célula só, ao lado dos produtos. */
interface Period {
  phase: string
  volume: string
  /** [produto, dose] em cada linha. */
  products: [CellSpec, string][]
  /** Título da coluna de dose no cabeçalho deste período (padrão "DOSE/100"). */
  doseLabel?: string
  /** Linha de texto acima do quadro do período. */
  caption?: string
}

const periodBlock = ({ phase, volume, products }: Period): BlockSpec => [
  [phase],
  products.map(([product]) => product),
  products.map(([, dose]) => dose),
  [volume],
]

/** Semana preenchida: cada período tem seu próprio cabeçalho; do 2º em diante, num quadro separado. */
const week = (title: string, periods: Period[]) =>
  table(
    title,
    COLUMNS,
    periods.flatMap((p, i) => [{ cells: header(p.doseLabel), spaced: i > 0, caption: p.caption }, periodBlock(p)]),
  )

/** Linha "ou" entre produtos alternativos: em itálico, centralizada e sem dose. */
const OR: [CellSpec, string] = [{ text: 'ou', style: { italic: true, align: 'center', color: '#64748b' } }, '']

/** Enxofre: Sulfomex/Thiotrac na calda ou, como alternativa, enxofre em pó ventilado. */
const SULFUR_OPTIONS: [CellSpec, string][] = [
  ['Sulfomex ou Thiotrac', '200 mL/100'],
  OR,
  ['Enxofre pó ventilado', '25 kg/ha'],
]

/** Correção do pH da calda seguida do biológico Twixx. */
const PH_TWIXX: [CellSpec, string][] = [
  ['Redutor de pH (ideal 5,0)', ''],
  ['Twixx (Bacillus amyloliquefaciens)', '150 mL/100'],
]

/** Mistura na mesma calda: produtos e doses unidos por "+" na mesma linha. */
const SULFO_VICOSA: [string, string] = ['Sulfo M + Viçosa', '300 g/100 + 100 g/100']

/** Tabelas do modelo: a poda e as 14 semanas seguintes. */
const weeks = () => [
  week('SEMANA: PODA', [
    {
      phase: 'PODA',
      volume: 'Rolinho 5%\nBandejão 3%',
      products: [
        ['HiperFixx ou Silwet', '50 mL/100'],
        ['HI-LIGHT (marcador)', '40 mL/100'],
        ['Maxcel (citocinina benziladenina)', '70 mL/100'],
        ['Detergente neutro Atol', '5 L/100'],
        ['Amiorgan', '2 kg/100'],
        ['Dormex', ''],
      ],
    },
  ]),
  week('SEMANA: 07 a 13 dias (gemas em algodão e ponta verde)', [
    {
      phase: '8 dias',
      volume: '700 L/ha',
      products: [
        ['HiperFixx ou Silwet', '20 mL/100'],
        ['Aminoagro Energy', '200 mL/100'],
        ['Maxcel (citocinina benziladenina)', '50 mL/100'],
        ['Curzate', '200 g/100'],
        ['Sulfo M ou similar', '300 g/100'],
      ],
    },
    {
      phase: '3 dias após',
      volume: '700 L/ha',
      doseLabel: 'DOSE',
      products: [
        ['HiperFixx ou Silwet', '20 mL/100'],
        ['Aminoagro Energy', '200 mL/100'],
        ['Maxl Zinc', '50 mL/100'],
        ['Maxcel (citocinina benziladenina)', '50 mL/100'],
        ['Cabrio Top', '300 g/100'],
      ],
    },
  ]),
  week('SEMANA: 14 dias', [
    {
      caption: '1º alongamento de cachos – fase: brotos com 10 cm',
      phase: '14 dias',
      volume: '700 L/ha',
      products: [
        ['ProGibb 1,0 ppm', '100 mL/100'],
        ['Stoller Celerate', '75 mL/100'],
        ['Terra Mar', '75 mL/100'],
        ['Ferti Peixe', '200 mL/100'],
        ['Cabrio Top', '300 g/100'],
        ['Sulfo M ou similar', '300 g/100'],
      ],
    },
    {
      caption: '2º alongamento de cachos – 4 dias após a 1ª aplicação',
      phase: '17 dias',
      volume: '700 L/ha',
      products: [
        ['ProGibb 1,0 ppm', '100 mL/100'],
        ['Stoller Celerate', '75 mL/100'],
        ['Terra Mar', '75 mL/100'],
        ['Ferti Peixe', '200 mL/100'],
        ['Codafol 14-06-05', '200 mL/100'],
        ['Cabrio Top', '300 g/100'],
      ],
    },
  ]),
  week('SEMANA: 21 dias', [
    {
      phase: '21 dias',
      volume: '700 L/ha',
      products: [
        ['ProGibb 0,5 ppm', '50 mL/100'],
        ['Stoller Celerate', '75 mL/100'],
        ['Terra Mar', '75 mL/100'],
        ['Ferti Peixe', '200 mL/100'],
        ['Cabrio Top', '300 g/100'],
        ['Sulfo M', '300 g/100'],
      ],
    },
    {
      phase: '25 dias',
      volume: '700 L/ha',
      products: [
        ['Collis', '75 mL/100'],
        ['Foliacon 22', '300 mL/100'],
      ],
    },
  ]),
  week('SEMANA: 28 dias', [
    {
      phase: '28 dias',
      volume: '700 L/ha',
      products: [
        ['Foliacon 22', '300 mL/100'],
        ['Concentrat Mag', '70 mL/100'],
        ['Cropset', '200 mL/100'],
        ['Collis', '75 mL/100'],
      ],
    },
    {
      phase: '31 dias',
      volume: '700 L/ha',
      products: [SULFO_VICOSA],
    },
    {
      phase: '33 dias',
      volume: '700 L/ha',
      products: [
        ['Foliacon 22', '300 mL/100'],
        ['Stoller Celerate', '75 mL/100'],
        ['Concentrat Mag', '70 mL/100'],
        ['Score', '30 mL/100'],
      ],
    },
  ]),
  week('SEMANA: 35 dias', [
    {
      phase: '35 dias',
      volume: '700 L/ha',
      products: [
        ['Cropset', '200 mL/100'],
        ['Sulfo M', '300 g/100'],
        ['Score', '30 mL/100'],
        ['Strike da AQUA', '150 mL/100'],
      ],
    },
    { phase: '39 dias', volume: '700 L/ha', products: [SULFO_VICOSA] },
  ]),
  week('SEMANA: 42 dias', [
    {
      phase: '42 dias',
      volume: '500 L/ha',
      products: [
        ['Commax Algas', '100 g/100'],
        ['Cropset', '200 mL/100'],
        ['Concentrat Mag', '100 mL/100'],
        ['Sulfo M', '300 g/100'],
        ['Strike da AQUA', '200 mL/100'],
      ],
    },
    { phase: '45 dias', volume: '700 L/ha', products: [SULFO_VICOSA] },
  ]),
  week('SEMANA: 49 dias', [
    {
      phase: '49 dias',
      volume: '500 L/ha',
      products: [
        ['Commax Algas', '100 g/100'],
        ['Concentrat Mag', '100 mL/100'],
        ['Flavon', '100 mL/100'],
        ['Strike da AQUA', '200 mL/100'],
      ],
    },
    { phase: '52 dias', volume: '700 L/ha', products: [['Sulfomex ou Thiotrac', '300 mL/100']] },
  ]),
  week('SEMANA: 56 dias', [
    {
      phase: '56 dias',
      volume: '500 L/ha',
      products: [
        ['Commax Algas', '100 g/100'],
        ['Concentrat Mag', '100 mL/100'],
        ['Flavon', '100 mL/100'],
        ['Strike', '200 mL/100'],
      ],
    },
    { phase: '58 dias', volume: '700 L/ha', products: [['Sulfomex ou Thiotrac', '200 mL/100']] },
    { phase: 'Sábado', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
  week('SEMANA: 63 dias', [
    {
      phase: '63 dias',
      volume: '500 L/ha',
      products: [
        ['Fulvin', '100 mL/100'],
        ['Commax Algas', '100 g/100'],
        ['Concentrat Mag', '100 mL/100'],
        ['Flavon', '100 mL/100'],
        ['Strike', '200 mL/100'],
      ],
    },
    { phase: '65 dias', volume: '700 L/ha', products: [['Sulfomex ou Thiotrac', '200 mL/100']] },
    { phase: 'Sábado', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
  week('SEMANA: 70 dias', [
    {
      phase: '70 dias',
      volume: '500 L/ha',
      products: [
        ['Fulvin', '100 mL/100'],
        ['KSC Mix', '100 g/100'],
        ['Commax Algas', '200 g/100'],
        ['Flavon', '100 mL/100'],
        ['Strike', '200 mL/100'],
      ],
    },
    { phase: '72 dias', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
  week('SEMANA: 77 dias', [
    {
      phase: '77 dias',
      volume: '500 L/ha',
      products: [
        ['Fulvin', '100 mL/100'],
        ['KSC Mix', '100 g/100'],
        ['Commax Algas', '200 g/100'],
      ],
    },
    { phase: '79 dias', volume: '200 L/ha', products: [['Sulfomex ou Thiotrac', '200 mL/100']] },
    { phase: '83 dias', volume: '700 L/ha', products: PH_TWIXX },
    { phase: 'Sábado', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
  week('SEMANA: 84 dias', [
    {
      phase: '84 dias',
      volume: '500 L/ha',
      products: [
        ['Fulvin', '100 mL/100'],
        ['KSC Mix', '100 g/100'],
        ['Commax Algas', '200 g/100'],
      ],
    },
    { phase: '86 dias', volume: '700 L/ha', products: [['Sulfomex ou Thiotrac', '200 mL/100']] },
    { phase: '', volume: '700 L/ha', products: PH_TWIXX },
    { phase: 'Sábado', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
  week('SEMANA: 91 dias', [
    {
      phase: '91 dias',
      volume: '500 L/ha',
      products: [
        ['Concentrat Mag', '100 mL/100'],
        ['Commax Algas', '200 g/100'],
      ],
    },
    { phase: '', volume: '700 L/ha', products: PH_TWIXX },
    { phase: '95 dias', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
  week('SEMANA: 98 dias', [
    { phase: '98 dias', volume: '500 L/ha', products: [['Commax Algas', '200 g/100']] },
    { phase: '102 dias', volume: '700 L/ha', products: SULFUR_OPTIONS },
  ]),
]

const PEST_CONTROL = `- Efeito · 50 mL/100 -> cigarrinhas e mosca-das-frutas (aplicar até 28 dias)
- Safety · 100 mL/100 -> cigarrinhas e mosca-das-frutas (após 28 dias até a maturação dos frutos)
- Shock (Global Crops) · 100 mL/100 -> mosca-das-frutas · resíduo zero
- Tracer · 150 mL/ha -> trips, minitrips, traça-dos-cachos e lagarta (florada, chumbinho e raleio)
- Vortex · 100 mL/100 -> trips, minitrips, traça-dos-cachos e lagarta (florada, chumbinho e raleio) · resíduo zero
- Delegate · 100 g/ha -> trips, minitrips, traça-dos-cachos e lagarta (florada, chumbinho e raleio)
- Vertimec 84 · 120 mL/ha -> ácaros vermelho, branco e rajado; cochonilhas
- Matrix 180 mL/100 + Dipel 150 mL/100 -> lagartas e ácaros (calda de 700 L/ha, pH 4,5)
- MarrySolos · 3 L/ha via solo -> inseticida natural fertirrigado: cigarrinhas, nematoides e ácaros · resíduo zero`

export const nutricaoFoliar: SheetTemplate = {
  id: 'nutricao-foliar-fitossanitario',
  name: 'Nutrição Foliar e Controle Fitossanitário',
  description: 'Poda + 14 semanas (fase, produto, dose/100 e volume de calda) e opções fitossanitárias para pragas.',
  build: () =>
    content(...weeks(), newTextSection('Opções fitossanitárias para controle de pragas', PEST_CONTROL, 'amber')),
}
