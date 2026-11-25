import { cx } from './cx'
import { Icon } from './Icon'

/**
 * The cookbook's visual unit. Shows a card thumbnail or photo when there is one,
 * otherwise a warm paper placeholder with the recipe name set in the display face.
 */
export function RecipeTile({
  name,
  meta,
  image,
  tint = 'accent',
  tall,
  aspect,
  favorite,
}: {
  name: string
  meta?: string
  image?: string
  tint?: 'accent' | 'herb' | 'paper'
  tall?: boolean
  /** Width / height of the image (e.g. a card design); overrides `tall`. */
  aspect?: number
  favorite?: boolean
}) {
  const tints = { accent: 'bg-accent-soft', herb: 'bg-herb-soft', paper: 'bg-paper-2' }
  return (
    <article className="group mb-4 break-inside-avoid">
      <div
        className={cx(
          'relative overflow-hidden rounded-card shadow-card ring-1 ring-line/60 transition group-hover:-translate-y-0.5',
          !aspect && (tall ? 'aspect-[4/5]' : 'aspect-[4/3]'),
          !image && tints[tint],
        )}
        style={aspect ? { aspectRatio: String(aspect) } : undefined}
      >
        {image ? (
          <img src={image} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center p-5">
            <p className="text-center font-display text-2xl leading-tight text-ink/80 italic">{name}</p>
          </div>
        )}
        {favorite && (
          <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-surface/90 text-accent">
            <Icon name="heart" size={16} fill="currentColor" />
          </span>
        )}
      </div>
      <h3 className="mt-2.5 font-display text-lg leading-snug">{name}</h3>
      {meta && <p className="text-sm text-ink-3">{meta}</p>}
    </article>
  )
}
