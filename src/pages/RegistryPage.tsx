import { Pencil, Plus, Sprout, Trash2, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, EmptyState, ErrorText, Field, Input, PageLoader, Textarea, cx } from '@/components/ui'
import { useClients, useCrops, useDeleteRow, useSaveRow, useVarieties } from '@/lib/api'
import type { Client, Crop, Variety } from '@/lib/types'

const TABS = [
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'crops', label: 'Culturas', icon: Sprout },
] as const

type Tab = (typeof TABS)[number]['id']

export function RegistryPage() {
  const [tab, setTab] = useState<Tab>('clients')

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-slate-900">Cadastros</h1>
      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 sm:w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium',
              tab === id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600',
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {tab === 'clients' && <ClientsTab />}
      {tab === 'crops' && <CropsTab />}
    </div>
  )
}

const confirmDelete = (what: string) => confirm(`Excluir ${what}?`)

// Clientes -------------------------------------------------------------------

type ClientForm = Pick<Client, 'name' | 'farm' | 'city' | 'phone' | 'notes'> & { id?: string }
const emptyClient: ClientForm = { name: '', farm: '', city: '', phone: '', notes: '' }

function ClientsTab() {
  const clients = useClients()
  const remove = useDeleteRow('clients')
  const [editing, setEditing] = useState<ClientForm | null>(null)

  if (clients.isPending) return <PageLoader />

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="primary" onClick={() => setEditing(emptyClient)}>
          <Plus size={18} /> Novo cliente
        </Button>
      </div>
      <ErrorText error={clients.error ?? remove.error} />
      {clients.data?.length === 0 ? (
        <EmptyState icon={<Users size={24} />} title="Nenhum cliente cadastrado" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {clients.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{c.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {[c.farm, c.city, c.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="Editar">
                <Pencil size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir"
                className="hover:text-red-600"
                onClick={() => confirmDelete(`o cliente “${c.name}”`) && remove.mutate(c.id)}
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <ClientDialog initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ClientDialog({ initial, onClose }: { initial: ClientForm; onClose: () => void }) {
  const save = useSaveRow<Client>('clients')
  const [form, setForm] = useState(initial)
  const set = (patch: Partial<ClientForm>) => setForm({ ...form, ...patch })

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const { id, name, farm, city, phone, notes } = form
    await save.mutateAsync({ id, name: name.trim(), farm: farm || null, city: city || null, phone: phone || null, notes: notes || null })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={form.id ? 'Editar cliente' : 'Novo cliente'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => submit()} disabled={!form.name.trim() || save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome">
          <Input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fazenda">
            <Input value={form.farm ?? ''} onChange={(e) => set({ farm: e.target.value })} />
          </Field>
          <Field label="Cidade">
            <Input value={form.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
          </Field>
        </div>
        <Field label="Telefone">
          <Input type="tel" value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Observações">
          <Textarea value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <ErrorText error={save.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

// Culturas e variedades -------------------------------------------------------

function CropsTab() {
  const crops = useCrops()
  const varieties = useVarieties()
  const saveCrop = useSaveRow<Crop>('crops')
  const removeCrop = useDeleteRow('crops')
  const [name, setName] = useState('')

  if (crops.isPending || varieties.isPending) return <PageLoader />

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await saveCrop.mutateAsync({ name: name.trim() })
    setName('')
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} className="flex gap-2 sm:max-w-md">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova cultura (ex.: Uva, Manga)" />
        <Button type="submit" variant="primary" disabled={!name.trim() || saveCrop.isPending}>
          <Plus size={18} /> Adicionar
        </Button>
      </form>
      <ErrorText error={crops.error ?? saveCrop.error ?? removeCrop.error} />
      {crops.data?.length === 0 ? (
        <EmptyState icon={<Sprout size={24} />} title="Nenhuma cultura cadastrada" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {crops.data?.map((crop) => (
            <CropCard
              key={crop.id}
              crop={crop}
              varieties={(varieties.data ?? []).filter((v) => v.crop_id === crop.id)}
              onDelete={() => confirmDelete(`a cultura “${crop.name}” e suas variedades`) && removeCrop.mutate(crop.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CropCard({ crop, varieties, onDelete }: { crop: Crop; varieties: Variety[]; onDelete: () => void }) {
  const save = useSaveRow<Variety>('varieties')
  const remove = useDeleteRow('varieties')
  const [name, setName] = useState('')

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await save.mutateAsync({ crop_id: crop.id, name: name.trim() })
    setName('')
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{crop.name}</h3>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Excluir cultura" className="hover:text-red-600">
          <Trash2 size={16} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {varieties.length === 0 && <span className="text-sm text-slate-400">Nenhuma variedade</span>}
        {varieties.map((v) => (
          <span key={v.id} className="flex items-center gap-1 rounded-full bg-emerald-50 py-1 pr-1 pl-3 text-sm text-emerald-800">
            {v.name}
            <button
              onClick={() => confirmDelete(`a variedade “${v.name}”`) && remove.mutate(v.id)}
              className="rounded-full p-0.5 hover:bg-emerald-100"
              aria-label={`Excluir ${v.name}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova variedade" className="h-9" />
        <Button type="submit" size="sm" className="h-9" disabled={!name.trim() || save.isPending}>
          <Plus size={16} />
        </Button>
      </form>
      <ErrorText error={save.error ?? remove.error} />
    </li>
  )
}
