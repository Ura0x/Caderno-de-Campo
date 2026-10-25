import { Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cx } from '@/components/ui'
import type { Block, Cell, Column, SheetTable } from '@/lib/types'
import {
  V_ALIGN_FLEX,
  ZEBRA_BG,
  blockFrames,
  canRemoveLine,
  cellsOf,
  columnGroups,
  columnName,
  columnWidth,
  effectiveStyle,
  isZebraRow,
  ops,
  type Selection,
} from './model'
import { useEditor } from './store'

/** Largura mínima (px) de uma coluna de largura 1; abaixo disso a tabela rola na horizontal. */
const COLUMN_MIN_WIDTH = 120

export function TableView({ table }: { table: SheetTable }) {
  const apply = useEditor((s) => s.apply)
  // Bloco onde está a célula selecionada (se for desta tabela).
  const activeBlockId = useEditor((s) => (s.selection?.tableId === table.id ? s.selection.blockId : null))
  const canRemove = useEditor((s) => s.selection?.tableId === table.id && canRemoveLine(s.content, s.selection))

  const removeTable = () => {
    if (confirm(`Excluir a tabela “${table.title || 'sem título'}”?`)) apply((d) => ops.removeSection(d, table.id))
  }

  const frames = blockFrames(table.blocks)

  // Numeração contínua das linhas de cada coluna ao longo dos blocos.
  const offsets = new Map<string, number>()
  const blockOffsets = table.blocks.map((b) => {
    const start = Object.fromEntries(table.columns.map((c) => [c.id, offsets.get(c.id) ?? 0]))
    for (const c of table.columns) offsets.set(c.id, (offsets.get(c.id) ?? 0) + cellsOf(b, c.id).length)
    return start
  })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-1 border-b border-slate-100 py-2 pr-2 pl-2">
        <input
          value={table.title}
          onChange={(e) => apply((d) => ops.setTitle(d, table.id, e.target.value), `title:${table.id}`)}
          placeholder="Título da tabela"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-base font-bold text-slate-900 outline-none focus:bg-slate-50 md:text-lg"
        />
        <button
          onClick={removeTable}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Excluir tabela"
          title="Excluir tabela"
        >
          <Trash2 size={18} />
        </button>
      </header>

      <div className="overflow-x-auto p-3">
        <div
          className="flex w-full flex-col gap-4"
          style={{
            minWidth: table.columns.reduce((n, c) => n + columnWidth(c), 0) * COLUMN_MIN_WIDTH,
          }}
        >
          {frames.map((frame, fi) => (
            <div key={frame[0].block.id}>
              <FrameCaption
                tableId={table.id}
                block={frame[0].block}
                active={frame.some((x) => x.block.id === activeBlockId)}
              />
              <div className="overflow-hidden rounded-md border border-slate-300">
                {fi === 0 && (
                  <div className="flex border-b border-slate-300">
                    {table.columns.map((col, i) => (
                      <ColumnHeader key={col.id} col={col} name={columnName(i)} />
                    ))}
                  </div>
                )}
                {frame.map(({ block, index }, i) => (
                  <BlockView
                    key={block.id}
                    table={table}
                    block={block}
                    offsets={blockOffsets[index]}
                    separated={i > 0}
                  />
                ))}
              </div>
              {frames.length > 1 && frame.some((x) => x.block.id === activeBlockId) && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() =>
                      confirm('Excluir este quadro e tudo o que está nele?') &&
                      apply((d) =>
                        ops.removeFrame(d, {
                          tableId: table.id,
                          blockId: frame[0].block.id,
                        }),
                      )
                    }
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} /> Excluir quadro
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 px-3 pb-3">
        <FooterButton
          onClick={() => apply((d) => ops.addProduct(d, table.id, useEditor.getState().selection))}
          title={activeBlockId ? 'Adiciona logo abaixo da linha selecionada' : 'Adiciona no fim do último quadro'}
        >
          <Plus size={16} /> Produto
        </FooterButton>
        <FooterButton
          onClick={() => {
            const sel = useEditor.getState().selection
            if (sel && confirm('Excluir esta linha (produto e dose)?')) apply((d) => ops.removeLine(d, sel))
          }}
          disabled={!canRemove}
          title={canRemove ? 'Exclui a linha selecionada' : 'Clique num produto ou dose para excluir a linha'}
          danger
        >
          <Minus size={16} /> Excluir linha
        </FooterButton>
        <FooterButton
          onClick={() => apply((d) => void ops.addFrame(d, table.id, activeBlockId ?? undefined))}
          title="Novo quadro separado, repetindo o cabeçalho (ex.: mais um período)"
        >
          <Plus size={16} /> Quadro
        </FooterButton>
      </footer>
    </section>
  )
}

function FooterButton({
  onClick,
  title,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  title?: string
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium disabled:opacity-35',
        danger ? 'text-red-600 enabled:hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50',
      )}
    >
      {children}
    </button>
  )
}

