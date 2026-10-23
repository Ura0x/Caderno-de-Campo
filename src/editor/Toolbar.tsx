import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Eraser,
  Italic,
  Minus,
  Plus,
  PaintBucket,
  Redo2,
  Rows3,
  Type,
  Undo2,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cx } from '@/components/ui'
import type { Align, CellStyle } from '@/lib/types'
import { DEFAULT_FONT_SIZE, FONT_SIZES, effectiveStyle, ops, resolve, stepFontSize, type Scope } from './model'
import { useEditor } from './store'

const BG_COLORS = ['#ffffff', '#f1f5f9', '#e2e8f0', '#fef9c3', '#fde68a', '#fed7aa', '#fecaca', '#fbcfe8', '#e9d5ff', '#bfdbfe', '#a5f3fc', '#bbf7d0', '#d9f99d', '#047857', '#1e3a8a', '#0f172a']
const TEXT_COLORS = ['#0f172a', '#475569', '#94a3b8', '#ffffff', '#b91c1c', '#c2410c', '#a16207', '#4d7c0f', '#047857', '#0e7490', '#1d4ed8', '#7e22ce', '#be185d']

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'cell', label: 'Célula' },
  { value: 'row', label: 'Linha' },
  { value: 'column', label: 'Coluna' },
]

