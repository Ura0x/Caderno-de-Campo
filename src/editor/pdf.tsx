import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { SheetContent, SheetTable } from '@/lib/types'
import { DEFAULT_FONT_SIZE, effectiveStyle } from './model'

export type Orientation = 'portrait' | 'landscape'

export interface PdfHeader {
  title: string
  details: { label: string; value: string }[]
}

const BORDER = '#94a3b8'
const BASE_FONT = 9
// Mantém a proporção do editor: 14px na tela = 9pt no PDF.
const pdfFontSize = (px?: number) => ((px ?? DEFAULT_FONT_SIZE) * BASE_FONT) / DEFAULT_FONT_SIZE

const s = StyleSheet.create({
  page: { padding: 32, fontSize: BASE_FONT, fontFamily: 'Helvetica', color: '#0f172a' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  details: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, color: '#475569' },
  detail: { marginRight: 14, marginBottom: 2 },
  detailLabel: { fontFamily: 'Helvetica-Bold' },
  table: { marginBottom: 18 },
  tableTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  grid: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER },
  column: { flex: 1, flexDirection: 'column', borderRightWidth: 1, borderColor: BORDER },
  cell: { flexGrow: 1, minHeight: 18, paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: BORDER },
  footer: { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 7, color: '#94a3b8', flexDirection: 'row', justifyContent: 'space-between' },
})

function PdfTable({ table }: { table: SheetTable }) {
  const cellCount = table.columns.reduce((n, c) => n + c.cells.length, 0)
  return (
    // Tabelas pequenas não são quebradas entre páginas.
    <View style={s.table} wrap={cellCount > 60}>
      {table.title && <Text style={s.tableTitle}>{table.title}</Text>}
      <View style={s.grid}>
        {table.columns.map((col, ci) => (
          <View key={col.id} style={[s.column, ci === table.columns.length - 1 ? { borderRightWidth: 0 } : {}]}>
            {col.cells.map((cell, i) => {
              const st = effectiveStyle(col, cell)
              return (
                <View
                  key={cell.id}
                  style={[
                    s.cell,
                    i === col.cells.length - 1 ? { borderBottomWidth: 0 } : {},
                    st.bg ? { backgroundColor: st.bg } : {},
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
    </View>
  )
}

function SheetPdf({ header, content, orientation }: { header: PdfHeader; content: SheetContent; orientation: Orientation }) {
  const generated = new Date().toLocaleDateString('pt-BR')
  return (
    <Document title={header.title}>
      <Page size="A4" orientation={orientation} style={s.page}>
        <Text style={s.title}>{header.title}</Text>
        <View style={s.details}>
          {header.details.map((d) => (
            <Text key={d.label} style={s.detail}>
              <Text style={s.detailLabel}>{d.label}: </Text>
              {d.value}
            </Text>
          ))}
        </View>
        {content.tables.map((t) => (
          <PdfTable key={t.id} table={t} />
        ))}
        <View style={s.footer} fixed>
          <Text>{header.title} · gerado em {generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
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
