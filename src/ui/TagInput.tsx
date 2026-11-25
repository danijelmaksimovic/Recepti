import { useState } from 'react'
import { Icon } from './Icon'

/** Chips plus a text box. Enter or comma adds a tag; Backspace on empty removes the last. */
export function TagInput({ value, onChange, id }: { value: string[]; onChange: (tags: string[]) => void; id?: string }) {
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const parts = raw.split(',').map((t) => t.trim()).filter(Boolean)
    const next = [...value]
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p)
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl bg-surface px-2 py-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
      {value.map((t) => (
        <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-paper-2 pr-1 pl-3 text-sm">
          {t}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="flex size-6 items-center justify-center rounded-full text-ink-3 hover:bg-line"
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        enterKeyHint="done"
        placeholder={value.length ? '' : 'quick, vegetarian, family…'}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => text && add(text)}
        className="h-9 min-w-[8rem] flex-1 bg-transparent px-2 outline-none placeholder:text-ink-3"
      />
    </div>
  )
}
