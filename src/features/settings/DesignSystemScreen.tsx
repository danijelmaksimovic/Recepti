import { useState } from 'react'
import { Button, IconButton } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Page, Section } from '@/ui/Page'
import { RecipeTile } from '@/ui/RecipeTile'
import { Sheet } from '@/ui/Sheet'

const swatches = ['paper', 'paper-2', 'surface', 'line', 'ink', 'ink-2', 'ink-3', 'accent', 'accent-soft', 'herb', 'herb-soft']

/** Living reference for tokens and components. Sample content only. */
export function DesignSystemScreen() {
  const [sheet, setSheet] = useState(false)
  return (
    <Page back eyebrow="Reference" title="Design system">
      <Section title="Colour">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-11">
          {swatches.map((s) => (
            <div key={s}>
              <div className="aspect-square rounded-xl ring-1 ring-line" style={{ background: `var(--${s})` }} />
              <p className="mt-1 text-xs text-ink-3">{s}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="font-display text-4xl">Grandma's Plum Cake</p>
        <p className="font-display text-2xl italic text-ink-2">A soft, buttery Sunday bake</p>
        <p className="mt-2 max-w-prose text-ink-2">
          Inter carries the interface; Fraunces gives titles a warm, editorial cookbook voice. Both are bundled so the app works offline.
        </p>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon="plus">Add recipe</Button>
          <Button variant="secondary" icon="share">Share</Button>
          <Button variant="ghost">Cancel</Button>
          <IconButton icon="heart" label="Favourite" />
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open sheet
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip selected>All</Chip>
          <Chip>Desserts</Chip>
          <Chip>Bakery</Chip>
        </div>
      </Section>

      <Section title="Recipe tiles">
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          <RecipeTile name="Plum cake" meta="Bakery · 1 h 10 min" tall favorite />
          <RecipeTile name="Spring pea soup" meta="Soups · 25 min" tint="herb" />
          <RecipeTile name="Lemon ricotta pancakes" meta="Breakfast · 20 min" tint="paper" />
          <RecipeTile name="Burnt honey figs" meta="Desserts · 15 min" tall />
        </div>
      </Section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Bottom sheet">
        <p className="text-ink-2">Used for properties and quick actions on phones. Becomes a dialog on larger screens.</p>
        <Button className="mt-5 w-full" onClick={() => setSheet(false)}>
          Done
        </Button>
      </Sheet>
    </Page>
  )
}
