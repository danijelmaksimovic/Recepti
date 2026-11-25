/** Small form controls for the Studio panels. */
import { useId, type ReactNode } from 'react'
import { cx } from '@/ui/cx'
import { Icon, type IconName } from '@/ui/Icon'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs font-semibold tracking-wide text-ink-3 uppercase">
        <span>{label}</span>
        {hint && <span className="font-medium tracking-normal normal-case">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | undefined
  options: { value: T; label: string; icon?: IconName }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-paper-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.icon ? o.label : undefined}
          title={o.label}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-medium transition',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
          )}
        >
          {o.icon ? <Icon name={o.icon} size={19} /> : o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: IconName }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-full items-center gap-3 rounded-xl px-1 text-left"
    >
      {icon && <Icon name={icon} size={20} className="text-ink-3" />}
      <span className="flex-1 text-[15px]">{label}</span>
      <span className={cx('relative h-7 w-12 rounded-full transition', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cx('absolute top-0.5 size-6 rounded-full bg-surface shadow transition-all', checked ? 'left-[1.375rem]' : 'left-0.5')} />
      </span>
    </button>
  )
}

/** A slider with a live value; `format` controls the readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between text-xs font-semibold tracking-wide text-ink-3 uppercase">
        <span>{label}</span>
        <span className="font-medium tracking-normal text-ink-2 tabular-nums normal-case">{format(value)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-[var(--accent)]"
      />
    </div>
  )
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex h-11 items-center gap-2 rounded-xl bg-paper-2 px-3">
      <span className="text-xs font-semibold text-ink-3 uppercase">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n)) onChange(n)
        }}
        className="w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
      />
      {suffix && <span className="text-sm text-ink-3">{suffix}</span>}
    </label>
  )
}

export const SWATCHES = [
  '#2b221b', '#5c4f44', '#8e7f71', '#ffffff', '#fffaf2', '#f7f1e8', '#efe1c6', '#d9c3a3',
  '#b5532f', '#e07a52', '#f3dccf', '#8c2f39', '#c9a227', '#5f6e42', '#a9b784', '#e3e6d2',
  '#2f4a6d', '#9fb8d0', '#6b4e71', '#1f1a16',
]

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId()
  const v = value.toLowerCase()
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={v === c}
          onClick={() => onChange(c)}
          className={cx('size-8 rounded-full ring-1 ring-line ring-inset transition', v === c && 'outline-2 outline-offset-2 outline-accent')}
          style={{ background: c }}
        />
      ))}
      <label
        htmlFor={id}
        title="Custom colour"
        className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[conic-gradient(#e07a52,#c9a227,#5f6e42,#2f4a6d,#6b4e71,#e07a52)]"
      >
        <span className="sr-only">Custom colour</span>
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0" />
      </label>
    </div>
  )
}
