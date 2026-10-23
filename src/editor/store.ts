import { produce } from 'immer'
import { create } from 'zustand'
import type { SheetContent } from '@/lib/types'
import { emptyContent, type Scope, type Selection } from './model'

const HISTORY_LIMIT = 100

interface EditorState {
  content: SheetContent
  past: SheetContent[]
  future: SheetContent[]
  /** Edições seguidas com a mesma chave (ex.: digitar numa célula) viram um único passo de desfazer. */
  lastKey: string | null
  /** Incrementa a cada mudança de conteúdo; usado pelo salvamento automático. */
  version: number
  selection: Selection | null
  scope: Scope

  load: (content: SheetContent) => void
  apply: (recipe: (draft: SheetContent) => void, key?: string) => void
  undo: () => void
  redo: () => void
  select: (selection: Selection | null) => void
  setScope: (scope: Scope) => void
}

export const useEditor = create<EditorState>((set, get) => ({
  content: emptyContent(),
  past: [],
  future: [],
  lastKey: null,
  version: 0,
  selection: null,
  scope: 'cell',

  load: (content) => set({ content, past: [], future: [], lastKey: null, version: 0, selection: null }),

  apply: (recipe, key) => {
    const { content, past, lastKey, version } = get()
    const next = produce(content, recipe)
    if (next === content) return
    const coalesce = key !== undefined && key === lastKey
    set({
      content: next,
      past: coalesce ? past : [...past.slice(-HISTORY_LIMIT + 1), content],
      future: [],
      lastKey: key ?? null,
      version: version + 1,
    })
  },

  undo: () => {
    const { past, future, content, version } = get()
    const prev = past.at(-1)
    if (!prev) return
    set({ content: prev, past: past.slice(0, -1), future: [content, ...future], lastKey: null, version: version + 1 })
  },

  redo: () => {
    const { past, future, content, version } = get()
    const [next, ...rest] = future
    if (!next) return
    set({ content: next, past: [...past, content], future: rest, lastKey: null, version: version + 1 })
  },

  select: (selection) => set({ selection, lastKey: null }),
  setScope: (scope) => set({ scope }),
}))
