import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Client, Crop, Sheet, SheetContent, SheetMeta, SheetSummary, Variety } from './types'
import { normalizeContent } from '@/editor/model'
import { findTemplate } from '@/templates'
import { AppError, translateDbError } from './errors'

interface Result<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

async function unwrap<T>(query: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await query
  if (error) throw translateDbError(error)
  return data as T
}

// Acesso ---------------------------------------------------------------------

/** O e-mail do usuário logado está na lista de acesso (tabela allowed_emails)? */
export function useIsAllowed(userId: string | undefined) {
  return useQuery({
    queryKey: ['is-allowed', userId],
    queryFn: () => unwrap<boolean>(supabase.rpc('is_allowed')),
    enabled: Boolean(userId),
    staleTime: Infinity,
  })
}

// Cadastros ------------------------------------------------------------------

type RegistryTable = 'clients' | 'crops' | 'varieties'

function useRegistry<T>(table: RegistryTable) {
  return useQuery({
    queryKey: [table],
    queryFn: () => unwrap<T[]>(supabase.from(table).select('*').order('name')),
  })
}

export const useClients = () => useRegistry<Client>('clients')
export const useCrops = () => useRegistry<Crop>('crops')
export const useVarieties = () => useRegistry<Variety>('varieties')

export function useSaveRow<T extends { id: string }>(table: RegistryTable) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }: Partial<T>) => {
      const row = fields as Record<string, unknown>
      return unwrap<T>(
        id
          ? supabase.from(table).update(row).eq('id', id).select().single()
          : supabase.from(table).insert(row).select().single(),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useDeleteRow(table: RegistryTable) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(supabase.from(table).delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      qc.invalidateQueries({ queryKey: ['sheets'] })
    },
  })
}

// Planilhas ------------------------------------------------------------------

const SUMMARY_COLUMNS =
  'id,title,crop_id,variety_id,pruning_date,created_at,updated_at,sheet_clients(client_id)'

interface SheetRow extends Omit<SheetSummary, 'client_ids'> {
  sheet_clients: { client_id: string }[]
  content?: unknown
}

function toSummary({ sheet_clients, content: _content, ...rest }: SheetRow): SheetSummary {
  return { ...rest, client_ids: sheet_clients.map((r) => r.client_id) }
}

export function useSheets() {
  return useQuery({
    queryKey: ['sheets'],
    queryFn: async () => {
      const rows = await unwrap<SheetRow[]>(
        supabase.from('sheets').select(SUMMARY_COLUMNS).order('created_at', { ascending: false }),
      )
      return rows.map(toSummary)
    },
  })
}

async function fetchSheet(id: string): Promise<Sheet> {
  const row = await unwrap<SheetRow>(
    supabase.from('sheets').select(`${SUMMARY_COLUMNS},content`).eq('id', id).single(),
  )
  return { ...toSummary(row), content: normalizeContent(row.content) }
}

export function useSheet(id: string) {
  return useQuery({
    queryKey: ['sheet', id],
    queryFn: () => fetchSheet(id),
    // O editor carrega o conteúdo uma vez; refetch em foco poderia sobrescrever edições.
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
}

async function setSheetClients(sheetId: string, clientIds: string[]) {
  await unwrap(supabase.from('sheet_clients').delete().eq('sheet_id', sheetId))
  if (clientIds.length) {
    await unwrap(
      supabase.from('sheet_clients').insert(clientIds.map((client_id) => ({ sheet_id: sheetId, client_id }))),
    )
  }
}

/**
 * Título livre entre os existentes: se já houver uma planilha com o mesmo nome
 * (sem diferenciar maiúsculas), acrescenta " (2)", " (3)"… ao nome base.
 * Um "(n)" no fim do título é tratado como numeração: copiar "X (2)" gera "X (3)".
 */
export function uniqueTitle(title: string, existing: string[]): string {
  const wanted = title.trim()
  const taken = new Set(existing.map((t) => t.trim().toLowerCase()))
  if (!taken.has(wanted.toLowerCase())) return wanted
  const base = wanted.replace(/\s*\(\d+\)$/, '')
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

export async function createSheet(meta: SheetMeta, content?: SheetContent): Promise<string> {
  const { client_ids, ...fields } = meta
  const existing = await unwrap<{ title: string }[]>(supabase.from('sheets').select('title'))
  const title = uniqueTitle(fields.title, existing.map((r) => r.title))
  const row = await unwrap<{ id: string }>(
    supabase
      .from('sheets')
      .insert({ ...fields, title, ...(content && { content }) })
      .select('id')
      .single(),
  )
  await setSheetClients(row.id, client_ids)
  return row.id
}

/** De onde vem o conteúdo de uma planilha nova. */
export type NewSheetSource = { kind: 'template'; templateId: string } | { kind: 'sheet'; sheetId: string }

const blankMeta = (title: string): SheetMeta => ({
  title,
  crop_id: null,
  variety_id: null,
  pruning_date: null,
  client_ids: [],
})

async function buildNewSheet(source: NewSheetSource): Promise<{ meta: SheetMeta; content?: SheetContent }> {
  switch (source.kind) {
    case 'template': {
      const template = findTemplate(source.templateId)
      if (!template) throw new AppError('Modelo não encontrado.')
      return { meta: blankMeta(template.name), content: template.build() }
    }
    case 'sheet': {
      // Cópia independente: mantém cultura e variedade, mas sem clientes.
      const base = await fetchSheet(source.sheetId)
      return {
        // O título repetido ganha a numeração em createSheet: "X" → "X (2)".
        meta: { ...blankMeta(base.title), crop_id: base.crop_id, variety_id: base.variety_id },
        content: base.content,
      }
    }
  }
}

export function useCreateSheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (source: NewSheetSource) => {
      const { meta, content } = await buildNewSheet(source)
      return createSheet(meta, content)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sheets'] }),
  })
}

export function useRenameSheet(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => unwrap(supabase.from('sheets').update({ title }).eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheets'] })
      qc.invalidateQueries({ queryKey: ['sheet', id] })
    },
  })
}

export function useUpdateSheetMeta(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ client_ids, ...fields }: SheetMeta) => {
      await unwrap(supabase.from('sheets').update(fields).eq('id', id))
      await setSheetClients(id, client_ids)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheets'] })
      qc.invalidateQueries({ queryKey: ['sheet', id] })
    },
  })
}

export function useDeleteSheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(supabase.from('sheets').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sheets'] }),
  })
}

export function saveSheetContent(id: string, content: SheetContent) {
  return unwrap(supabase.from('sheets').update({ content }).eq('id', id))
}
