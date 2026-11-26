/**
 * Layers, stacking order and alignment. The layers list is top-most first,
 * like most design tools; dragging a row's grip changes the stacking order.
 */
import { useMemo, useState } from 'react'
import type { AlignMode } from '@/domain/card/align'
import { cx } from '@/ui/cx'
import { Icon, type IconName } from '@/ui/Icon'
import { SortableList } from '@/ui/Sortable'
import { useEditor } from './context'
import { Field } from './controls'
import type { ArrangeOp, LayerInfo, LayerKind } from './fabric/engine'
import { useEditorUI } from './store'

const KIND_ICON: Record<LayerKind, IconName> = { text: 'type', field: 'braces', image: 'images', photo: 'camera', shape: 'frame', group: 'layers' }

export function LayersPanel() {
  const { editor } = useEditor()
  const layers = useEditorUI((s) => s.layers)
  const [multi, setMulti] = useState(false)
  const items = useMemo(() => layers.map((l) => ({ ...l, id: l.uid })), [layers])

  if (!layers.length) return <p className="text-sm text-ink-3">Nothing on the card yet. Everything you add shows up here, top-most first.</p>

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">Top of the card first; drag to restack.</p>
        <button
          type="button"
          aria-pressed={multi}
          onClick={() => setMulti(!multi)}
          className={cx('h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition', multi ? 'bg-accent text-accent-ink' : 'bg-paper-2 text-ink-2')}
        >
          Select several
        </button>
      </div>
      <SortableList
        items={items}
        label={(l) => `Move ${l.name}`}
        onMove={(_from, to) => editor?.moveLayer(items[_from].uid, to)}
        className="space-y-0.5"
        renderItem={(l, _i, handle) => <LayerRow layer={l} handle={handle} multi={multi} />}
      />
    </div>
  )
}

function LayerRow({ layer: l, handle, multi }: { layer: LayerInfo; handle: React.ReactNode; multi: boolean }) {
  const { editor } = useEditor()
  return (
    <div
      data-testid="layer-row"
      className={cx('flex items-center rounded-xl pr-1 transition', l.selected ? 'bg-accent/12 ring-1 ring-accent/40' : 'hover:bg-paper-2', !l.visible && 'opacity-55')}
    >
      {handle}
      <button
        type="button"
        aria-pressed={l.selected}
        onClick={(e) => editor?.selectLayer(l.uid, multi || e.shiftKey || e.metaKey || e.ctrlKey)}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
      >
        <Icon name={KIND_ICON[l.kind]} size={18} className="shrink-0 text-ink-3" />
        <span className="truncate text-[15px]">{l.name}</span>
      </button>
      <button
        type="button"
        aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
        aria-pressed={!l.visible}
        title={l.visible ? 'Hide' : 'Show'}
        onClick={() => editor?.setLayerVisible(l.uid, !l.visible)}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-2"
      >
        <Icon name={l.visible ? 'eye' : 'eyeOff'} size={19} />
      </button>
      <button
        type="button"
        aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
        aria-pressed={l.locked}
        title={l.locked ? 'Unlock' : 'Lock'}
        onClick={() => editor?.setLayerLocked(l.uid, !l.locked)}
        className={cx('flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-paper-2', l.locked ? 'text-accent' : 'text-ink-3/60')}
      >
        <Icon name={l.locked ? 'lock' : 'unlock'} size={19} />
      </button>
    </div>
  )
}

const ALIGN: { mode: AlignMode; label: string; icon: IconName }[] = [
  { mode: 'left', label: 'Align left', icon: 'objAlignLeft' },
  { mode: 'hcenter', label: 'Align centre', icon: 'objAlignHCenter' },
  { mode: 'right', label: 'Align right', icon: 'objAlignRight' },
  { mode: 'top', label: 'Align top', icon: 'objAlignTop' },
  { mode: 'vcenter', label: 'Align middle', icon: 'objAlignVCenter' },
  { mode: 'bottom', label: 'Align bottom', icon: 'objAlignBottom' },
]

