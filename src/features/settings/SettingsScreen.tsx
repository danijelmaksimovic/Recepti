import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { isStandalone, requestPersistence } from '@/app/platform'
import { Button } from '@/ui/Button'
import { Icon, type IconName } from '@/ui/Icon'
import { Page } from '@/ui/Page'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

function Group({ id, icon, title, children }: { id?: string; icon: IconName; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-card bg-surface p-5 ring-1 ring-line">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-paper-2 text-ink-2">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="text-lg">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function SettingsScreen() {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const standalone = isStandalone()

  useEffect(() => {
    navigator.storage?.estimate?.().then(setEstimate).catch(() => {})
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  return (
    <Page title="Settings">
      <div className="grid gap-4 lg:grid-cols-2">
        <Group id="install" icon="phone" title="Install on iPhone">
          {standalone ? (
            <p className="text-ink-2">You're using the installed app. Your recipes are stored in this app.</p>
          ) : (
            <>
              <ol className="list-decimal space-y-1.5 pl-5 text-ink-2">
                <li>Open this page in Safari.</li>
                <li>
                  Tap <Icon name="share" size={16} className="inline -translate-y-0.5" /> Share.
                </li>
                <li>Choose “Add to Home Screen”, then Add.</li>
                <li>Open My Recipe Book from your Home Screen.</li>
              </ol>
              <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-ink">
                Safari and the installed app keep separate storage. Recipes saved in a Safari tab won't appear in the installed app.
              </p>
            </>
          )}
        </Group>

        <Group icon="database" title="Storage on this device">
          <dl className="space-y-2 text-ink-2">
            <div className="flex justify-between gap-4">
              <dt>Used</dt>
              <dd className="font-medium text-ink">
                {estimate?.usage != null ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota ?? 0)}` : 'Unknown'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Protected from cleanup</dt>
              <dd className="font-medium text-ink">{persisted == null ? 'Unknown' : persisted ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
          {persisted === false && (
            <Button variant="secondary" className="mt-4" onClick={() => requestPersistence().then(setPersisted)}>
              Ask to keep data
            </Button>
          )}
          <p className="mt-4 text-sm text-ink-3">
            Data never leaves this device and does not sync between devices. Backup and restore arrive in Phase 9.
          </p>
        </Group>

        <Group icon="sparkle" title="About">
          <p className="text-ink-2">My Recipe Book · version {__APP_VERSION__}</p>
          <Link to="/settings/design" className="mt-3 inline-flex items-center gap-1 font-medium text-accent">
            Design system <Icon name="chevronRight" size={18} />
          </Link>
        </Group>
      </div>
    </Page>
  )
}
