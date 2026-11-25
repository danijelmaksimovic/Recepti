import { useState } from 'react'
import { Chip } from '@/ui/Chip'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'

const kinds = ['All', 'Photos', 'Illustrations', 'Stickers', 'Backgrounds', 'Drawings']

export function LibraryScreen() {
  const [kind, setKind] = useState('All')
  return (
    <Page eyebrow="Assets" title="Library">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {kinds.map((k) => (
          <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
            {k}
          </Chip>
        ))}
      </div>
      <div className="mt-8">
        <EmptyState
          art={
            <span className="flex size-16 items-center justify-center rounded-2xl bg-herb-soft text-herb">
              <Icon name="images" size={30} />
            </span>
          }
          title="No assets yet"
          body="Drawings, stickers and photos you import (PNG, JPG, SVG) will live here so you can reuse them on any card. Import arrives in Phase 6."
        />
      </div>
    </Page>
  )
}
