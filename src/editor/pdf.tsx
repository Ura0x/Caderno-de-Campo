import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { SheetContent, SheetTable, TextSection } from '@/lib/types'
import {
  DEFAULT_FONT_SIZE,
  DENSE_FONT_SIZE,
  V_ALIGN_FLEX,
  ZEBRA_BG,
  blockFrames,
  cellsOf,
  columnGroups,
  columnWidth,
  effectiveStyle,
  isText,
  isZebraRow,
  tableMinWidth,
  unbreakableWords,
} from './model'
import { helveticaWidth } from './fontMetrics'
import { cellDisplay } from './formula'
import { TONES, parseNote } from './note'

// Quebra só entre palavras, sem hifenizar (ex.: "benziladen-ina").
Font.registerHyphenationCallback((word) => [word])

export type Orientation = 'portrait' | 'landscape'

export interface PdfHeader {
  title: string
  details: { label: string; value: string }[]
}

const GREEN = '#047857'
const GREEN_DARK = '#064e3b'
const BORDER = '#cbd5e1'
const BASE_FONT = 9
// Mantém a proporção do editor: 14px na tela = 9pt no PDF.
const pdfFontSize = (px?: number) => ((px ?? DEFAULT_FONT_SIZE) * BASE_FONT) / DEFAULT_FONT_SIZE
/** Tabela compacta: letra padrão de 12px na tela = 7pt no PDF; tamanhos escolhidos mantêm a proporção. */
const DENSE_PDF_FONT = 7
const densePdfFontSize = (px?: number) => ((px ?? DENSE_FONT_SIZE) * DENSE_PDF_FONT) / DENSE_FONT_SIZE
/** Espaço interno da célula compacta, proporcional à letra (letra maior não fica espremida). */
const densePad = (font: number) => ({ v: Math.max(0.8, font * 0.15), h: Math.max(2, font * 0.35) })
/** Altura de uma linha de texto na tabela compacta (letra + espaço + borda). */
const denseRowHeight = (font: number) => font * 1.15 + densePad(font).v * 2 + 1

/** Largura útil da página (pt): A4 menos as margens laterais. */
const A4 = { width: 595.28, height: 841.89 }
const PAGE_PAD_X = 32
const contentWidthOf = (orientation: Orientation) =>
  (orientation === 'landscape' ? A4.height : A4.width) - PAGE_PAD_X * 2

const s = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingHorizontal: PAGE_PAD_X,
    paddingBottom: 46,
    fontSize: BASE_FONT,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: GREEN },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: GREEN_DARK, marginBottom: 10 },
  details: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  detail: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  detailLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#15803d', letterSpacing: 0.8, marginBottom: 1.5 },
  detailValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  detailBlank: { fontSize: 9.5, color: '#94a3b8', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#d1fae5', marginBottom: 14 },
  section: { marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  sectionPill: { backgroundColor: GREEN, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 8 },
  sectionPillText: { color: '#ffffff', fontSize: 10, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  sectionRule: { flexGrow: 1, height: 1, backgroundColor: '#d1fae5', marginLeft: 6 },
  grid: { borderWidth: 1, borderColor: BORDER },
  caption: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  captionBar: { width: 2.5, height: 10, borderRadius: 1, backgroundColor: '#059669', marginRight: 5 },
  captionText: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#065f46' },
  block: { flexDirection: 'row' },
  blockSeparator: { borderTopWidth: 1.5, borderColor: '#64748b' },
  group: { flexDirection: 'column', borderRightWidth: 1, borderColor: BORDER },
  row: { flexDirection: 'row', flexGrow: 1, borderBottomWidth: 1, borderColor: BORDER },
  cell: { minHeight: 18, paddingVertical: 3.5, paddingHorizontal: 5, borderColor: BORDER },
  denseCell: { minHeight: 0 },
  // Com tabelas compactas a página tem menos margem e as seções ficam mais juntas, para caber numa folha.
  densePage: { paddingTop: 22, paddingBottom: 34 },
  // Cabeçalho compacto (páginas com tabela compacta): título e detalhes numa linha só.
  compactHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 },
  compactTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN_DARK, marginRight: 12 },
  compactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 0.75,
    borderColor: '#bbf7d0',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    marginRight: 5,
  },
  compactLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#15803d', letterSpacing: 0.5, marginRight: 4 },
  compactValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  compactBlank: { fontSize: 8, color: '#94a3b8' },
  compactDivider: { marginBottom: 8 },
  denseSection: { marginBottom: 8 },
  denseTitleRow: { marginBottom: 3 },
  densePill: { paddingVertical: 2, paddingHorizontal: 6 },
  densePillText: { fontSize: 8 },
  note: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12 },
  noteTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 7 },
  noteLine: { flexDirection: 'row', marginBottom: 4 },
  noteDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3.5, marginRight: 7 },
  noteText: { flex: 1, lineHeight: 1.4, color: '#334155' },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    borderTopWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingTop: 6,
    fontSize: 7,
    color: '#94a3b8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function SectionTitle({ title, dense }: { title: string; dense?: boolean }) {
  if (!title) return null
  return (
    <View style={[s.sectionTitleRow, dense ? s.denseTitleRow : {}]} wrap={false}>
      <View style={[s.sectionPill, dense ? s.densePill : {}]}>
        <Text style={[s.sectionPillText, dense ? s.densePillText : {}]}>{title}</Text>
      </View>
      <View style={s.sectionRule} />
    </View>
  )
}

