import { NavLink, Outlet, useNavigate } from 'react-router'
import { cx } from '@/ui/cx'
import { Icon, type IconName } from '@/ui/Icon'
import { InstallHint } from './InstallHint'
import { UpdatePrompt } from './UpdatePrompt'

const tabs: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Cookbook', icon: 'book', end: true },
  { to: '/studio', label: 'Studio', icon: 'palette' },
  { to: '/library', label: 'Library', icon: 'images' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

/**
 * App frame. Phones and tablets in portrait get a bottom tab bar with a center
 * add button; wide screens get a quiet left rail. Safe areas are respected.
 */
export function Shell() {
  const navigate = useNavigate()
  const addRecipe = () => navigate('/recipes/new')

  return (
    <div className="flex min-h-dvh pr-[var(--safe-right)] pl-[var(--safe-left)]">
      {/* Desktop rail */}
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-2/50 px-4 py-8 lg:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9" />
          <span className="font-display text-xl leading-none">
            My Recipe
            <br />
            <span className="text-accent italic">Book</span>
          </span>
        </div>
        <button
          onClick={addRecipe}
          className="mb-6 flex h-11 items-center justify-center gap-2 rounded-full bg-accent font-medium text-accent-ink shadow-float transition hover:brightness-105"
        >
          <Icon name="plus" size={20} /> New recipe
        </button>
        <ul className="space-y-1">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cx(
                    'flex h-11 items-center gap-3 rounded-xl px-3 font-medium transition',
                    isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-surface/60',
                  )
                }
              >
                <Icon name={t.icon} /> {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pt-safe pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1rem)] lg:pb-0">
          <InstallHint />
          <Outlet />
        </main>
      </div>

      {/* Phone / tablet tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 pb-safe backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-5 items-center px-2">
          {tabs.slice(0, 2).map((t) => (
            <TabItem key={t.to} {...t} />
          ))}
          <li className="flex justify-center">
            <button
              onClick={addRecipe}
              aria-label="New recipe"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-float transition active:scale-95"
            >
              <Icon name="plus" size={26} strokeWidth={2.25} />
            </button>
          </li>
          {tabs.slice(2).map((t) => (
            <TabItem key={t.to} {...t} />
          ))}
        </ul>
      </nav>

      <UpdatePrompt />
    </div>
  )
}

function TabItem({ to, label, icon, end }: (typeof tabs)[number]) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition', isActive ? 'text-accent' : 'text-ink-3')
        }
      >
        <Icon name={icon} size={24} />
        {label}
      </NavLink>
    </li>
  )
}
