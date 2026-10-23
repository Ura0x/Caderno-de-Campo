import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { cx } from '@/components/ui'
import type { Cell, Column, SheetTable } from '@/lib/types'
import { columnName, effectiveStyle, ops } from './model'
import { useEditor } from './store'

const COLUMN_MIN_WIDTH = 140

export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

export function TableView({ table }: { table: SheetTable }) {
  const apply = useEditor((s) => s.apply)
  const sensors = useDndSensors()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: table.id,
  })

  const onColumnDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) apply((d) => ops.moveColumn(d, table.id, String(active.id), String(over.id)))
  }

  const removeTable = () => {
    if (confirm(`Excluir a tabela “${table.title || 'sem título'}”?`)) apply((d) => ops.removeTable(d, table.id))
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        isDragging && 'relative z-20 shadow-xl ring-2 ring-emerald-600/30',
      )}
    >
      <header className="flex items-center gap-1 border-b border-slate-100 py-2 pr-2 pl-1">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded-md p-1.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
          aria-label="Arrastar tabela"
        >
          <GripVertical size={18} />
        </button>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onColumnDragEnd}>
          <SortableContext items={table.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div
              className="flex w-full items-stretch overflow-hidden rounded-md border border-slate-300"
              style={{ minWidth: table.columns.length * COLUMN_MIN_WIDTH }}
            >
              {table.columns.map((col, i) => (
                <ColumnView key={col.id} tableId={table.id} col={col} name={columnName(i)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <footer className="flex flex-wrap gap-2 px-3 pb-3">
        <button
          onClick={() => apply((d) => ops.addRow(d, table.id))}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <Plus size={16} /> Linha em todas as colunas
        </button>
        <button
          onClick={() => apply((d) => void ops.addColumn(d, table.id))}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <Plus size={16} /> Coluna
        </button>
      </footer>
    </section>
  )
}

function ColumnView({ tableId, col, name }: { tableId: string; col: Column; name: string }) {
  const apply = useEditor((s) => s.apply)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        'flex min-w-0 flex-1 basis-0 flex-col border-r border-slate-300 bg-white last:border-r-0',
        isDragging && 'relative z-10 opacity-90 shadow-lg',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="group flex h-6 cursor-grab touch-none items-center justify-center gap-1 border-b border-slate-200 bg-slate-50 active:cursor-grabbing"
        aria-label={`Coluna ${name} (arrastar para mover)`}
      >
        <span className="text-xs font-semibold text-slate-500">{name}</span>
        <GripHorizontal size={14} className="text-slate-300 group-hover:text-slate-500" />
      </button>
      <div className="flex grow flex-col">
        {col.cells.map((cell, i) => (
          <CellView key={cell.id} tableId={tableId} col={col} cell={cell} index={i} label={`${name}${i + 1}`} />
        ))}
      </div>
      <button
        onClick={() => apply((d) => ops.insertCell(d, tableId, col.id, col.cells.length))}
        className="flex h-6 items-center justify-center gap-0.5 border-t border-slate-200 text-xs text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
        title="Adicionar célula nesta coluna"
      >
        <Plus size={12} /> célula
      </button>
    </div>
  )
}

function CellView({
  tableId,
  col,
  cell,
  index,
  label,
}: {
  tableId: string
  col: Column
  cell: Cell
  index: number
  label: string
}) {
  const apply = useEditor((s) => s.apply)
  const select = useEditor((s) => s.select)
  // Retorna string para evitar re-render de todas as células a cada mudança de seleção.
  const mark = useEditor((s) => {
    const sel = s.selection
    if (!sel || sel.tableId !== tableId) return ''
    if (sel.colId === col.id && sel.cellIndex === index) return 'selected'
    if (s.scope === 'column' && sel.colId === col.id) return 'scope'
    if (s.scope === 'row' && sel.cellIndex === index) return 'scope'
    return ''
  })
  const ref = useRef<HTMLTextAreaElement>(null)
  const style = effectiveStyle(col, cell)

  return (
    <div
      className={cx(
        'relative flex min-h-9 grow cursor-text border-b border-slate-200 last:border-b-0',
        mark === 'selected' && 'z-[1] outline-2 -outline-offset-2 outline-emerald-600',
        mark === 'scope' && 'z-[1] outline-2 -outline-offset-2 outline-emerald-400 outline-dashed',
      )}
      style={{ backgroundColor: style.bg }}
      title={label}
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
        {index + 1}
      </span>
      <AutoTextarea
        ref={ref}
        value={cell.raw}
        onChange={(raw) => apply((d) => ops.setCell(d, tableId, col.id, index, raw), `cell:${cell.id}`)}
        onFocus={() => select({ tableId, colId: col.id, cellIndex: index })}
        style={{
          color: style.color,
          fontWeight: style.bold ? 700 : undefined,
          fontSize: style.fontSize,
          fontStyle: style.italic ? 'italic' : undefined,
          textAlign: style.align,
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
