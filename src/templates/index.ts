import type { SheetContent } from '@/lib/types'
import { nutricaoFoliar } from './nutricaoFoliar'

/**
 * Modelo pronto de planilha, definido no código e disponível para todas as contas.
 * Para adicionar um modelo: crie um arquivo nesta pasta e inclua-o em TEMPLATES.
 */
export interface SheetTemplate {
  /** Identificador fixo; não mudar depois de publicado. */
  id: string
  name: string
  description: string
  /** Gera o conteúdo com ids novos a cada chamada. */
  build: () => SheetContent
}

export const TEMPLATES: SheetTemplate[] = [nutricaoFoliar]

export const findTemplate = (id: string) => TEMPLATES.find((t) => t.id === id)