/** Legenda acima do quadro: aparece se tiver texto ou se o quadro estiver em edição. */
function FrameCaption({ tableId, block, active }: { tableId: string; block: Block; active: boolean }) {
  const apply = useEditor((s) => s.apply)
  const [focused, setFocused] = useState(false)
  if (!block.caption && !active && !focused) return null
  return (
    <div className="mb-1.5 flex items-start gap-2">
      <span className="mt-1.5 h-4 w-1 shrink-0 rounded-full bg-emerald-600" />
      <textarea
        rows={1}
        value={block.caption ?? ''}
        onChange={(e) =>
          apply(
            (d) => ops.setCaption(d, { tableId, blockId: block.id }, e.target.value.replace(/\n/g, ' ')),
            `caption:${block.id}`,
          )
        }
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Adicionar legenda acima do quadro…"
        className="field-sizing-content min-w-0 flex-1 resize-none rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-emerald-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:bg-emerald-50/60 md:text-base"
      />
    </div>
  )
}

/** Letra da coluna (A, B, C…), só para identificação. */
function ColumnHeader({ col, name }: { col: Column; name: string }) {
  return (
    <div
      style={{ flex: `${columnWidth(col)} 1 0%` }}
      className="flex h-6 min-w-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 last:border-r-0"
    >
      {name}
    </div>
  )
}

