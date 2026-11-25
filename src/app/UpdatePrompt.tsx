import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/ui/Button'

/** Registers the service worker and offers a reload when a new version is cached. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-4 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-paper shadow-float lg:bottom-6">
      <p className="flex-1 text-sm">A new version is ready.</p>
      <Button variant="ghost" className="text-paper/70 hover:bg-white/10" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button onClick={() => updateServiceWorker(true)}>Update</Button>
    </div>
  )
}
