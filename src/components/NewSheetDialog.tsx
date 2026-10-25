import { ChevronRight, LayoutTemplate, Loader2, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateSheet, type NewSheetSource } from '@/lib/api'
import { formatDate, useLookups } from '@/lib/lookups'
import type { SheetSummary } from '@/lib/types'
import { TEMPLATES } from '@/templates'
import { Dialog, ErrorText, Input } from './ui'

const sourceKey = (s: NewSheetSource) => (s.kind === 'template' ? `template:${s.templateId}` : `sheet:${s.sheetId}`)

/** Escolha da origem da planilha nova: modelo pronto ou cópia de uma existente. */
export function NewSheetDialog({ onClose, sheets }: { onClose: () => void; sheets: SheetSummary[] }) {
  const navigate = useNavigate()
  const create = useCreateSheet()
  const names = useLookups()
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const choose = (source: NewSheetSource) => {
    if (create.isPending) return
    setPending(sourceKey(source))
    create.mutate(source, {
      onSuccess: (id) => {
        onClose()
        navigate(`/planilhas/${id}?nova=1`)
      },
      onSettled: () => setPending(null),
    })
  }

  const q = query.trim().toLowerCase()
  const visible = sheets.filter((s) => !q || s.title.toLowerCase().includes(q))

  return (
    <Dialog open onClose={onClose} title="Nova planilha">
      <div className="flex flex-col gap-6">
        <ErrorText error={create.error} />

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Modelos prontos</h3>
          <ul className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <Option
                  icon={<LayoutTemplate size={20} />}
                  title={t.name}
                  subtitle={t.description}
                  loading={pending === `template:${t.id}`}
                  onClick={() => choose({ kind: 'template', templateId: t.id })}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">A partir de uma planilha existente</h3>
          {sheets.length === 0 ? (
            <p className="text-sm text-slate-500">Você ainda não tem planilhas.</p>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar planilha" className="pl-9" />
              </div>
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {visible.map((s) => {
                  const details = [
                    s.client_ids.map((id) => names.clients.get(id)).filter(Boolean).join(', '),
                    s.variety_id && names.varieties.get(s.variety_id),
                    formatDate(s.created_at),
                  ].filter(Boolean)
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => choose({ kind: 'sheet', sheetId: s.id })}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{s.title}</p>
                          <p className="truncate text-xs text-slate-500">{details.join(' · ')}</p>
                        </div>
                        {pending === `sheet:${s.id}` ? (
                          <Loader2 size={16} className="animate-spin text-emerald-700" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-300" />
                        )}
                      </button>
                    </li>
                  )
                })}
                {visible.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-500">Nenhuma planilha encontrada.</li>}
              </ul>
              <p className="text-xs text-slate-500">
                Cria uma cópia independente com as tabelas, a cultura e a variedade. Os clientes ficam em branco.
              </p>
            </>
          )}
        </section>
      </div>
    </Dialog>
  )
}

function Option({
  icon,
  title,
  subtitle,
  loading,
  onClick,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-500/50 hover:bg-slate-50"
    >
      <span className="rounded-lg bg-emerald-100 p-2 text-emerald-800">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-900">{title}</span>
        <span className="block text-sm text-slate-500">{subtitle}</span>
      </span>
      {loading ? <Loader2 size={18} className="animate-spin text-emerald-700" /> : <ChevronRight size={18} className="text-slate-300" />}
    </button>
  )
}
