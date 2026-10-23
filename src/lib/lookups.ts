import { useMemo } from 'react'
import { useClients, useCrops, useSeasons, useVarieties } from './api'

/** Mapas id → nome dos cadastros, para exibir planilhas. */
export function useLookups() {
  const clients = useClients().data
  const crops = useCrops().data
  const varieties = useVarieties().data
  const seasons = useSeasons().data

  return useMemo(() => {
    const byId = <T extends { id: string; name: string }>(rows: T[] = []) =>
      new Map(rows.map((r) => [r.id, r.name]))
    return {
      clients: byId(clients),
      crops: byId(crops),
      varieties: byId(varieties),
      seasons: byId(seasons),
    }
  }, [clients, crops, varieties, seasons])
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