function BlockView({
  table,
  block,
  offsets,
  separated,
}: {
  table: SheetTable
  block: Block
  offsets: Record<string, number>
  separated: boolean
}) {
  const groups = columnGroups(block, table.columns)

  return (
    <div className={cx('flex items-stretch', separated && 'border-t-2 border-slate-400')}>
      {groups.map((group, gi) => {
        const template = group.cols.map(({ col }) => `minmax(0, ${columnWidth(col)}fr)`).join(' ')
        const weight = group.cols.reduce((n, { col }) => n + columnWidth(col), 0)
        return (
          <div
            key={group.cols[0].col.id}
            className={cx('flex min-w-0 flex-col', gi < groups.length - 1 && 'border-r border-slate-300')}
            style={{ flex: `${weight} 1 0%` }}
          >
            {/* Colunas do grupo dividem as mesmas linhas; as linhas esticam para ocupar a altura do bloco. */}
            <div
              className="grid grow"
              style={{
                gridTemplateColumns: template,
                gridTemplateRows: `repeat(${group.rows}, auto)`,
                gridAutoFlow: 'column',
              }}
            >
              {group.cols.flatMap(({ col, index }, ci) =>
                cellsOf(block, col.id).map((cell, i) => (
                  <CellView
                    key={cell.id}
                    at={{
                      tableId: table.id,
                      blockId: block.id,
                      colId: col.id,
                      cellIndex: i,
                    }}
                    col={col}
                    cell={cell}
                    number={offsets[col.id] + i + 1}
                    name={columnName(index)}
                    rowGroup={group.cols.length > 1 ? group.cols.map((c) => c.col.id) : [col.id]}
                    zebra={isZebraRow(group.rows, i)}
                    borderBottom={i < group.rows - 1}
                    borderRight={ci < group.cols.length - 1}
                  />
                )),
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CellView({
  at,
  col,
  cell,
  number,
  name,
  rowGroup,
  zebra,
  borderBottom,
  borderRight,
}: {
  at: Selection
  col: Column
  cell: Cell
  number: number
  name: string
  /** Colunas que formam a "linha" desta célula (grupo alinhado). */
  rowGroup: string[]
  /** Linha alternada de uma lista (fundo sutil, se a célula não tiver cor própria). */
  zebra: boolean
  borderBottom: boolean
  borderRight: boolean
}) {
  const apply = useEditor((s) => s.apply)
  const select = useEditor((s) => s.select)
  // Retorna string para evitar re-render de todas as células a cada mudança de seleção.
  const mark = useEditor((s) => {
    const sel = s.selection
    if (!sel || sel.tableId !== at.tableId) return ''
    const sameBlock = sel.blockId === at.blockId
    if (sameBlock && sel.colId === at.colId && sel.cellIndex === at.cellIndex) return 'selected'
    if (s.scope === 'column' && sel.colId === at.colId) return 'scope'
    if (s.scope === 'row' && sameBlock && sel.cellIndex === at.cellIndex && rowGroup.includes(sel.colId)) return 'scope'
    return ''
  })
  const ref = useRef<HTMLTextAreaElement>(null)
  const style = effectiveStyle(col, cell)

  return (
    <div
      className={cx(
        'relative flex min-h-9 cursor-text border-slate-200',
        borderBottom && 'border-b',
        borderRight && 'border-r',
        mark === 'selected' && 'z-[1] outline-2 -outline-offset-2 outline-emerald-600',
        mark === 'scope' && 'z-[1] outline-2 -outline-offset-2 outline-emerald-400 outline-dashed',
      )}
      style={{
        backgroundColor: style.bg ?? (zebra ? ZEBRA_BG : undefined),
        alignItems: V_ALIGN_FLEX[style.vAlign ?? 'top'],
      }}
      title={`${name}${number}`}
      onMouseDown={(e) => {
        if (e.target !== ref.current) {
          e.preventDefault()
          ref.current?.focus()
        }
      }}
    >
      <span
        className="pointer-events-none absolute top-0.5 right-1 text-[10px] leading-none font-medium opacity-40 select-none"
        style={{ color: style.color }}
      >
        {number}
      </span>
      <AutoTextarea
        ref={ref}
        value={cell.raw}
        onChange={(raw) => apply((d) => ops.setCell(d, at, raw), `cell:${cell.id}`)}
        onFocus={() => select(at)}
        style={{
          color: style.color,
          fontWeight: style.bold ? 700 : undefined,
          fontSize: style.fontSize,
          fontStyle: style.italic ? 'italic' : undefined,
          textAlign: style.align,
          // Compensa o espaço do número da linha (pr-6) para o centro ficar no meio.
          paddingLeft: style.align === 'center' ? '1.5rem' : undefined,
        }}
      />
    </div>
  )
}

function AutoTextarea({
  ref,
  value,
  onChange,
  onFocus,
  style,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (v: string) => void
  onFocus: () => void
  style: React.CSSProperties
}) {
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useLayoutEffect(fit, [value, style.fontWeight, style.fontSize])

  // Reajusta a altura quando a largura muda (janela redimensionada, coluna nova).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth
        fit()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      style={style}
      className="block w-full resize-none overflow-hidden bg-transparent py-1.5 pr-6 pl-2 text-base leading-snug text-slate-900 outline-none md:text-sm"
    />
  )
}
