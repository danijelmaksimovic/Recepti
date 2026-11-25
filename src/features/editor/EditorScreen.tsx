/**
 * Design Studio editor: full-screen, outside the app shell.
 * Desktop: tool rail + tool panel on the left, canvas, properties on the right.
 * Phone/tablet: canvas with a bottom tool bar and non-modal bottom panels.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDesign, getRecipe, saveDesign, listCategories } from '@/db'
import { migrateDoc } from '@/domain/card/doc'
import { describeSize, getPreset } from '@/domain/card/presets'
import type { TokenContext } from '@/domain/card/tokens'
import type { CanvasJSON, Design, Recipe } from '@/domain/types'
import { Toaster } from '@/app/Toaster'
import { IconButton } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { Icon, type IconName } from '@/ui/Icon'
import { EmptyState } from '@/ui/Page'
import { toast } from '@/ui/toast'
import { EditorContext, type EditorContextValue } from './context'
import { CardEditor, type SelectionSnapshot } from './fabric/engine'
import { renderThumb } from './fabric/render'
import { filesFrom } from '@/features/assets/importer'
import { isGraphicKind, useImporter } from '@/features/assets/hooks'
import { ImageFramePanel, ImagesPanel, PhotosPanel } from './imagePanels'
import { ArrangePanel, BackgroundPanel, CanvasPanel, FieldsPanel, TextEditPanel, TextStylePanel, TextToolPanel } from './panels'
import { gridSize, useEditorUI, type SelectionPanel, type ToolId } from './store'

const TOOLS: { id: ToolId; label: string; icon: IconName }[] = [
  { id: 'text', label: 'Text', icon: 'type' },
  { id: 'fields', label: 'Fields', icon: 'braces' },
  { id: 'photos', label: 'Photos', icon: 'camera' },
  { id: 'images', label: 'Images', icon: 'images' },
  { id: 'background', label: 'Background', icon: 'paint' },
  { id: 'canvas', label: 'Canvas', icon: 'frame' },
]

const SAVE_DELAY = 1000

function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

export function EditorScreen() {
  const { designId = '' } = useParams()
  const [design, setDesign] = useState<Design | null>()
  useEffect(() => {
    let live = true
    getDesign(designId).then((d) => live && setDesign(d ?? null))
    return () => {
      live = false
    }
  }, [designId])
  const recipe = useLiveQuery(() => (design ? getRecipe(design.recipeId).then((r) => r ?? null) : undefined), [design?.recipeId])

  if (design === undefined || (design && recipe === undefined)) return <div className="h-dvh bg-paper-2" />
  if (!design || !recipe)
    return (
      <div className="mx-auto max-w-lg px-4 pt-16">
        <EmptyState title="Card not found" body="It may have been deleted." />
      </div>
    )
  return <Editor key={design.id} design={design} recipe={recipe} />
}

function Editor({ design, recipe }: { design: Design; recipe: Recipe }) {
  const navigate = useNavigate()
  const desktop = useMedia('(min-width: 1024px)')
  const dark = useMedia('(prefers-color-scheme: dark)')
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [editor, setEditor] = useState<CardEditor | null>(null)
  const [presetId, setPresetId] = useState(design.preset)
  const categories = useLiveQuery(listCategories, [])
  const ui = useEditorUI()
  const { set } = ui

  const ctx: TokenContext = useMemo(
    () => ({ recipe, categoryName: categories?.find((c) => c.id === recipe.categoryId)?.name }),
    [recipe, categories],
  )
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const presetRef = useRef(presetId)
  presetRef.current = presetId

  // ---- autosave ----
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saving = useRef<Promise<void> | null>(null)
  const pending = useRef(false)
  const editorRef = useRef<CardEditor | null>(null)

  const save = useCallback(async () => {
    const ed = editorRef.current
    if (!ed) return
    clearTimeout(timer.current)
    if (saving.current) {
      pending.current = true
      return saving.current
    }
    pending.current = false
    set({ save: 'saving' })
    const run = (async () => {
      const doc = ed.toDoc()
      const { width, height } = ed.page
      try {
        let thumb: Blob | undefined
        try {
          thumb = await renderThumb(doc, { width, height }, ctxRef.current)
        } catch (e) {
          console.warn('Thumbnail failed', e)
        }
        await saveDesign(design.id, { canvas: doc as unknown as CanvasJSON, width, height, preset: presetRef.current, ...(thumb ? { thumb } : {}) })
        set({ save: pending.current ? 'dirty' : 'saved' })
      } catch (e) {
        console.error(e)
        set({ save: 'error' })
      }
    })()
    saving.current = run
    await run
    saving.current = null
    if (pending.current) void save()
  }, [design.id, set])

  const scheduleSave = useCallback(() => {
    set({ save: 'dirty' })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), SAVE_DELAY)
  }, [save, set])

  // ---- engine lifecycle ----
  useLayoutEffect(() => {
    const host = hostRef.current
    const el = canvasRef.current
    if (!host || !el) return
    const doc = migrateDoc(design.canvas)
    const ed = new CardEditor(el, host, { width: design.width, height: design.height, background: doc.background }, ctxRef.current, {
      onChange: scheduleSave,
      onSelection: (selection: SelectionSnapshot) => {
        const prev = useEditorUI.getState().selection
        // Close selection panels when the selection goes away or changes kind.
        const panel = !selection || selection.kind === 'multi' || (prev && prev.kind !== selection.kind) ? null : useEditorUI.getState().panel
        set({ selection, panel: selection ? panel : null })
      },
      onZoom: (zoom, fitZoom) => set({ zoom, fitZoom }),
      onEditText: () => set({ panel: 'edit', tool: null }),
    })
    editorRef.current = ed
    // Lets end-to-end tests inspect the canvas in dev builds.
    if (import.meta.env.DEV) (window as unknown as { __cardEditor?: CardEditor }).__cardEditor = ed
    set({ selection: null, tool: null, panel: null, save: 'saved' })
    ed.load(doc).then(() => setEditor(ed), (e) => {
      console.error(e)
      toast('This card could not be fully loaded.', { tone: 'error' })
      setEditor(ed)
    })
    const ro = new ResizeObserver(() => ed.resize())
    ro.observe(host)
    const flush = () => {
      if (useEditorUI.getState().save === 'dirty') void save()
    }
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      ro.disconnect()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
      // Let a final save serialize before Fabric is torn down.
      const pendingSave = saving.current
      editorRef.current = null
      if (pendingSave) void pendingSave.finally(() => ed.dispose())
      else ed.dispose()
    }
    // The design is loaded once per mount; later changes come from the editor.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => editor?.setTokenContext(ctx), [editor, ctx])
  useEffect(() => editor?.setDark(dark), [editor, dark])
  useEffect(() => {
    if (!editor) return
    editor.setGrid({ show: ui.grid.show, snap: ui.grid.snap, size: gridSize(ui.grid.density, editor.page.width, editor.page.height) })
  }, [editor, ui.grid, presetId])

  // Paste or drop images straight onto the card (they go to the Library too).
  const importer = useImporter()
  const runImport = importer.run
  const dropFiles = useCallback(
    async (files: File[]) => {
      const out = await runImport(files)
      for (const a of out?.assets ?? []) await editor?.addImage({ assetId: a.id, name: a.name || undefined, graphic: isGraphicKind(a.kind) })
    },
    [editor, runImport],
  )
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return
      const files = filesFrom(e.clipboardData)
      if (!files.length) return
      e.preventDefault()
      void dropFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [dropFiles])

  const setPreset = useCallback(
    (id: string, width: number, height: number) => {
      setPresetId(id)
      presetRef.current = id
      editor?.setCardSize(width, height)
    },
    [editor],
  )
  const ctxValue: EditorContextValue = useMemo(() => ({ editor, presetId, setPreset }), [editor, presetId, setPreset])

  const close = async () => {
    await save()
    navigate(`/recipes/${recipe.id}`)
  }

  const sel = ui.selection
  const selPanels: { id: SelectionPanel; label: string; icon: IconName }[] =
    sel?.kind === 'text'
      ? [
          { id: 'edit', label: 'Edit', icon: 'pen' },
          { id: 'style', label: 'Style', icon: 'type' },
          { id: 'arrange', label: 'Arrange', icon: 'sliders' },
        ]
      : sel?.kind === 'image'
        ? [
            { id: 'crop', label: 'Crop', icon: 'crop' },
            { id: 'arrange', label: 'Arrange', icon: 'sliders' },
          ]
        : sel?.kind === 'shape'
          ? [{ id: 'arrange', label: 'Arrange', icon: 'sliders' }]
          : []

  const renderSelectionPanel = (p: SelectionPanel) => {
    if (sel?.kind === 'text') {
      if (p === 'edit') return <TextEditPanel sel={sel} />
      if (p === 'style') return <TextStylePanel sel={sel} />
    }
    if (sel?.kind === 'image' && p === 'crop') return <ImageFramePanel sel={sel} />
    if (sel && sel.kind !== 'multi' && p === 'arrange') return <ArrangePanel sel={sel} />
    return null
  }
  const closeTool = () => set({ tool: null })
  const onDone = desktop ? undefined : closeTool
  const renderTool = (t: ToolId) =>
    t === 'text' ? (
      <TextToolPanel onDone={onDone} />
    ) : t === 'fields' ? (
      <FieldsPanel onDone={onDone} />
    ) : t === 'photos' ? (
      <PhotosPanel recipe={recipe} onDone={onDone} />
    ) : t === 'images' ? (
      <ImagesPanel onDone={onDone} />
    ) : t === 'background' ? (
      <BackgroundPanel />
    ) : (
      <CanvasPanel />
    )

  const zoomPct = Math.round(ui.zoom * 100)

  return (
    <EditorContext.Provider value={ctxValue}>
      <div className="fixed inset-0 flex flex-col bg-paper pt-safe pr-[var(--safe-right)] pl-[var(--safe-left)]">
        {/* Top bar */}
        <header className="z-20 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-paper/95 px-2 backdrop-blur lg:px-4">
          <IconButton icon="chevronLeft" label="Back to recipe" onClick={() => void close()} />
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate font-display text-[17px] leading-tight font-semibold">{recipe.name}</p>
            <p className="truncate text-xs text-ink-3">
              {[design.name !== getPreset(presetId)?.label && design.name, editor && describeSize(presetId, editor.page.width, editor.page.height)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <SaveBadge state={ui.save} onRetry={() => void save()} />
          <div className="hidden items-center gap-0.5 sm:flex">
            <IconButton icon="zoomOut" label="Zoom out" onClick={() => editor?.zoomBy(0.8)} />
            <button type="button" onClick={() => editor?.fit()} className="h-9 min-w-14 rounded-full px-2 text-sm font-medium text-ink-2 tabular-nums hover:bg-paper-2" title="Fit to screen">
              {zoomPct}%
            </button>
            <IconButton icon="zoomIn" label="Zoom in" onClick={() => editor?.zoomBy(1.25)} />
          </div>
          <button type="button" onClick={() => editor?.fit()} className="h-9 rounded-full px-2.5 text-sm font-medium text-ink-2 tabular-nums sm:hidden" aria-label="Fit to screen">
            {zoomPct}%
          </button>
          <IconButton
            icon="grid"
            label={ui.grid.show ? 'Hide grid' : 'Show grid'}
            aria-pressed={ui.grid.show}
            className={ui.grid.show ? 'text-accent' : undefined}
            onClick={() => ui.setGrid({ show: !ui.grid.show })}
          />
        </header>

        <div className={cx('relative flex min-h-0 flex-1', !desktop && 'flex-col')}>
          {/* Desktop tool rail + panel */}
          {desktop && (
            <>
              <nav aria-label="Tools" className="flex w-20 shrink-0 flex-col items-center gap-1 border-r border-line bg-paper-2/50 py-3">
                {TOOLS.map((t) => (
                  <RailButton key={t.id} {...t} active={ui.tool === t.id} onClick={() => set({ tool: ui.tool === t.id ? null : t.id })} />
                ))}
              </nav>
              {ui.tool && (
                <aside aria-label={TOOLS.find((t) => t.id === ui.tool)?.label} className="w-80 shrink-0 overflow-y-auto border-r border-line bg-surface p-4">
                  <PanelHeader title={TOOLS.find((t) => t.id === ui.tool)!.label} onClose={closeTool} />
                  {renderTool(ui.tool)}
                </aside>
              )}
            </>
          )}

          {/* Canvas */}
          <div
            ref={hostRef}
            className="relative min-w-0 flex-1 touch-none overflow-hidden select-none"
            data-testid="canvas-host"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) e.preventDefault()
            }}
            onDrop={(e) => {
              const files = filesFrom(e.dataTransfer)
              if (!files.length) return
              e.preventDefault()
              void dropFiles(files)
            }}
          >
            <canvas ref={canvasRef} />
            {importer.progress && (
              <div role="status" className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-medium text-paper">
                Importing…
              </div>
            )}
          </div>

          {/* Desktop properties */}
          {desktop && (
            <aside aria-label="Properties" className="w-80 shrink-0 overflow-y-auto border-l border-line bg-surface p-4">
              {sel && sel.kind !== 'multi' ? (
                <div className="space-y-6">
                  {selPanels.map((p) => (
                    <section key={p.id}>
                      <h2 className="mb-3 text-lg">{p.id === 'edit' ? 'Text' : p.id === 'crop' ? 'Frame' : p.label}</h2>
                      {renderSelectionPanel(p.id)}
                    </section>
                  ))}
                </div>
              ) : sel?.kind === 'multi' ? (
                <p className="text-ink-2">{sel.count} items selected.</p>
              ) : (
                <div className="space-y-3 text-sm text-ink-2">
                  <h2 className="text-lg text-ink">Card</h2>
                  <p>Select something on the card to change it, or add text, fields, photos and images from the left.</p>
                  <p>Drop or paste images here to put them on the card.</p>
                  <p className="text-ink-3">Scroll to pan, pinch or Ctrl + scroll to zoom, hold Space to drag the view.</p>
                </div>
              )}
            </aside>
          )}

          {/* Mobile sheet */}
          {!desktop && (ui.tool || (ui.panel && sel)) && (
            <MobileSheet
              title={ui.tool ? TOOLS.find((t) => t.id === ui.tool)!.label : selPanels.find((p) => p.id === ui.panel)?.label ?? ''}
              onClose={() => set({ tool: null, panel: null })}
            >
              {ui.tool ? renderTool(ui.tool) : ui.panel && renderSelectionPanel(ui.panel)}
            </MobileSheet>
          )}
        </div>

        {/* Mobile tool bar */}
        {!desktop && (
          <nav aria-label="Tools" className="z-20 shrink-0 border-t border-line bg-paper/95 pb-safe backdrop-blur">
            <ul className="no-scrollbar flex h-16 items-stretch justify-around gap-1 overflow-x-auto px-2">
              {sel && sel.kind !== 'multi' ? (
                <>
                  {selPanels.map((p) => (
                    <BarButton key={p.id} {...p} active={ui.panel === p.id} onClick={() => set({ panel: ui.panel === p.id ? null : p.id, tool: null })} />
                  ))}
                  <BarButton id="dup" label="Duplicate" icon="copy" onClick={() => void editor?.duplicateActive()} />
                  <BarButton id="del" label="Delete" icon="trash" onClick={() => editor?.deleteActive()} />
                  <BarButton id="done" label="Done" icon="check" onClick={() => editor?.deselect()} />
                </>
              ) : sel?.kind === 'multi' ? (
                <>
                  <BarButton id="del" label="Delete" icon="trash" onClick={() => editor?.deleteActive()} />
                  <BarButton id="done" label="Done" icon="check" onClick={() => editor?.deselect()} />
                </>
              ) : (
                TOOLS.map((t) => <BarButton key={t.id} {...t} active={ui.tool === t.id} onClick={() => set({ tool: ui.tool === t.id ? null : t.id, panel: null })} />)
              )}
            </ul>
          </nav>
        )}
      </div>
      <Toaster />
    </EditorContext.Provider>
  )
}