function PdfText({ section }: { section: TextSection }) {
  const tone = TONES[section.tone]
  const lines = parseNote(section.text)
  return (
    // Blocos curtos vão inteiros para a próxima página em vez de serem cortados;
    // nos longos, o título nunca fica sozinho no pé da página.
    <View
      style={[s.section, s.note, { backgroundColor: tone.bg, borderColor: tone.border, borderLeftColor: tone.accent }]}
      wrap={lines.length > 30}
    >
      {section.title && (
        <Text style={[s.noteTitle, { color: tone.title }]} minPresenceAhead={40}>
          {section.title}
        </Text>
      )}
      {lines.map((line, i) =>
        line.kind === 'space' ? (
          <View key={i} style={{ height: 4 }} />
        ) : (
          <View key={i} style={s.noteLine} wrap={false}>
            {line.kind === 'item' && <View style={[s.noteDot, { backgroundColor: tone.accent }]} />}
            <Text style={s.noteText}>
              {line.lead && (
                <>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: tone.title }}>{line.lead}</Text>
                  <Text style={{ color: '#94a3b8' }}> — </Text>
                </>
              )}
              {line.rest}
            </Text>
          </View>
        ),
      )}
    </View>
  )
}

/**
 * Texto deitado (de baixo para cima). O react-pdf gira só o desenho, não o espaço ocupado:
 * por isso o texto fica num quadro com a altura estimada do bloco, girado em torno do centro da célula.
 */
function VerticalText({ length, font, children }: { length: number; font: number; children: React.ReactNode }) {
  const thickness = font * 2.6
  return (
    <View
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: length,
        height: thickness,
        marginLeft: -length / 2,
        marginTop: -thickness / 2,
        justifyContent: 'center',
        transform: 'rotate(-90deg)',
      }}
    >
      {children}
    </View>
  )
}

/**
 * Escala para nenhuma palavra ser quebrada no meio: se a maior palavra de alguma coluna não
 * couber na largura que a coluna recebe, a letra da tabela diminui o necessário.
 */
function wordFitScale(table: SheetTable, scale: number, contentWidth: number): number {
  const dense = !!table.dense
  let s = scale
  // Algumas iterações: o espaço interno não é exatamente proporcional à letra.
  for (let i = 0; i < 4; i++) {
    const needed = tableMinWidth(table, (col, cell) => {
      const st = effectiveStyle(col, cell)
      if (st.vertical || !cell.raw.trim()) return 0
      const font = (dense ? densePdfFontSize(st.fontSize) : pdfFontSize(st.fontSize)) * s
      const padX = dense ? densePad(font).h : 5 * s
      const word = Math.max(...unbreakableWords(cell.raw).map((w) => helveticaWidth(w, font, !!st.bold)))
      // +2: bordas e folga de arredondamento.
      return word + padX * 2 + 2
    })
    if (needed <= contentWidth) break
    s *= contentWidth / needed
  }
  return s
}