const ORDER: { op: ArrangeOp; label: string; icon: IconName }[] = [
  { op: 'front', label: 'Bring to front', icon: 'toFront' },
  { op: 'forward', label: 'Bring forward', icon: 'arrowUp' },
  { op: 'backward', label: 'Send backward', icon: 'arrowDown' },
  { op: 'back', label: 'Send to back', icon: 'toBack' },
]

function ToolGrid({ children, cols }: { children: React.ReactNode; cols: number }) {
  return <div className={cx('grid gap-1 rounded-xl bg-paper-2 p-1', cols === 6 ? 'grid-cols-6' : cols === 4 ? 'grid-cols-4' : 'grid-cols-2')}>{children}</div>
}

function ToolCell({ label, icon, onClick, disabled, text }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean; text?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx('flex h-10 items-center justify-center gap-1.5 rounded-lg text-ink-2 transition hover:bg-surface disabled:opacity-35', text && 'text-xs font-medium')}
    >
      <Icon name={icon} size={20} />
      {text && label}
    </button>
  )
}

/** Align buttons; for several objects also distribute. */
export function AlignControls({ count }: { count: number }) {
  const { editor } = useEditor()
  return (
    <div className="space-y-3">
      <Field label={count > 1 ? 'Align to each other' : 'Align to card'}>
        <ToolGrid cols={6}>
          {ALIGN.map((a) => (
            <ToolCell key={a.mode} {...a} onClick={() => editor?.align(a.mode)} />
          ))}
        </ToolGrid>
      </Field>
      {count > 1 && (
        <Field label="Distribute" hint={count < 3 ? 'needs 3 or more' : undefined}>
          <ToolGrid cols={2}>
            <ToolCell label="Space horizontally" icon="distributeH" text disabled={count < 3} onClick={() => editor?.distribute('x')} />
            <ToolCell label="Space vertically" icon="distributeV" text disabled={count < 3} onClick={() => editor?.distribute('y')} />
          </ToolGrid>
        </Field>
      )}
    </div>
  )
}

export function OrderControls() {
  const { editor } = useEditor()
  // Re-read after every layer change so the buttons enable/disable correctly.
  useEditorUI((s) => s.layers)
  const pos = editor?.stackPosition() ?? { top: true, bottom: true }
  return (
    <Field label="Layer order">
      <ToolGrid cols={4}>
        {ORDER.map((o) => (
          <ToolCell key={o.op} {...o} disabled={o.op === 'front' || o.op === 'forward' ? pos.top : pos.bottom} onClick={() => editor?.arrange(o.op)} />
        ))}
      </ToolGrid>
    </Field>
  )
}

/** Shown in place of the property panels while a locked object is selected. */
export function LockedNotice({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-paper-2 p-3">
      <Icon name="lock" size={20} className="shrink-0 text-accent" />
      <p className="flex-1 text-sm text-ink-2">Locked, so it can’t be moved or changed, and taps on the card pass through it.</p>
      <button type="button" onClick={onUnlock} className="h-9 shrink-0 rounded-full bg-surface px-3 text-sm font-semibold text-accent ring-1 ring-line">
        Unlock
      </button>
    </div>
  )
}

/** Properties for a multi-selection. */
export function MultiPanel({ count, locked }: { count: number; locked: boolean }) {
  const { editor } = useEditor()
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">{count} items selected.</p>
      <AlignControls count={count} />
      <OrderControls />
      <div className="flex gap-2">
        <button type="button" onClick={() => editor?.lockActive(!locked)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface text-[15px] ring-1 ring-line hover:bg-paper-2">
          <Icon name={locked ? 'unlock' : 'lock'} size={19} />
          {locked ? 'Unlock all' : 'Lock all'}
        </button>
        <button type="button" onClick={() => editor?.deleteActive()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface text-[15px] text-danger ring-1 ring-line hover:bg-paper-2">
          <Icon name="trash" size={19} />
          Delete
        </button>
      </div>
    </div>
  )
}
