import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-105 active:brightness-95',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-paper-2',
  ghost: 'text-ink-2 hover:bg-paper-2',
  danger: 'bg-danger text-paper hover:brightness-105 active:brightness-95',
}
const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-13 px-6 text-base gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: IconName }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium transition disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-paper-2 active:bg-line',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}
