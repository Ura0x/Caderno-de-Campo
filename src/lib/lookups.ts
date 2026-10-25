import { useMemo } from 'react'
import { useClients, useCrops, useVarieties } from './api'

/** Mapas id → nome dos cadastros, para exibir planilhas. */
export function useLookups() {
  const clients = useClients().data
  const crops = useCrops().data
  const varieties = useVarieties().data

  return useMemo(() => {
    const byId = <T extends { id: string; name: string }>(rows: T[] = []) =>
      new Map(rows.map((r) => [r.id, r.name]))
    return {
      clients: byId(clients),
      crops: byId(crops),
      varieties: byId(varieties),
    }
  }, [clients, crops, varieties])
}

/** Data sem horário (AAAA-MM-DD) → DD/MM/AAAA, sem conversão de fuso. */
export const formatDay = (day: string) => day.split('-').reverse().join('/')

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
