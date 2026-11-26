/**
 * Bridges the card editor and the separate sketch pad module: opens it over
 * the editor with the card as a faint guide, saves the result as a `drawing`
 * asset (strokes kept in `sketchData` so it stays editable) and places it.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addAsset, getAsset } from '@/db'
import { toast } from '@/ui/toast'
import { Button } from '@/ui/Button'
import { cleanSketch, emptySketch, type Bounds, type SketchData } from '@/features/sketch/model'
import type { SketchBackdrop } from '@/features/sketch/SketchPad'
import type { SketchExport } from '@/features/sketch/render'
import { useEditor } from './context'
import type { CardEditor } from './fabric/engine'
import { renderDoc } from './fabric/render'
import type { TokenContext } from '@/domain/card/tokens'
import { useEditorUI } from './store'

const SketchPad = lazy(() => import('@/features/sketch/SketchPad').then((m) => ({ default: m.SketchPad })))

/** Long side of a new drawing's artboard, in px. */
const ARTBOARD = 2048

interface Session {
  initial: SketchData
  backdrop?: SketchBackdrop
  /** Editing this asset (the selected image), or drawing a new one. */
  assetId?: string
  name: string
}

async function cardBackdrop(editor: CardEditor, ctx: TokenContext | undefined, without?: string) {
  const { width, height } = editor.cardSize
  try {
    return { image: await renderDoc(editor.docWithout(without), { width, height }, ctx, { width: Math.min(width, 1400) }), cardWidth: width }
  } catch (e) {
    console.warn('Card preview for the sketch pad failed', e)
    return undefined
  }
}

async function openSession(editor: CardEditor, ctx: TokenContext | undefined, assetId?: string): Promise<Session | null> {
  if (assetId) {
    const asset = await getAsset(assetId)
    const data = cleanSketch(asset?.sketchData)
    if (!asset || !data) return null
    const frame = data.bounds ? editor.drawingFrame(data.bounds) : null
    const card = frame && !frame.rotated ? await cardBackdrop(editor, ctx, editor.activeUid()) : undefined
    return { initial: data, assetId, name: asset.name || 'Drawing', backdrop: card && frame ? { ...card, scale: frame.scale, dx: frame.dx, dy: frame.dy } : undefined }
  }
  const { width, height } = editor.cardSize
  const a = ARTBOARD / Math.max(width, height)
  const card = await cardBackdrop(editor, ctx)
  return { initial: emptySketch(width * a, height * a), name: 'Drawing', backdrop: card && { ...card, scale: a, dx: 0, dy: 0 } }
}

export function DrawingHost({ ctx }: { ctx: TokenContext | undefined }) {
  const { editor } = useEditor()
  const request = useEditorUI((s) => s.sketch)
  const set = useEditorUI((s) => s.set)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!request || !editor) return setSession(null)
    let live = true
    editor.commitHistory()
    openSession(editor, ctx, request.assetId).then(
      (s) => {
        if (!live) return
        if (!s) {
          toast('This drawing can’t be edited any more.', { tone: 'error' })
          set({ sketch: null })
        } else setSession(s)
      },
      (e) => {
        console.error(e)
        if (live) set({ sketch: null })
      },
    )
    return () => {
      live = false
    }
    // ctx is read once when the pad opens.
  }, [request, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!request) return null
  if (!session || !editor) return <div className="fixed inset-0 z-40 bg-paper-2/80" aria-busy="true" />

  const done = async (data: SketchData, out: SketchExport) => {
    const { asset } = await addAsset({ kind: 'drawing', blob: out.blob, thumb: out.thumb, width: out.width, height: out.height, name: session.name, sketchData: data, mime: 'image/png' })
    if (session.assetId) {
      await editor.replaceActiveImage(asset.id, session.initial.bounds, out.bounds)
    } else {
      await placeDrawing(editor, asset.id, data, out.bounds)
    }
    set({ sketch: null })
  }

  return (
    <Suspense fallback={<div className="fixed inset-0 z-40 bg-paper-2/80" />}>
      <SketchPad
        initial={session.initial}
        backdrop={session.backdrop}
        title={session.assetId ? 'Edit drawing' : 'Draw'}
        onDone={done}
        onCancel={() => set({ sketch: null })}
      />
    </Suspense>
  )
}

/** Put a new drawing exactly where it was drawn over the card. */
function placeDrawing(editor: CardEditor, assetId: string, data: SketchData, b: Bounds) {
  const k = editor.cardSize.width / data.width // card px per artboard px
  return editor.addImage({ assetId, name: 'Drawing', graphic: true, width: b.w * k, centre: { x: (b.x + b.w / 2) * k, y: (b.y + b.h / 2) * k } })
}

/** "Edit drawing" for a selected image that came from the sketch pad. */
export function EditDrawingButton({ assetId, className }: { assetId?: string; className?: string }) {
  const editable = useIsDrawing(assetId)
  const set = useEditorUI((s) => s.set)
  if (!editable || !assetId) return null
  return (
    <Button variant="secondary" icon="scribble" className={className} onClick={() => set({ sketch: { assetId }, panel: null, tool: null })}>
      Edit drawing
    </Button>
  )
}

export function useIsDrawing(assetId?: string) {
  return useLiveQuery(async () => (assetId ? !!cleanSketch((await getAsset(assetId))?.sketchData) : false), [assetId]) ?? false
}
