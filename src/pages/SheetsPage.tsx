import { CalendarDays, FileSpreadsheet, Plus, Search, SlidersHorizontal, UserX, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NewSheetDialog } from '@/components/NewSheetDialog'
import { Button, EmptyState, ErrorText, Field, Input, PageLoader, Select, cx } from '@/components/ui'
import { useClients, useCrops, useSheets, useVarieties } from '@/lib/api'
import { formatDate, useLookups } from '@/lib/lookups'
import type { SheetSummary } from '@/lib/types'

interface Filters {
  q: string
  client: string
  /** Só planilhas sem nenhum cliente vinculado. */
  noClient: boolean
  crop: string
  variety: string
  from: string
  to: string
}

const noFilters: Filters = { q: '', client: '', noClient: false, crop: '', variety: '', from: '', to: '' }

function matches(s: SheetSummary, f: Filters) {
  const day = s.created_at.slice(0, 10)
  return (
    (!f.q || s.title.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.client || s.client_ids.includes(f.client)) &&
    (!f.noClient || s.client_ids.length === 0) &&
    (!f.crop || s.crop_id === f.crop) &&
    (!f.variety || s.variety_id === f.variety) &&
    (!f.from || day >= f.from) &&
    (!f.to || day <= f.to)
  )
}

export function SheetsPage() {
  const sheets = useSheets()
  const [filters, setFilters] = useState(noFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [creating, setCreating] = useState(false)

  const visible = useMemo(() => (sheets.data ?? []).filter((s) => matches(s, filters)), [sheets.data, filters])
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'q' && k !== 'noClient' && v).length
  const withoutClient = (sheets.data ?? []).filter((s) => s.client_ids.length === 0).length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Planilhas</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={18} /> Nova planilha
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Buscar por título"
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowFilters((v) => !v)} className={cx(showFilters && 'bg-slate-100')}>
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filtros</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-emerald-700 px-1.5 text-xs text-white">{activeCount}</span>
            )}
          </Button>
        </div>
        {withoutClient > 0 && (
          <div>
            <button
              onClick={() => setFilters({ ...filters, noClient: !filters.noClient, client: '' })}
              aria-pressed={filters.noClient}
              className={cx(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                filters.noClient
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100',
              )}
            >
              <UserX size={15} />
              Sem cliente
              <span className={cx('rounded-full px-1.5 text-xs', filters.noClient ? 'bg-white/25' : 'bg-orange-200/70')}>
                {withoutClient}
              </span>
              {filters.noClient && <X size={14} />}
            </button>
          </div>
        )}
        {showFilters && <FilterPanel filters={filters} onChange={setFilters} />}
      </div>

      {sheets.isPending ? (
        <PageLoader />
      ) : sheets.error ? (
        <ErrorText error={sheets.error} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet size={24} />} title={sheets.data.length ? 'Nenhuma planilha encontrada' : 'Nenhuma planilha ainda'}>
          {sheets.data.length ? 'Ajuste os filtros para ver mais resultados.' : 'Crie a primeira planilha pelo botão “Nova planilha”.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <SheetCard key={s.id} sheet={s} />
          ))}
        </ul>
      )}

      {creating && <NewSheetDialog onClose={() => setCreating(false)} sheets={sheets.data ?? []} />}
    </div>
  )
}

function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const clients = useClients().data ?? []
  const crops = useCrops().data ?? []
  const varieties = (useVarieties().data ?? []).filter((v) => !filters.crop || v.crop_id === filters.crop)
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 md:grid-cols-3 lg:grid-cols-5">
      <Field label="Cliente">
        <Select value={filters.client} onChange={(e) => set({ client: e.target.value, noClient: false })}>
          <option value="">Todos</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Cultura">
        <Select value={filters.crop} onChange={(e) => set({ crop: e.target.value, variety: '' })}>
          <option value="">Todas</option>
          {crops.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Variedade">
        <Select value={filters.variety} onChange={(e) => set({ variety: e.target.value })}>
          <option value="">Todas</option>
          {varieties.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Criada de">
        <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
      </Field>
      <Field label="Criada até">
        <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
      </Field>
      <div className="col-span-full flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...noFilters, q: filters.q })}>
          <X size={14} /> Limpar filtros
        </Button>
      </div>
    </div>
  )
}

function SheetCard({ sheet }: { sheet: SheetSummary }) {
  const names = useLookups()
  const clientNames = sheet.client_ids.map((id) => names.clients.get(id)).filter(Boolean)
  const crop = sheet.crop_id && names.crops.get(sheet.crop_id)
  const variety = sheet.variety_id && names.varieties.get(sheet.variety_id)

  return (
    <li>
      <Link
        to={`/planilhas/${sheet.id}`}
        className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-600/40 hover:shadow-md"
      >
        <h2 className="line-clamp-2 font-semibold text-slate-900">{sheet.title}</h2>
        <div className="flex flex-wrap gap-1.5 text-xs font-medium">
          {crop && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{crop}</span>}
          {variety && <span className="rounded-full bg-lime-50 px-2 py-0.5 text-lime-800">{variety}</span>}
        </div>
        <div className="mt-auto flex flex-col gap-1 text-sm text-slate-500">
          {clientNames.length ? (
            <span className="flex items-center gap-1.5">
              <Users size={14} className="shrink-0" />
              <span className="truncate">{clientNames.join(', ')}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-orange-600">
              <UserX size={14} className="shrink-0" /> Sem cliente
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} /> Criada em {formatDate(sheet.created_at)}
          </span>
        </div>
      </Link>
    </li>
  )
}
