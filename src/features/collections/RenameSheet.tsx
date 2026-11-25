import { useEffect, useState } from 'react'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'

/** Sheet with one name field, used to create or rename categories and collections. */
export function RenameSheet({
  open,
  title,
  initial = '',
  saveLabel = 'Save',
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  initial?: string
  saveLabel?: string
  onClose: () => void
  onSave: (name: string) => Promise<unknown>
}) {
  const [name, setName] = useState(initial)
  useEffect(() => {
    if (open) setName(initial)
  }, [open, initial])

  const submit = async () => {
    if (!name.trim()) return
    try {
      await onSave(name.trim())
      onClose()
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          autoFocus
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block h-12 w-full rounded-2xl bg-paper px-4 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {saveLabel}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
