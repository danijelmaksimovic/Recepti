import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BUILT_IN_CATEGORIES } from '@/domain/categories'
import { CookbookArt } from '@/ui/Art'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)

  return (
    <Page eyebrow={greeting()} title="My Cookbook">
      <label className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
        <Icon name="search" className="text-ink-3" />
        <input type="search" placeholder="Search recipes, ingredients, tags" className="w-full bg-transparent outline-none placeholder:text-ink-3" />
      </label>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip selected={category === null} onClick={() => setCategory(null)}>
          All
        </Chip>
        {BUILT_IN_CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="mt-8">
        <EmptyState
          art={<CookbookArt />}
          title="Your cookbook is waiting"
          body="Add your first recipe, then design a card for it in the Studio. Everything stays on this device."
          action={
            <Button icon="plus" size="lg" onClick={() => navigate('/recipes/new')}>
              Add a recipe
            </Button>
          }
        />
      </div>
    </Page>
  )
}
