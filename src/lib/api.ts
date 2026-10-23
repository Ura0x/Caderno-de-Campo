import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Client, Crop, Season, Sheet, SheetContent, SheetMeta, SheetSummary, Variety } from './types'
import { normalizeContent } from '@/editor/model'
import { translateDbError } from './errors'

interface Result<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

async function unwrap<T>(query: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await query
  if (error) throw translateDbError(error)
  return data as T
}

// Cadastros ------------------------------------------------------------------

type RegistryTable = 'clients' | 'crops' | 'varieties' | 'seasons'

function useRegistry<T>(table: RegistryTable) {
  return useQuery({
    queryKey: [table],
    queryFn: () => unwrap<T[]>(supabase.from(table).select('*').order('name')),
  })
}

export const useClients = () => useRegistry<Client>('clients')
export const useCrops = () => useRegistry<Crop>('crops')
export const useVarieties = () => useRegistry<Variety>('varieties')
export const useSeasons = () => useRegistry<Season>('seasons')

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

const SUMMARY_COLUMNS = 'id,title,crop_id,variety_id,season_id,created_at,updated_at,sheet_clients(client_id)'

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

export async function createSheet(meta: SheetMeta, content?: SheetContent): Promise<string> {
  const { client_ids, ...fields } = meta
  const row = await unwrap<{ id: string }>(
    supabase
      .from('sheets')
      .insert({ ...fields, ...(content && { content }) })
      .select('id')
      .single(),
  )
  await setSheetClients(row.id, client_ids)
  return row.id
}

export function useCreateSheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ meta, copyFromId }: { meta: SheetMeta; copyFromId?: string }) => {
      const content = copyFromId ? (await fetchSheet(copyFromId)).content : undefined
      return createSheet(meta, content)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sheets'] }),
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
