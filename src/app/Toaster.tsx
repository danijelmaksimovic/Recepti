import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { onStorageError, StorageFullError } from '@/db'
import { cx } from '@/ui/cx'
import { dismissToast, subscribeToasts, toast, type ToastItem } from '@/ui/toast'

/** Renders toasts above the tab bar and turns failed writes into a visible message. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setItems), [])
  useEffect(
    () =>
      onStorageError((err) =>
        toast(err.message, {
          tone: 'error',
          action: err instanceof StorageFullError ? { label: 'Storage', to: '/settings' } : undefined,
        }),
      ),
    [],
  )

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2.5 pr-2.5 pl-5 text-sm font-medium shadow-float',
            t.tone === 'error' ? 'bg-accent text-accent-ink' : 'bg-ink text-paper',
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <Link to={t.action.to} onClick={() => dismissToast(t.id)} className="rounded-full px-3 py-1 underline underline-offset-2">
              {t.action.label}
            </Link>
          )}
          {!t.action && <span className="w-1" />}
        </div>
      ))}
    </div>
  )
}