/** Barra de edição: no PC fica fixa no topo, no celular fica presa embaixo da tela. */
export function Toolbar() {
  const content = useEditor((s) => s.content)
  const selection = useEditor((s) => s.selection)
  const scope = useEditor((s) => s.scope)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const { apply, undo, redo, setScope } = useEditor.getState()
  const [palette, setPalette] = useState<'bg' | 'color' | null>(null)

  const target = useMemo(() => resolve(content, selection), [content, selection])
  const current: CellStyle = target ? effectiveStyle(target.col, target.cell) : {}
  const off = !target

  const style = (patch: CellStyle) => selection && apply((d) => ops.applyStyle(d, selection, scope, patch))
  const fontSize = current.fontSize ?? DEFAULT_FONT_SIZE
  const setFontSize = (size: number) => style({ fontSize: size === DEFAULT_FONT_SIZE ? undefined : size })
  const run = (fn: (sel: NonNullable<typeof selection>) => void) => () => selection && target && fn(selection)

  return (
    <div
      // Mantém o foco na célula ao clicar nos botões.
      onMouseDown={(e) => (e.target as HTMLElement).tagName !== 'INPUT' && e.preventDefault()}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:sticky md:top-14 md:bottom-auto md:rounded-b-xl md:border md:border-t-0 md:pb-0 md:shadow-sm"
    >
      {palette && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2 md:order-last md:border-t md:border-b-0">
          <span className="mr-1 text-xs font-medium text-slate-500">{palette === 'bg' ? 'Fundo' : 'Texto'}</span>
          {(palette === 'bg' ? BG_COLORS : TEXT_COLORS).map((c) => (
            <button
              key={c}
              onClick={() => style(palette === 'bg' ? { bg: c } : { color: c })}
              className="h-7 w-7 rounded-md border border-slate-300 shadow-sm"
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
          <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-md border border-dashed border-slate-400 bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" title="Outra cor">
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => style(palette === 'bg' ? { bg: e.target.value } : { color: e.target.value })}
            />
          </label>
          <button
            onClick={() => style(palette === 'bg' ? { bg: undefined } : { color: undefined })}
            className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Sem cor
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
        <Tool label="Desfazer" onClick={undo} disabled={!canUndo}>
          <Undo2 size={18} />
        </Tool>
        <Tool label="Refazer" onClick={redo} disabled={!canRedo}>
          <Redo2 size={18} />
        </Tool>
        <Sep />

        <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" title="Onde aplicar a formatação">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={cx(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                scope === s.value ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center rounded-lg border border-slate-200" title="Tamanho da letra">
          <Tool label="Diminuir letra" disabled={off || fontSize <= FONT_SIZES[0]} onClick={() => setFontSize(stepFontSize(fontSize, -1))}>
            <Minus size={16} />
          </Tool>
          <span className={cx('w-6 text-center text-sm font-medium tabular-nums', off ? 'text-slate-300' : 'text-slate-700')}>{fontSize}</span>
          <Tool label="Aumentar letra" disabled={off || fontSize >= FONT_SIZES.at(-1)!} onClick={() => setFontSize(stepFontSize(fontSize, 1))}>
            <Plus size={16} />
          </Tool>
        </div>
        <Tool label="Negrito" disabled={off} active={current.bold} onClick={() => style({ bold: current.bold ? undefined : true })}>
          <Bold size={18} />
        </Tool>
        <Tool label="Itálico" disabled={off} active={current.italic} onClick={() => style({ italic: current.italic ? undefined : true })}>
          <Italic size={18} />
        </Tool>
        {(['left', 'center', 'right'] as Align[]).map((a) => {
          const Icon = { left: AlignLeft, center: AlignCenter, right: AlignRight }[a]
          const name = { left: 'à esquerda', center: 'ao centro', right: 'à direita' }[a]
          return (
            <Tool key={a} label={`Alinhar ${name}`} disabled={off} active={(current.align ?? 'left') === a && !off} onClick={() => style({ align: a === 'left' ? undefined : a })}>
              <Icon size={18} />
            </Tool>
          )
        })}
        <Tool label="Cor de fundo" disabled={off} active={palette === 'bg'} onClick={() => setPalette(palette === 'bg' ? null : 'bg')}>
          <PaintBucket size={18} />
          <ColorBar color={current.bg} />
        </Tool>
        <Tool label="Cor do texto" disabled={off} active={palette === 'color'} onClick={() => setPalette(palette === 'color' ? null : 'color')}>
          <Type size={18} />
          <ColorBar color={current.color} />
        </Tool>
        <Tool label="Limpar formatação" disabled={off} onClick={run((sel) => apply((d) => ops.clearStyle(d, sel, scope)))}>
          <Eraser size={18} />
        </Tool>
        <Sep />

        <Group icon={<Rows3 size={16} />} label="Célula">
          <TextTool disabled={off} onClick={run((sel) => apply((d) => ops.insertCell(d, sel.tableId, sel.colId, sel.cellIndex + 1)))}>+ abaixo</TextTool>
          <TextTool disabled={off || target.col.cells.length < 2} onClick={run((sel) => apply((d) => ops.removeCell(d, sel.tableId, sel.colId, sel.cellIndex)))}>Excluir</TextTool>
        </Group>
        <Group icon={<Rows3 size={16} />} label="Linha">
          <TextTool disabled={off} onClick={run((sel) => apply((d) => ops.addRow(d, sel.tableId, sel.cellIndex)))}>+ abaixo</TextTool>
          <TextTool disabled={off} onClick={run((sel) => apply((d) => ops.removeRow(d, sel.tableId, sel.cellIndex)))}>Excluir</TextTool>
        </Group>
        <Group icon={<Columns3 size={16} />} label="Coluna">
          <TextTool disabled={off} onClick={run((sel) => apply((d) => void ops.addColumn(d, sel.tableId, sel.colId)))}>+ à direita</TextTool>
          <TextTool disabled={off || target.table.columns.length < 2} onClick={run((sel) => apply((d) => ops.removeColumn(d, sel.tableId, sel.colId)))}>Excluir</TextTool>
        </Group>
      </div>
    </div>
  )
}

function Tool({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'relative flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30',
        active && 'bg-emerald-50 text-emerald-800',
      )}
    >
      {children}
    </button>
  )
}

const ColorBar = ({ color }: { color?: string }) => (
  <span className="absolute bottom-1 h-1 w-5 rounded-full border border-slate-200" style={{ backgroundColor: color ?? 'transparent' }} />
)

function Group({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 pl-2">
      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </span>
      {children}
    </div>
  )
}

const TextTool = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) => (
  <button onClick={onClick} disabled={disabled} className="h-8 rounded-md px-2 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100 disabled:opacity-30">
    {children}
  </button>
)

const Sep = () => <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
