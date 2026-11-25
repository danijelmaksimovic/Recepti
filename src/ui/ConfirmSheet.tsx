import type { ReactNode } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'

/** In-app confirmation (never `window.confirm`, which blocks and looks foreign in the installed app). */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-ink-2">{body}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}

/** A full-width row button for action sheets. */
export function SheetAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-13 w-full items-center gap-3 rounded-xl px-3 text-left font-medium transition hover:bg-paper-2 ${danger ? 'text-danger' : 'text-ink'}`}
    >
      {icon}
      {label}
    </button>
  )
}
