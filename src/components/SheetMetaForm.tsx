import { Check, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useClients, useCrops, useSaveRow, useSeasons, useVarieties } from '@/lib/api'
import type { Client, SheetMeta } from '@/lib/types'
import { ErrorText, Field, Input, Select, cx } from './ui'

export const emptyMeta = (): SheetMeta => ({ title: '', crop_id: null, variety_id: null, season_id: null, client_ids: [] })

/** Formulário de dados da planilha: título, clientes, cultura, variedade e safra. */
export function SheetMetaForm({ value, onChange }: { value: SheetMeta; onChange: (v: SheetMeta) => void }) {
  const crops = useCrops().data ?? []
  const varieties = (useVarieties().data ?? []).filter((v) => v.crop_id === value.crop_id)
  const seasons = useSeasons().data ?? []
  const set = (patch: Partial<SheetMeta>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-col gap-4">
      <Field label="Título">
        <Input
          autoFocus
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Ex.: Programa de nutrição 2º semestre"
        />
      </Field>
      <Field label="Clientes (opcional)">
        <ClientPicker value={value.client_ids} onChange={(client_ids) => set({ client_ids })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Cultura">
          <Select
            value={value.crop_id ?? ''}
            onChange={(e) => set({ crop_id: e.target.value || null, variety_id: null })}
          >
            <option value="">—</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Variedade">
          <Select
            value={value.variety_id ?? ''}
            disabled={!value.crop_id}
            onChange={(e) => set({ variety_id: e.target.value || null })}
          >
            <option value="">—</option>
            {varieties.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Safra">
          <Select value={value.season_id ?? ''} onChange={(e) => set({ season_id: e.target.value || null })}>
            <option value="">—</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {crops.length === 0 && (
        <p className="text-xs text-slate-500">Cadastre culturas, variedades e safras na aba Cadastros.</p>
      )}
    </div>
  )
}

/** Seleção múltipla de clientes, com busca e cadastro rápido. */
function ClientPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const clients = useClients().data ?? []
  const saveClient = useSaveRow<Client>('clients')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visible = clients.filter((c) => !q || c.name.toLowerCase().includes(q) || c.farm?.toLowerCase().includes(q))
  const exact = clients.some((c) => c.name.toLowerCase() === q)
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const quickCreate = () =>
    saveClient.mutate(
      { name: query.trim() },
      {
        onSuccess: (created) => {
          onChange([...value, created.id])
          setQuery('')
        },
      },
    )

  return (
    <div className="rounded-lg border border-slate-300 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3">
        <Search size={16} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ou cadastrar cliente"
          className="h-10 w-full bg-transparent text-base outline-none md:text-sm"
        />
      </div>
      <ul className="max-h-44 overflow-y-auto py-1">
        {visible.map((c) => {
          const checked = value.includes(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span
                  className={cx(
                    'flex h-4.5 w-4.5 items-center justify-center rounded border',
                    checked ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300',
                  )}
                >
                  {checked && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.farm && <span className="truncate text-slate-500">· {c.farm}</span>}
              </button>
            </li>
          )
        })}
        {q && !exact && (
          <li>
            <button
              type="button"
              onClick={quickCreate}
              disabled={saveClient.isPending}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <Plus size={16} /> Cadastrar “{query.trim()}”
            </button>
          </li>
        )}
        {!q && clients.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Nenhum cliente cadastrado.</li>}
      </ul>
      {saveClient.error && (
        <div className="border-t border-slate-200 p-2">
          <ErrorText error={saveClient.error} />
        </div>
      )}
    </div>
  )
}
