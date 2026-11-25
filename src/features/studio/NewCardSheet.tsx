import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DEFAULT_PRESET_ID, GROUP_LABELS, PRESETS, presetSize, type Orientation, type PresetGroup } from '@/domain/card/presets'
import type { Recipe } from '@/domain/types'
import { Button } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'

type StartWith = 'layout' | 'blank'

/** Pick a size and a starting point, create the design and open it in the Studio. */
export function NewCardSheet({ recipe, open, onClose }: { recipe: Recipe | undefined; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [startWith, setStartWith] = useState<StartWith>('layout')
  const [busy, setBusy] = useState(false)
  const preset = PRESETS.find((p) => p.id === presetId)!
  const square = preset.width === preset.height

  const create = async () => {
    if (!recipe) return
    setBusy(true)
    try {
      const { createCard } = await import('@/features/editor/create')
      const size = presetSize(preset, square ? 'portrait' : orientation)
      const design = await createCard(recipe, { presetId, name: preset.label, ...size, startWith })
      onClose()
      navigate(`/studio/cards/${design.id}`)
    } catch (e) {
      console.error(e)
      toast('Could not create the card.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New card">
      {recipe && <p className="-mt-2 mb-4 text-sm text-ink-3">For {recipe.name}</p>}
      <div className="space-y-4">
        {(['print', 'digital', 'page'] as PresetGroup[]).map((g) => (
          <div key={g}>
            <h3 className="mb-2 font-sans text-xs font-semibold tracking-wide text-ink-3 uppercase">{GROUP_LABELS[g]}</h3>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {PRESETS.filter((p) => p.group === g).map((p) => {
                const s = presetSize(p, p.width === p.height ? 'portrait' : orientation)
                const k = 52 / Math.max(s.width, s.height)
                const active = p.id === presetId
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPresetId(p.id)}
                    className={cx('flex w-28 shrink-0 flex-col items-center rounded-2xl px-2 pt-3 pb-2 ring-1 transition', active ? 'bg-accent-soft ring-accent' : 'bg-surface ring-line')}
                  >
                    <span className="flex h-14 items-center">
                      <span className="block rounded-[4px] border-[1.5px] border-ink-2 bg-paper" style={{ width: s.width * k, height: s.height * k }} />
                    </span>
                    <span className="mt-1.5 w-full truncate text-center text-sm font-medium">{p.label}</span>
                    <span className="w-full truncate text-center text-[11px] text-ink-3">{p.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <Choice
          label="Orientation"
          disabled={square}
          value={square ? undefined : orientation}
          options={[
            ['portrait', 'Portrait'],
            ['landscape', 'Landscape'],
          ]}
          onChange={(v) => setOrientation(v as Orientation)}
        />
        <Choice
          label="Start with"
          value={startWith}
          options={[
            ['layout', 'Recipe layout'],
            ['blank', 'Blank card'],
          ]}
          onChange={(v) => setStartWith(v as StartWith)}
        />
        <Button size="lg" className="w-full" disabled={busy || !recipe} onClick={() => void create()}>
          {busy ? 'Creating…' : 'Create and open'}
        </Button>
      </div>
    </Sheet>
  )
}

function Choice({ label, value, options, onChange, disabled }: { label: string; value?: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('space-y-1.5', disabled && 'opacity-50')}>
      <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <div className="flex rounded-xl bg-paper-2 p-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cx('h-10 flex-1 rounded-lg text-sm font-medium transition', value === v ? 'bg-surface text-ink shadow-card' : 'text-ink-2')}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
