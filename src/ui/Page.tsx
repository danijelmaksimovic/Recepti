import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconButton } from './Button'

/** Standard screen frame: large editorial title, optional back button and actions. */
export function Page({
  title,
  eyebrow,
  back,
  actions,
  children,
}: {
  title: string
  eyebrow?: string
  back?: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-10">
      <header className="flex items-end justify-between gap-3 pt-5 pb-4 lg:pt-10">
        <div className="min-w-0">
          {back && <IconButton icon="chevronLeft" label="Back" onClick={() => navigate(-1)} className="-ml-3 mb-1" />}
          {eyebrow && <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>}
          <h1 className="text-[2rem] leading-tight text-balance [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

export function EmptyState({ title, body, action, art }: { title: string; body: string; action?: ReactNode; art?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {art}
      <h2 className="mt-4 text-2xl">{title}</h2>
      <p className="mt-2 max-w-sm text-ink-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
