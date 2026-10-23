import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, Check, CloudOff, Copy, FileDown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { SheetMetaForm } from '@/components/SheetMetaForm'
import { Button, Dialog, ErrorText, Field, PageLoader, cx } from '@/components/ui'
import { createSheet, saveSheetContent, useDeleteSheet, useSheet, useUpdateSheetMeta } from '@/lib/api'
import { formatDate, useLookups } from '@/lib/lookups'
import type { Sheet, SheetMeta } from '@/lib/types'
import { ops } from '@/editor/model'
import type { Orientation } from '@/editor/pdf'
import { useEditor } from '@/editor/store'
import { TableView, useDndSensors } from '@/editor/TableView'
import { Toolbar } from '@/editor/Toolbar'

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

export function SheetEditorPage() {
  const { id = '' } = useParams()
  const sheet = useSheet(id)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    if (sheet.data && loadedId !== id) {
      useEditor.getState().load(sheet.data.content)
      setLoadedId(id)
    }
  }, [sheet.data, id, loadedId])

  if (sheet.error) return <ErrorText error={sheet.error} />
  if (!sheet.data || loadedId !== id) return <PageLoader />
  return <Editor sheet={sheet.data} />
}

function useAutosave(sheetId: string) {
  const qc = useQueryClient()
  const version = useEditor((s) => s.version)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const savedVersion = useRef(0)
  const chain = useRef(Promise.resolve())

  const save = useCallback(() => {
    // Captura o conteúdo agora: ao sair da página o store pode receber outra planilha
    // antes do salvamento rodar. Os salvamentos são encadeados para que uma resposta
    // antiga nunca sobrescreva uma nova.
    const { content, version } = useEditor.getState()
    chain.current = chain.current.then(async () => {
      if (version === savedVersion.current) return
      setStatus('saving')
      try {
        await saveSheetContent(sheetId, content)
        savedVersion.current = version
        setStatus(useEditor.getState().version === version ? 'saved' : 'pending')
      } catch {
        setStatus('error')
      }
    })
    return chain.current
  }, [sheetId])

  useEffect(() => {
    if (version === savedVersion.current) return
    setStatus('pending')
    const t = setTimeout(save, 1000)
    return () => clearTimeout(t)
  }, [version, save])

  // Salva o que faltar ao sair da página e avisa se fechar a aba com algo pendente.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().version !== savedVersion.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      save().then(() => qc.invalidateQueries({ queryKey: ['sheets'] }))
    }
  }, [save, qc])

  return { status, retry: save }
}

function Editor({ sheet }: { sheet: Sheet }) {
  const tables = useEditor((s) => s.content.tables)
  const apply = useEditor((s) => s.apply)
  const sensors = useDndSensors()
  const { status, retry } = useAutosave(sheet.id)
  const [dialog, setDialog] = useState<'edit' | 'duplicate' | 'pdf' | null>(null)
  const names = useLookups()
  const navigate = useNavigate()
  const deleteSheet = useDeleteSheet()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      const { undo, redo } = useEditor.getState()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) apply((d) => ops.moveTable(d, String(active.id), String(over.id)))
  }

  const remove = async () => {
    if (!confirm(`Excluir a planilha “${sheet.title}”? Essa ação não pode ser desfeita.`)) return
    await deleteSheet.mutateAsync(sheet.id)
    navigate('/')
  }

  const clientNames = sheet.client_ids.map((id) => names.clients.get(id)).filter(Boolean)
  const tags = [
    sheet.crop_id && names.crops.get(sheet.crop_id),
    sheet.variety_id && names.varieties.get(sheet.variety_id),
    sheet.season_id && `Safra ${names.seasons.get(sheet.season_id) ?? ''}`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <Link to="/" className="mt-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200" aria-label="Voltar">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold break-words text-slate-900 md:text-2xl">{sheet.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {clientNames.length ? clientNames.join(', ') : 'Sem cliente'}
              {tags.length > 0 && ` · ${tags.join(' · ')}`}
              {` · criada em ${formatDate(sheet.created_at)}`}
            </p>
          </div>
          <SaveIndicator status={status} onRetry={retry} />
        </div>
        <div className="flex flex-wrap gap-2 pl-10">
          <Button size="sm" onClick={() => setDialog('edit')}>
            <Pencil size={14} /> Dados
          </Button>
          <Button size="sm" onClick={() => setDialog('duplicate')}>
            <Copy size={14} /> Duplicar
          </Button>
          <Button size="sm" onClick={() => setDialog('pdf')}>
            <FileDown size={14} /> PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} className="text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Excluir
          </Button>
        </div>
      </div>

      <Toolbar />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tables.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-6">
            {tables.map((t) => (
              <TableView key={t.id} table={t} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() => apply((d) => void ops.addTable(d))}
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-6 font-medium text-slate-500 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Plus size={20} /> Adicionar tabela
      </button>

      {dialog === 'edit' && <EditMetaDialog onClose={() => setDialog(null)} sheet={sheet} />}
      {dialog === 'duplicate' && <DuplicateDialog onClose={() => setDialog(null)} sheet={sheet} />}
      <PdfDialog
        open={dialog === 'pdf'}
        onClose={() => setDialog(null)}
        sheet={sheet}
        details={[
          { label: 'Cliente', value: clientNames.join(', ') },
          { label: 'Cultura', value: (sheet.crop_id && names.crops.get(sheet.crop_id)) || '' },
          { label: 'Variedade', value: (sheet.variety_id && names.varieties.get(sheet.variety_id)) || '' },
          { label: 'Safra', value: (sheet.season_id && names.seasons.get(sheet.season_id)) || '' },
        ].filter((d) => d.value)}
      />
    </div>
  )
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <button onClick={onRetry} className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <CloudOff size={14} /> Erro ao salvar · tentar de novo
      </button>
    )
  }
  const saved = status === 'saved'
  return (
    <span className={cx('flex items-center gap-1.5 px-1 py-1 text-xs whitespace-nowrap', saved ? 'text-slate-400' : 'text-amber-600')}>
      {saved ? <Check size={14} /> : <Loader2 size={14} className="animate-spin" />}
      {saved ? 'Salvo' : 'Salvando…'}
    </span>
  )
}

