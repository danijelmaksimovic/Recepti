import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'

export function Chip({
  selected,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'h-9 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition',
        selected ? 'bg-ink text-paper' : 'bg-surface text-ink-2 ring-1 ring-line hover:bg-paper-2',
        className,
      )}
      {...rest}
    />
  )
}
