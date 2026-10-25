import { Pencil, StickyNote, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { cx } from '@/components/ui'
import type { TextSection, Tone } from '@/lib/types'
import { ops } from './model'
import { TONES, parseNote } from './note'
import { useEditor } from './store'

/** Bloco de texto: mostra o texto formatado; um clique abre a edição. */
export function TextSectionView({ section }: { section: TextSection }) {
  const apply = useEditor((s) => s.apply)
  const [editing, setEditing] = useState(false)
  const tone = TONES[section.tone]

  const remove = () => {
    if (confirm(`Excluir o bloco de texto “${section.title || 'sem título'}”?`)) apply((d) => ops.removeSection(d, section.id))
  }

  return (
    <section
      style={{ backgroundColor: tone.bg, borderColor: tone.border, borderLeftColor: tone.accent }}
      className="rounded-2xl border border-l-4 shadow-sm"
    >
      <header className="flex items-center gap-1 py-2 pr-2 pl-3">
        <StickyNote size={18} style={{ color: tone.accent }} className="shrink-0" />
        {/* textarea para títulos longos quebrarem linha no celular; Enter não cria nova linha. */}
        <textarea
          rows={1}
          value={section.title}
          onChange={(e) => apply((d) => ops.setTitle(d, section.id, e.target.value.replace(/\n/g, ' ')), `title:${section.id}`)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder="Título do bloco"
          style={{ color: tone.title }}
          className="field-sizing-content min-w-0 flex-1 resize-none rounded-md bg-transparent px-1.5 py-1 text-base font-bold outline-none focus:bg-white/70 md:text-lg"
        />
        <div className="hidden items-center gap-1 sm:flex" role="radiogroup" aria-label="Cor do bloco">
          {(Object.keys(TONES) as Tone[]).map((t) => (
            <ToneSwatch key={t} tone={t} active={t === section.tone} onClick={() => apply((d) => ops.updateText(d, section.id, { tone: t }))} />
          ))}
        </div>
        <button
          onClick={remove}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Excluir bloco de texto"
          title="Excluir bloco de texto"
        >
          <Trash2 size={18} />
        </button>
      </header>

      {/* No celular as cores ficam numa linha própria. */}
      <div className="flex items-center gap-1.5 px-4 pb-2 sm:hidden">
        {(Object.keys(TONES) as Tone[]).map((t) => (
          <ToneSwatch key={t} tone={t} active={t === section.tone} onClick={() => apply((d) => ops.updateText(d, section.id, { tone: t }))} />
        ))}
      </div>

      <div className="px-4 pb-4">
        {editing ? (
          <NoteEditor section={section} onDone={() => setEditing(false)} />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group relative w-full rounded-lg bg-white/60 p-3 text-left hover:bg-white"
            title="Clique para editar"
          >
            <Pencil size={14} className="absolute top-2.5 right-2.5 text-slate-300 group-hover:text-slate-500" />
            {section.text.trim() ? (
              <NotePreview text={section.text} tone={section.tone} />
            ) : (
              <span className="text-sm text-slate-400">Clique para escrever…</span>
            )}
          </button>
        )}
      </div>
    </section>
  )
}

function ToneSwatch({ tone, active, onClick }: { tone: Tone; active: boolean; onClick: () => void }) {
  const t = TONES[tone]
  return (
    <button
      role="radio"
      aria-checked={active}
      aria-label={t.label}
      title={t.label}
      onClick={onClick}
      className={cx('h-5 w-5 rounded-full border-2', active ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100')}
      style={{ backgroundColor: t.accent, borderColor: t.bg, ['--tw-ring-color' as string]: t.accent }}
    />
  )
}

function NoteEditor({ section, onDone }: { section: TextSection; onDone: () => void }) {
  const apply = useEditor((s) => s.apply)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [section.text])

  useLayoutEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={section.text}
        onChange={(e) => apply((d) => ops.updateText(d, section.id, { text: e.target.value }), `text:${section.id}`)}
        onBlur={onDone}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        rows={4}
        className="w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-base leading-relaxed outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 md:text-sm"
      />
      <p className="text-xs text-slate-500">
        Dica: comece a linha com <b>-</b> para criar um item, e use <b>-&gt;</b> para destacar o que vem antes (ex.:{' '}
        <i>Tracer · 150 mL/ha -&gt; trips</i>).
      </p>
    </div>
  )
}

function NotePreview({ text, tone }: { text: string; tone: Tone }) {
  const t = TONES[tone]
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-slate-700">
      {parseNote(text).map((line, i) =>
        line.kind === 'space' ? (
          <div key={i} className="h-1.5" />
        ) : (
          <div key={i} className="flex gap-2">
            {line.kind === 'item' && <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.accent }} />}
            <p className="min-w-0">
              {line.lead && (
                <>
                  <b style={{ color: t.title }}>{line.lead}</b>
                  <span className="mx-1.5 text-slate-400">—</span>
                </>
              )}
              {line.rest}
            </p>
          </div>
        ),
      )}
    </div>
  )
}