const metaOf = (s: Sheet): SheetMeta => ({
  title: s.title,
  crop_id: s.crop_id,
  variety_id: s.variety_id,
  season_id: s.season_id,
  client_ids: s.client_ids,
})

function EditMetaDialog({ onClose, sheet }: { onClose: () => void; sheet: Sheet }) {
  const update = useUpdateSheetMeta(sheet.id)
  const [meta, setMeta] = useState(() => metaOf(sheet))

  const submit = async () => {
    await update.mutateAsync(meta)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Dados da planilha"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={!meta.title.trim() || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SheetMetaForm value={meta} onChange={setMeta} />
        <p className="text-xs text-slate-500">
          Todos os clientes marcados compartilham esta mesma planilha. Para ter uma versão separada, use “Duplicar”.
        </p>
        <ErrorText error={update.error} />
      </div>
    </Dialog>
  )
}

function DuplicateDialog({ onClose, sheet }: { onClose: () => void; sheet: Sheet }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [meta, setMeta] = useState<SheetMeta>(() => ({ ...metaOf(sheet), title: `${sheet.title} (cópia)`, client_ids: [] }))
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const id = await createSheet(meta, useEditor.getState().content)
      await qc.invalidateQueries({ queryKey: ['sheets'] })
      onClose()
      navigate(`/planilhas/${id}`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Duplicar planilha"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={!meta.title.trim() || busy}>
            Duplicar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Cria uma cópia independente com todas as tabelas. Alterações na cópia não afetam a original.
        </p>
        <SheetMetaForm value={meta} onChange={setMeta} />
        <ErrorText error={error} />
      </div>
    </Dialog>
  )
}

function PdfDialog({
  open,
  onClose,
  sheet,
  details,
}: {
  open: boolean
  onClose: () => void
  sheet: Sheet
  details: { label: string; value: string }[]
}) {
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      // Carregado sob demanda: a biblioteca de PDF é pesada.
      const { exportSheetPdf } = await import('@/editor/pdf')
      await exportSheetPdf({ title: sheet.title, details }, useEditor.getState().content, orientation)
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Exportar PDF"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={generate} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Gerar PDF
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Orientação da página">
          <div className="grid grid-cols-2 gap-2">
            {(['portrait', 'landscape'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOrientation(o)}
                className={cx(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium',
                  orientation === o ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600',
                )}
              >
                <span className={cx('rounded-sm border-2 border-current', o === 'portrait' ? 'h-6 w-4.5' : 'h-4.5 w-6')} />
                {o === 'portrait' ? 'Retrato' : 'Paisagem'}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs text-slate-500">Tabelas com muitas colunas ficam melhores em paisagem.</p>
        <ErrorText error={error} />
      </div>
    </Dialog>
  )
}
