/** Tiny app-wide toast queue. `toast()` from anywhere; `<Toaster />` renders it. */
export interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'error'
  action?: { label: string; to: string }
}

type Listener = (items: ToastItem[]) => void
let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

const emit = () => listeners.forEach((l) => l(items))

export function toast(message: string, opts: { tone?: ToastItem['tone']; action?: ToastItem['action']; ms?: number } = {}) {
  const item: ToastItem = { id: nextId++, message, tone: opts.tone ?? 'info', action: opts.action }
  items = [...items.slice(-2), item]
  emit()
  setTimeout(() => dismissToast(item.id), opts.ms ?? (item.tone === 'error' ? 6000 : 3000))
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l)
  l(items)
  return () => listeners.delete(l)
}
