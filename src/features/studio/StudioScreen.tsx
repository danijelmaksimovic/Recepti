import { Icon, type IconName } from '@/ui/Icon'
import { Page } from '@/ui/Page'

const starters: { name: string; className: string }[] = [
  { name: 'Minimalist', className: 'bg-surface font-sans not-italic tracking-tight' },
  { name: 'Vintage Cookbook', className: 'bg-[#efe1c6] text-[#5a3a22]' },
  { name: 'Modern Editorial', className: 'bg-ink text-paper not-italic' },
  { name: 'Rustic Kitchen', className: 'bg-[#d9c3a3] text-[#3e2c1c]' },
  { name: 'Scrapbook', className: 'bg-accent-soft' },
  { name: 'Elegant Handwritten', className: 'bg-paper-2' },
  { name: 'Colorful Playful', className: 'bg-herb-soft text-herb' },
]

const tools: { icon: IconName; label: string }[] = [
  { icon: 'layers', label: 'Templates' },
  { icon: 'pen', label: 'Text & fields' },
  { icon: 'images', label: 'Photos & assets' },
  { icon: 'sparkle', label: 'Draw' },
]

export function StudioScreen() {
  return (
    <Page eyebrow="Design Studio" title="Recipe cards">
      <p className="max-w-xl text-ink-2">
        Design cards from your own photos, drawings and type. Open a recipe and choose Design, or start from a template.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tools.map((t) => (
          <div key={t.label} className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon name={t.icon} />
            </span>
            <span className="text-sm font-medium">{t.label}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-xl">Starter templates</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
        {starters.map((s) => (
          <figure key={s.name} className="w-36 shrink-0 snap-start lg:w-auto">
            <div
              className={`flex aspect-[4/5] items-center justify-center rounded-card p-4 text-center font-display text-lg leading-tight italic shadow-card ring-1 ring-line/60 ${s.className}`}
            >
              {s.name}
            </div>
            <figcaption className="mt-2 text-sm text-ink-3">Coming in Phase 8</figcaption>
          </figure>
        ))}
      </div>
    </Page>
  )
}
