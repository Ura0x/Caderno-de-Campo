import type { Tone } from '@/lib/types'

/** Paleta de cada cor de bloco de texto (editor e PDF usam as mesmas cores). */
export const TONES: Record<Tone, { label: string; bg: string; border: string; accent: string; title: string }> = {
  green: { label: 'Verde', bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', title: '#14532d' },
  amber: { label: 'Amarelo', bg: '#fffbeb', border: '#fde68a', accent: '#d97706', title: '#78350f' },
  red: { label: 'Vermelho', bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', title: '#7f1d1d' },
  blue: { label: 'Azul', bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', title: '#1e3a8a' },
  slate: { label: 'Cinza', bg: '#f8fafc', border: '#e2e8f0', accent: '#475569', title: '#0f172a' },
}

export type NoteLine =
  | { kind: 'item' | 'paragraph'; lead: string; rest: string }
  | { kind: 'space' }

const BULLET = /^\s*[-•*]\s+/
const HIGHLIGHT = /\s*(?:->|→)\s*/

/**
 * Interpreta o texto de um bloco:
 * - linha começando com "- " (ou "• ", "* ") → item com marcador;
 * - trecho antes de "->" (ou "→") → destaque;
 * - linha vazia → espaço.
 */
export function parseNote(text: string): NoteLine[] {
  return text.split('\n').map((line): NoteLine => {
    if (!line.trim()) return { kind: 'space' }
    const kind = BULLET.test(line) ? 'item' : 'paragraph'
    const body = line.replace(BULLET, '').trim()
    const match = HIGHLIGHT.exec(body)
    return match
      ? { kind, lead: body.slice(0, match.index), rest: body.slice(match.index + match[0].length) }
      : { kind, lead: '', rest: body }
  })
}
