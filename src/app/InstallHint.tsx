import { useState } from 'react'
import { Link } from 'react-router'
import { IconButton } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { isIOS, isStandalone } from './platform'

const KEY = 'installHintDismissed'

/**
 * On iPhone, a Safari tab and the installed app keep separate storage, so we
 * nudge people to install before they start adding recipes (BLUEPRINT §9).
 */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return isStandalone() || !isIOS() || localStorage.getItem(KEY) === '1'
    } catch {
      return isStandalone() || !isIOS()
    }
  })
  if (hidden) return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
  }
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl bg-herb-soft p-3.5 text-sm sm:mx-6 lg:mx-10">
      <Icon name="phone" className="mt-0.5 shrink-0 text-herb" />
      <p className="flex-1 text-ink-2">
        Add this app to your Home Screen before saving recipes. Safari tabs and the installed app keep separate data.{' '}
        <Link to="/settings#install" className="font-medium text-ink underline underline-offset-2">
          How to install
        </Link>
      </p>
      <IconButton icon="close" label="Dismiss" onClick={dismiss} className="-my-2 -mr-2 size-9" />
    </div>
  )
}
