/**
 * Studio panels. The same components fill the desktop side panels and the
 * mobile bottom sheets.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { TEXTURES, type CardBackground } from '@/domain/card/doc'
import { FONTS, getFont } from '@/domain/card/fonts'
import { CUSTOM_PRESET_ID, GROUP_LABELS, PRESETS, clampSide, getPreset, orientationOf, presetSize, type PresetGroup } from '@/domain/card/presets'
import { FIELDS, token, type ListStyle } from '@/domain/card/tokens'
import { Button } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { Icon } from '@/ui/Icon'
import { useEditor } from './context'
import { ColorPicker, Field, NumberInput, Seg, Slider, Toggle } from './controls'
import { textureTile } from './fabric/background'
import type { CardEditor, ImageSnapshot, ShapeSnapshot, TextSnapshot } from './fabric/engine'
import { BackgroundImageSection } from './imagePanels'
import { useEditorUI } from './store'

// ---- add -------------------------------------------------------------------

export function TextToolPanel({ onDone }: { onDone?: () => void }) {
  const { editor } = useEditor()
  const add = async (kind: 'heading' | 'body') => {
    await editor?.addText(kind)
    onDone?.()
  }
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => void add('heading')} className="w-full rounded-2xl bg-paper-2 px-4 py-4 text-left transition hover:bg-line/60">
        <span className="font-display text-2xl font-semibold">Add a heading</span>
      </button>
      <button type="button" onClick={() => void add('body')} className="w-full rounded-2xl bg-paper-2 px-4 py-3.5 text-left transition hover:bg-line/60">
        <span className="text-[15px]">Add a line of text</span>
      </button>
      <p className="text-sm text-ink-3">Text can hold recipe fields too: type them in, or use Fields to add one ready-made.</p>
    </div>
  )
}

export function FieldsPanel({ onDone }: { onDone?: () => void }) {
  const { editor } = useEditor()
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">Fields show this recipe’s content and update when the recipe changes or the design is used for another recipe.</p>
      <ul className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              onClick={async () => {
                await editor?.addText({ field: f.key })
                onDone?.()
              }}
              className="flex h-full w-full flex-col items-start rounded-2xl bg-paper-2 px-3 py-2.5 text-left transition hover:bg-line/60"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon name={f.list ? 'list' : 'braces'} size={15} className="text-accent" />
                {f.label}
              </span>
              <span className="mt-0.5 line-clamp-1 text-xs text-ink-3">{f.sample.split('\n')[0]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- background --------------------------------------------------------------

function TextureSwatch({ bg, active, onClick, label }: { bg: CardBackground; active: boolean; onClick: () => void; label: string }) {
  const url = useMemo(() => {
    const tile = textureTile({ ...bg, textureOpacity: Math.max(bg.textureOpacity, 0.35) }, 0.6)
    return tile?.toDataURL()
  }, [bg])
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('flex flex-col items-center gap-1 rounded-xl p-1 text-xs font-medium text-ink-2', active && 'text-ink')}
    >
      <span
        className={cx('block size-14 rounded-xl ring-1 ring-line', active && 'outline-2 outline-offset-2 outline-accent')}
        style={{ backgroundColor: bg.color, backgroundImage: url ? `url(${url})` : undefined }}
      />
      {label}
    </button>
  )
}

export function BackgroundPanel() {
  const { editor } = useEditor()
  const [bg, setBg] = useState<CardBackground | undefined>(editor?.page.background)
  useEffect(() => setBg(editor?.page.background), [editor])
  if (!editor || !bg) return null
  const update = (patch: Partial<CardBackground>) => {
    editor.setBackground(patch)
    setBg(editor.page.background)
  }
  return (
    <div className="space-y-5">
      <Field label="Colour">
        <ColorPicker label="Background colour" value={bg.color} onChange={(color) => update({ color })} />
      </Field>
      <Field label="Texture">
        <div className="grid grid-cols-4 gap-1">
          {TEXTURES.map((t) => (
            <TextureSwatch key={t.kind} label={t.label} active={bg.texture === t.kind} bg={{ ...bg, texture: t.kind }} onClick={() => update({ texture: t.kind })} />
          ))}
        </div>
      </Field>
      {bg.texture !== 'none' && (
        <>
          <Field label="Texture colour">
            <ColorPicker label="Texture colour" value={bg.textureColor} onChange={(textureColor) => update({ textureColor })} />
          </Field>
          <Slider label="Strength" value={Math.round(bg.textureOpacity * 100)} min={5} max={100} onChange={(v) => update({ textureOpacity: v / 100 })} format={(v) => `${v}%`} />
          <Slider label="Scale" value={bg.textureScale} min={0.5} max={3} step={0.1} onChange={(v) => update({ textureScale: v })} format={(v) => `${v.toFixed(1)}×`} />
        </>
      )}
      <BackgroundImageSection bg={bg} update={update} />
    </div>
  )
}

// ---- canvas size and grid ------------------------------------------------------

export function CanvasPanel() {
  const { editor, presetId, setPreset } = useEditor()
  const grid = useEditorUI((s) => s.grid)
  const setGrid = useEditorUI((s) => s.setGrid)
  const page = editor?.page
  const [custom, setCustom] = useState({ w: page?.width ?? 1000, h: page?.height ?? 1000 })
  useEffect(() => {
    if (page) setCustom({ w: page.width, h: page.height })
  }, [page?.width, page?.height]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!editor || !page) return null
  const orientation = orientationOf(page.width, page.height)
  const groups = (['digital', 'print', 'page'] as PresetGroup[]).map((g) => ({ g, items: PRESETS.filter((p) => p.group === g) }))

  return (
    <div className="space-y-5">
      <Field label="Orientation">
        <Seg
          label="Orientation"
          value={page.width === page.height ? undefined : orientation}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          onChange={(o) => {
            if (o === orientation) return
            setPreset(presetId, page.height, page.width)
          }}
        />
      </Field>
      {groups.map(({ g, items }) => (
        <Field key={g} label={GROUP_LABELS[g]}>
          <ul className="grid grid-cols-2 gap-2">
            {items.map((p) => {
              const size = presetSize(p, orientation)
              const active = p.id === presetId
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPreset(p.id, size.width, size.height)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ring-1 transition',
                      active ? 'bg-accent-soft ring-accent' : 'bg-surface ring-line hover:bg-paper-2',
                    )}
                  >
                    <PresetShape width={size.width} height={size.height} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.label}</span>
                      <span className="block truncate text-xs text-ink-3">{p.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Field>
      ))}
      <Field label="Custom size" hint={presetId === CUSTOM_PRESET_ID ? 'in use' : undefined}>
        <div className="flex gap-2">
          <NumberInput label="W" value={custom.w} onChange={(w) => setCustom((c) => ({ ...c, w }))} suffix="px" />
          <NumberInput label="H" value={custom.h} onChange={(h) => setCustom((c) => ({ ...c, h }))} suffix="px" />
        </div>
        <Button variant="secondary" className="mt-2 w-full" onClick={() => setPreset(CUSTOM_PRESET_ID, clampSide(custom.w), clampSide(custom.h))}>
          Use custom size
        </Button>
      </Field>
      <div className="border-t border-line pt-3">
        <Toggle icon="grid" label="Show grid" checked={grid.show} onChange={(show) => setGrid({ show })} />
        <Toggle icon="move" label="Snap to grid" checked={grid.snap} onChange={(snap) => setGrid({ snap })} />
        <div className="mt-2">
          <Seg
            label="Grid size"
            value={grid.density}
            options={[
              { value: 'fine', label: 'Fine' },
              { value: 'medium', label: 'Medium' },
              { value: 'coarse', label: 'Coarse' },
            ]}
            onChange={(density) => setGrid({ density })}
          />
        </div>
      </div>
      <p className="text-xs text-ink-3">
        {getPreset(presetId)?.label ?? 'Custom'} · {page.width} × {page.height} px. Zoom never changes the card’s real size.
      </p>
    </div>
  )
}

export function PresetShape({ width, height, className }: { width: number; height: number; className?: string }) {
  const s = 28 / Math.max(width, height)
  return (
    <span className={cx('flex size-8 shrink-0 items-center justify-center', className)}>
      <span className="block rounded-[3px] border-[1.5px] border-ink-2 bg-surface" style={{ width: width * s, height: height * s }} />
    </span>
  )
}

// ---- selected text --------------------------------------------------------------

export function TextEditPanel({ sel }: { sel: TextSnapshot }) {
  const { editor } = useEditor()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(sel.sourceText)
  // Follow selection changes, but not our own echo while typing.
  const last = useRef(sel.sourceText)
  useEffect(() => {
    if (sel.sourceText !== last.current) {
      setValue(sel.sourceText)
      last.current = sel.sourceText
    }
  }, [sel.sourceText])
  const commit = (text: string) => {
    setValue(text)
    last.current = text
    void editor?.updateActive({ sourceText: text })
  }
  const insert = (key: string) => {
    const el = ref.current
    const t = token(key)
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    commit(value.slice(0, start) + t + value.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + t.length, start + t.length)
    })
  }
  return (
    <div className="space-y-4">
      <textarea
        ref={ref}
        aria-label="Text"
        value={value}
        onChange={(e) => commit(e.target.value)}
        rows={3}
        className="w-full resize-y rounded-xl bg-paper-2 px-3 py-2.5 leading-snug outline-none focus:ring-2 focus:ring-accent"
      />
      <Field label="Insert a field">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FIELDS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => insert(f.key)}
              className="h-8 shrink-0 rounded-full bg-accent-soft px-3 text-sm font-medium whitespace-nowrap text-accent"
            >
              {f.label}
            </button>
          ))}
        </div>
      </Field>
      {sel.hasList && (
        <Field label="List style">
          <Seg<ListStyle>
            label="List style"
            value={sel.listStyle ?? (sel.sourceText.includes('steps') ? 'numbered' : 'bullets')}
            options={[
              { value: 'bullets', label: '• Bullets' },
              { value: 'numbered', label: '1. Numbers' },
              { value: 'plain', label: 'Plain' },
            ]}
            onChange={(listStyle) => void editor?.updateActive({ listStyle })}
          />
        </Field>
      )}
      <FitControls sel={sel} />
    </div>
  )
}

function FitControls({ sel }: { sel: TextSnapshot }) {
  const { editor } = useEditor()
  const pageH = editor?.page.height ?? 1000
  return (
    <div className="rounded-2xl bg-paper-2/60 px-3 py-1">
      <Toggle
        label="Shrink to fit a box"
        checked={!!sel.maxHeight}
        onChange={(on) => void editor?.updateActive({ maxHeight: on ? Math.round(pageH * 0.3) : undefined })}
      />
      {sel.maxHeight !== undefined && (
        <div className="pb-2">
          <Slider label="Box height" value={sel.maxHeight} min={20} max={pageH} onChange={(maxHeight) => void editor?.updateActive({ maxHeight })} format={(v) => `${v} px`} />
          {sel.overflow ? (
            <p className="text-sm font-medium text-danger">Too much text for the box even at half size. Make the box taller or the text smaller.</p>
          ) : sel.shrunk ? (
            <p className="text-sm text-ink-3">Shrunk to fit this recipe.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function TextStylePanel({ sel }: { sel: TextSnapshot }) {
  const { editor } = useEditor()
  const up = (patch: Partial<TextSnapshot>) => void editor?.updateActive(patch)
  const font = getFont(sel.fontFamily)
  return (
    <div className="space-y-5">
      <Field label="Font">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FONTS.map((f) => (
            <button
              key={f.family}
              type="button"
              aria-pressed={f.family === sel.fontFamily}
              onClick={() => up({ fontFamily: f.family })}
              className={cx(
                'flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-xl px-1 ring-1 transition',
                f.family === sel.fontFamily ? 'bg-accent-soft ring-accent' : 'bg-surface ring-line',
              )}
            >
              <span className="text-2xl leading-none" style={{ fontFamily: `"${f.family}"` }}>
                Aa
              </span>
              <span className="mt-1 w-full truncate text-center text-[11px] text-ink-3">{f.label}</span>
            </button>
          ))}
        </div>
      </Field>
      <div className="flex gap-2">
        <div className="flex-1">
          <NumberInput label="Size" value={sel.fontSize} min={4} max={600} onChange={(fontSize) => up({ fontSize })} suffix="px" />
        </div>
        <button
          type="button"
          aria-pressed={sel.bold}
          aria-label="Bold"
          disabled={font.weights.length < 2}
          onClick={() => up({ bold: !sel.bold })}
          className={cx('flex size-11 items-center justify-center rounded-xl transition disabled:opacity-40', sel.bold ? 'bg-ink text-paper' : 'bg-paper-2')}
        >
          <Icon name="bold" size={19} />
        </button>
        <button
          type="button"
          aria-pressed={sel.italic}
          aria-label="Italic"
          onClick={() => up({ italic: !sel.italic })}
          className={cx('flex size-11 items-center justify-center rounded-xl transition', sel.italic ? 'bg-ink text-paper' : 'bg-paper-2')}
        >
          <Icon name="italic" size={19} />
        </button>
      </div>
      <Slider label="Size" value={sel.fontSize} min={8} max={Math.max(240, sel.fontSize)} onChange={(fontSize) => up({ fontSize })} format={(v) => `${v} px`} />
      <Field label="Alignment">
        <Seg
          label="Alignment"
          value={sel.textAlign}
          options={[
            { value: 'left', label: 'Left', icon: 'alignLeft' },
            { value: 'center', label: 'Centre', icon: 'alignCenter' },
            { value: 'right', label: 'Right', icon: 'alignRight' },
          ]}
          onChange={(textAlign) => up({ textAlign })}
        />
      </Field>
      <Field label="Colour">
        <ColorPicker label="Text colour" value={sel.fill} onChange={(fill) => up({ fill })} />
      </Field>
      <Slider label="Letter spacing" value={sel.charSpacing} min={-100} max={800} step={10} onChange={(charSpacing) => up({ charSpacing })} format={(v) => `${(v / 1000).toFixed(2)} em`} />
      <Slider label="Line height" value={sel.lineHeight} min={0.7} max={2.5} step={0.05} onChange={(lineHeight) => up({ lineHeight })} format={(v) => v.toFixed(2)} />
    </div>
  )
}

// ---- arrange (any object) ---------------------------------------------------------

export function ArrangePanel({ sel }: { sel: TextSnapshot | ShapeSnapshot | ImageSnapshot }) {
  const { editor } = useEditor()
  const up = (patch: Parameters<CardEditor['updateActive']>[0]) => void editor?.updateActive(patch)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="X" value={sel.x} onChange={(x) => up({ x })} />
        <NumberInput label="Y" value={sel.y} onChange={(y) => up({ y })} />
        <NumberInput label="W" value={sel.width} min={1} onChange={(width) => up({ width })} />
        {sel.kind !== 'text' && <NumberInput label="H" value={sel.height} min={1} onChange={(height) => up({ height })} />}
      </div>
      <Slider label="Rotation" value={sel.angle > 180 ? sel.angle - 360 : sel.angle} min={-180} max={180} onChange={(angle) => up({ angle })} format={(v) => `${v}°`} />
      <Slider label="Opacity" value={Math.round(sel.opacity * 100)} min={0} max={100} onChange={(v) => up({ opacity: v / 100 })} format={(v) => `${v}%`} />
      {sel.kind === 'shape' && (
        <Field label="Colour">
          <ColorPicker label="Shape colour" value={sel.fill} onChange={(fill) => up({ fill })} />
        </Field>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" icon="copy" className="flex-1" onClick={() => void editor?.duplicateActive()}>
          Duplicate
        </Button>
        <Button variant="secondary" icon="trash" className="flex-1 text-danger" onClick={() => editor?.deleteActive()}>
          Delete
        </Button>
      </div>
    </div>
  )
}
