import { useEffect, type ReactNode } from 'react'
import { IconButton } from './Button'

/** Bottom sheet on phones, centered dialog from `sm` up. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-surface px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom))] shadow-card sm:max-w-md sm:rounded-[1.75rem] sm:pb-6">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} className="-mr-2" />
        </div>
        {children}
      </div>
    </div>
  )
}
