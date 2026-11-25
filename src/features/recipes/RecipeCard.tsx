import { Link } from 'react-router'
import { formatMinutes } from '@/domain/format'
import type { Recipe } from '@/domain/types'
import { totalMinutes } from '@/db'
import { RecipeTile } from '@/ui/RecipeTile'
import { useAssetUrl, useDesignThumb } from './hooks'

const TINTS = ['accent', 'herb', 'paper'] as const

/** Stable small number from an id, so a recipe keeps its tint and shape. */
function seed(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function recipeMeta(r: Recipe, categoryName?: string) {
  return [categoryName, formatMinutes(totalMinutes(r))].filter(Boolean).join(' · ')
}

/** A cookbook tile linked to the recipe. Shows its main card, else its photo, else a paper placeholder. */
export function RecipeCard({ recipe, categoryName, className }: { recipe: Recipe; categoryName?: string; className?: string }) {
  const photo = useAssetUrl(recipe.photoAssetId)
  const card = useDesignThumb(recipe.primaryDesignId)
  const image = card?.url ?? photo
  const s = seed(recipe.id)
  return (
    <Link to={`/recipes/${recipe.id}`} className={`block break-inside-avoid rounded-card ${className ?? ''}`}>
      <RecipeTile
        name={recipe.name}
        meta={recipeMeta(recipe, categoryName) || undefined}
        image={image}
        tint={TINTS[s % 3]}
        tall={s % 5 < 2}
        aspect={card?.url ? card.aspect : undefined}
        favorite={recipe.favorite === 1}
      />
    </Link>
  )
}
