import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { SheetContent, SheetTable, TextSection } from '@/lib/types'
import {
  DEFAULT_FONT_SIZE,
  V_ALIGN_FLEX,
  ZEBRA_BG,
  blockFrames,
  cellsOf,
  columnGroups,
  columnWidth,
  effectiveStyle,
  isText,
  isZebraRow,
} from './model'
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

const s = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingHorizontal: 32,
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

function SectionTitle({ title }: { title: string }) {
  if (!title) return null
  return (
    <View style={s.sectionTitleRow} wrap={false}>
      <View style={s.sectionPill}>
        <Text style={s.sectionPillText}>{title}</Text>
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

function PdfTable({ table }: { table: SheetTable }) {
  const cellCount = table.blocks.reduce((n, b) => n + Object.values(b.cells).reduce((m, c) => m + c.length, 0), 0)
  return (
    // Tabelas pequenas não são quebradas entre páginas.
    <View style={s.section} wrap={cellCount > 60}>
      <SectionTitle title={table.title} />
      {blockFrames(table.blocks).map((frame, fi) => (
        <View key={frame[0].block.id} style={fi > 0 ? { marginTop: 10 } : {}}>
          {frame[0].block.caption && (
            <View style={s.caption} wrap={false} minPresenceAhead={40}>
              <View style={s.captionBar} />
              <Text style={s.captionText}>{frame[0].block.caption}</Text>
            </View>
          )}
          <View style={s.grid}>
            {frame.map(({ block }, bi) => {
              const groups = columnGroups(block, table.columns)
              return (
                <View key={block.id} style={[s.block, bi > 0 ? s.blockSeparator : {}]} wrap={false}>
                  {groups.map((group, gi) => (
                    // Mesma lógica do editor: colunas do grupo dividem as linhas.
                    <View
                      key={group.cols[0].col.id}
                      style={[
                        s.group,
                        { flex: group.cols.reduce((n, { col }) => n + columnWidth(col), 0) },
                        gi === groups.length - 1 ? { borderRightWidth: 0 } : {},
                      ]}
                    >
                      {Array.from({ length: group.rows }, (_, r) => (
                        <View key={r} style={[s.row, r === group.rows - 1 ? { borderBottomWidth: 0 } : {}]}>
                          {group.cols.map(({ col }, ci) => {
                            const cell = cellsOf(block, col.id)[r]
                            if (!cell) return null
                            const st = effectiveStyle(col, cell)
                            return (
                              <View
                                key={cell.id}
                                style={[
                                  s.cell,
                                  { flex: columnWidth(col), justifyContent: V_ALIGN_FLEX[st.vAlign ?? 'top'] },
                                  ci < group.cols.length - 1 ? { borderRightWidth: 1 } : {},
                                  st.bg
                                    ? { backgroundColor: st.bg }
                                    : isZebraRow(group.rows, r)
                                      ? { backgroundColor: ZEBRA_BG }
                                      : {},
                                ]}
                              >
                                <Text
                                  style={{
                                    color: st.color,
                                    textAlign: st.align ?? 'left',
                                    fontSize: pdfFontSize(st.fontSize),
                                    fontFamily: `Helvetica${st.bold && st.italic ? '-BoldOblique' : st.bold ? '-Bold' : st.italic ? '-Oblique' : ''}`,
                                  }}
                                >
                                  {cell.raw}
                                </Text>
                              </View>
                            )
                          })}
                        </View>
                      ))}
                    </View>
                  ))}
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
}: {
  header: PdfHeader
  content: SheetContent
  orientation: Orientation
}) {
  const generated = new Date().toLocaleDateString('pt-BR')
  return (
    <Document title={header.title}>
      <Page size="A4" orientation={orientation} style={s.page}>
        <View style={s.topBar} fixed />
        <Text style={s.title}>{header.title}</Text>
        {header.details.length > 0 && (
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
        <View style={s.divider} />
        {content.sections.map((sec) =>
          isText(sec) ? <PdfText key={sec.id} section={sec} /> : <PdfTable key={sec.id} table={sec} />,
        )}
        <View style={s.footer} fixed>
          <Text>
            {header.title} · gerado em {generated}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function exportSheetPdf(header: PdfHeader, content: SheetContent, orientation: Orientation) {
  const blob = await pdf(<SheetPdf header={header} content={content} orientation={orientation} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${header.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'planilha'}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