function PdfTable({ table, scale: pageScale, contentWidth }: { table: SheetTable; scale: number; contentWidth: number }) {
  const dense = !!table.dense
  const scale = wordFitScale(table, pageScale, contentWidth)
  const cellCount = table.blocks.reduce((n, b) => n + Object.values(b.cells).reduce((m, c) => m + c.length, 0), 0)
  return (
    // Tabelas pequenas não são quebradas entre páginas.
    <View style={[s.section, dense ? s.denseSection : {}]} wrap={cellCount > 60}>
      <SectionTitle title={table.title} dense={dense} />
      {blockFrames(table.blocks).map((frame, fi) => (
        <View key={frame[0].block.id} style={fi > 0 ? { marginTop: 10 } : {}}>
          {frame[0].block.caption && (
            <View style={s.caption} wrap={false} minPresenceAhead={40}>
              <View style={s.captionBar} />
              <Text style={s.captionText}>{frame[0].block.caption}</Text>
            </View>
          )}
          <View style={s.grid}>
            {frame.map(({ block, index: blockIndex }, bi) => {
              const groups = columnGroups(block, table.columns)
              const blockRows = Math.max(...groups.map((g) => g.rows))
              return (
                <View key={block.id} style={[s.block, bi > 0 ? s.blockSeparator : {}]} wrap={false}>
                  {groups.map((group, gi) => {
                    const weight = group.cols.reduce((n, { col }) => n + columnWidth(col), 0)
                    return (
                    // Mesma lógica do editor: colunas do grupo dividem as linhas.
                    <View
                      key={group.cols[0].col.id}
                      style={[
                        s.group,
                        { flex: weight },
                        gi === groups.length - 1 ? { borderRightWidth: 0 } : {},
                      ]}
                    >
                      {Array.from({ length: group.rows }, (_, r) => (
                        <View key={r} style={[s.row, r === group.rows - 1 ? { borderBottomWidth: 0 } : {}]}>
                          {group.cols.map(({ col }, ci) => {
                            const cell = cellsOf(block, col.id)[r]
                            if (!cell) return null
                            const st = effectiveStyle(col, cell)
                            const font = (dense ? densePdfFontSize(st.fontSize) : pdfFontSize(st.fontSize)) * scale
                            const pad = densePad(font)
                            const text = (
                              <Text
                                style={{
                                  color: st.color,
                                  textAlign: st.align ?? 'left',
                                  fontSize: font,
                                  fontFamily: `Helvetica${st.bold && st.italic ? '-BoldOblique' : st.bold ? '-Bold' : st.italic ? '-Oblique' : ''}`,
                                }}
                              >
                                {cellDisplay(table, blockIndex, col.id, r)}
                              </Text>
                            )
                            // Comprimento disponível para o texto deitado: a altura do bloco, descontada uma folga.
                            const verticalLength =
                              (blockRows / group.rows) * (dense ? denseRowHeight(font) : 18 * scale) - 4
                            return (
                              <View
                                key={cell.id}
                                style={[
                                  s.cell,
                                  scale !== 1 && !dense
                                    ? { minHeight: 18 * scale, paddingVertical: 3.5 * scale, paddingHorizontal: 5 * scale }
                                    : {},
                                  dense ? { ...s.denseCell, paddingVertical: pad.v, paddingHorizontal: pad.h } : {},
                                  // Pesos normalizados no grupo: somando menos de 1, a célula não ocuparia a largura toda.
                                  { flex: columnWidth(col) / weight, justifyContent: V_ALIGN_FLEX[st.vAlign ?? 'top'] },
                                  st.vertical ? { position: 'relative', minHeight: font * 3 } : {},
                                  ci < group.cols.length - 1 ? { borderRightWidth: 1 } : {},
                                  st.bg
                                    ? { backgroundColor: st.bg }
                                    : isZebraRow(group.rows, r)
                                      ? { backgroundColor: ZEBRA_BG }
                                      : {},
                                ]}
                              >
                                {st.vertical ? (
                                  <VerticalText length={verticalLength} font={font}>
                                    {text}
                                  </VerticalText>
                                ) : (
                                  text
                                )}
                              </View>
                            )
                          })}
                        </View>
                      ))}
                    </View>
                    )
                  })}
                </View>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

function SheetPdf({
  header,
  content,
  orientation,
  scale = 1,
  onPages,
}: {
  header: PdfHeader
  content: SheetContent
  orientation: Orientation
  /** Fator aplicado à letra e ao espaço das tabelas (1 = como na tela). */
  scale?: number
  /** Recebe o total de páginas quando o documento é montado. */
  onPages?: (total: number) => void
}) {
  const generated = new Date().toLocaleDateString('pt-BR')
  const hasDense = content.sections.some((sec) => !isText(sec) && sec.dense)
  return (
    <Document title={header.title}>
      <Page size="A4" orientation={orientation} style={[s.page, hasDense ? s.densePage : {}]}>
        <View style={s.topBar} fixed />
        {hasDense ? (
          <View style={s.compactHeader}>
            <Text style={s.compactTitle}>{header.title}</Text>
            {header.details.map((d) => (
              <View key={d.label} style={s.compactDetail}>
                <Text style={s.compactLabel}>{d.label.toUpperCase()}</Text>
                <Text style={d.value ? s.compactValue : s.compactBlank}>{d.value || '____ / ____ / ________'}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.title}>{header.title}</Text>
        )}
        {!hasDense && header.details.length > 0 && (
          <View style={s.details}>
            {header.details.map((d) => (
              <View key={d.label} style={s.detail}>
                <Text style={s.detailLabel}>{d.label.toUpperCase()}</Text>
                {/* Valor vazio vira espaço para preencher à caneta. */}
                <Text style={d.value ? s.detailValue : s.detailBlank}>{d.value || '____ / ____ / ________'}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={[s.divider, hasDense ? s.compactDivider : {}]} />
        {content.sections.map((sec) =>
          isText(sec) ? <PdfText key={sec.id} section={sec} /> : <PdfTable key={sec.id} table={sec} scale={scale} contentWidth={contentWidthOf(orientation)} />,
        )}
        <View style={s.footer} fixed>
          <Text>
            {header.title} · gerado em {generated}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => {
              if (totalPages) onPages?.(totalPages)
              return `Página ${pageNumber} de ${totalPages}`
            }}
          />
        </View>
      </Page>
    </Document>
  )
}

/** Gera o PDF numa escala e informa quantas páginas ele teve. */
async function render(header: PdfHeader, content: SheetContent, orientation: Orientation, scale: number) {
  let pages = 0
  const blob = await pdf(
    <SheetPdf
      header={header}
      content={content}
      orientation={orientation}
      scale={scale}
      onPages={(n) => (pages = Math.max(pages, n))}
    />,
  ).toBlob()
  return { blob, pages }
}

/** Menor redução aceita ao encaixar numa página (abaixo disso fica ilegível; o PDF sai com mais páginas). */
const MIN_FIT_SCALE = 0.5

/**
 * Maior escala (≤ 1) em que o documento cabe em uma página, por busca binária.
 * Se nem na escala mínima couber, devolve o PDF em tamanho normal (várias páginas).
 */
async function renderFitted(header: PdfHeader, content: SheetContent, orientation: Orientation) {
  const full = await render(header, content, orientation, 1)
  if (full.pages <= 1) return full.blob
  let best = await render(header, content, orientation, MIN_FIT_SCALE)
  if (best.pages > 1) return full.blob
  let [lo, hi] = [MIN_FIT_SCALE, 1]
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2
    const r = await render(header, content, orientation, mid)
    if (r.pages <= 1) [lo, best] = [mid, r]
    else hi = mid
  }
  return best.blob
}

export async function exportSheetPdf(
  header: PdfHeader,
  content: SheetContent,
  orientation: Orientation,
  { fitOnePage = false }: { fitOnePage?: boolean } = {},
) {
  const blob = fitOnePage
    ? await renderFitted(header, content, orientation)
    : (await render(header, content, orientation, 1)).blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${header.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'planilha'}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