function SaveBadge({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === 'error')
    return (
      <button type="button" onClick={onRetry} className="h-8 rounded-full bg-danger/10 px-3 text-xs font-semibold text-danger">
        Not saved · Retry
      </button>
    )
  return (
    <span role="status" className="px-1.5 text-xs text-ink-3">
      {state === 'saved' ? 'Saved' : 'Saving…'}
    </span>
  )
}

function RailButton({ label, icon, active, onClick }: { label: string; icon: IconName; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx('flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition', active ? 'bg-surface text-accent shadow-card' : 'text-ink-2 hover:bg-surface/60')}
    >
      <Icon name={icon} size={22} />
      {label}
    </button>
  )
}

function BarButton({ label, icon, active, onClick }: { id: string; label: string; icon: IconName; active?: boolean; onClick: () => void }) {
  return (
    <li className="flex min-w-14 flex-1">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cx('flex w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition', active ? 'text-accent' : 'text-ink-2')}
      >
        <Icon name={icon} size={22} />
        {label}
      </button>
    </li>
  )
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xl">{title}</h2>
      <IconButton icon="close" label="Close panel" onClick={onClose} className="-mr-2" />
    </div>
  )
}

/** Keeps the bottom panel above the iOS keyboard. */
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => {
      vv.removeEventListener('resize', on)
      vv.removeEventListener('scroll', on)
    }
  }, [])
  return inset
}

function MobileSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const kb = useKeyboardInset()
  return (
    <section
      role="dialog"
      aria-label={title}
      className="z-30 max-h-[48%] shrink-0 overflow-y-auto rounded-t-[1.5rem] bg-surface px-4 pt-2 pb-4 shadow-[0_-8px_30px_-12px_rgb(60_40_20/0.35)]"
      style={kb ? { position: 'fixed', left: 0, right: 0, bottom: kb, maxHeight: '45dvh' } : undefined}
    >
      <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line" />
      <PanelHeader title={title} onClose={onClose} />
      {children}
    </section>
  )
}
