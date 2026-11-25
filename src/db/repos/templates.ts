import type { CanvasJSON, Design, Id, Template } from '@/domain/types'
import { db } from '../schema'
import { RecordNotFoundError, ValidationError, guardWrite } from '../errors'
import { extractAssetIds, newId, now } from '../util'
import { createDesign } from './designs'

export interface TemplateInput {
  name: string
  builtIn?: boolean
  preset: string
  width: number
  height: number
  canvas: CanvasJSON
  thumb?: Blob
  /** Lets bundled templates keep a stable id across devices. */
  id?: Id
}

export type TemplatePatch = Partial<Pick<Template, 'name' | 'preset' | 'width' | 'height' | 'canvas' | 'thumb'>>

function cleanName(name: string): string {
  const n = name.trim()
  if (!n) throw new ValidationError('Template needs a name')
  return n
}

export async function createTemplate(input: TemplateInput): Promise<Template> {
  if (!(input.width > 0 && input.height > 0)) throw new ValidationError('Template size must be positive')
  const t = now()
  const template: Template = {
    id: input.id ?? newId(),
    name: cleanName(input.name),
    builtIn: input.builtIn ?? false,
    preset: input.preset,
    width: input.width,
    height: input.height,
    canvas: input.canvas,
    assetIds: extractAssetIds(input.canvas),
    thumb: input.thumb,
    createdAt: t,
    updatedAt: t,
  }
  await guardWrite(() => db.templates.add(template))
  return template
}

export function getTemplate(id: Id): Promise<Template | undefined> {
  return db.templates.get(id)
}

export function listTemplates(): Promise<Template[]> {
  return db.templates.reverse().sortBy('updatedAt')
}

export async function saveTemplate(id: Id, patch: TemplatePatch): Promise<Template> {
  return guardWrite(() =>
    db.transaction('rw', db.templates, async () => {
      const current = await db.templates.get(id)
      if (!current) throw new RecordNotFoundError('Template', id)
      const next: Template = { ...current, ...patch, updatedAt: now() }
      if (patch.name !== undefined) next.name = cleanName(patch.name)
      next.assetIds = extractAssetIds(next.canvas)
      await db.templates.put(next)
      return next
    }),
  )
}

export async function deleteTemplate(id: Id): Promise<void> {
  await guardWrite(() => db.templates.delete(id))
}

/**
 * Apply a template to a recipe: its canvas is copied into a new design, so
 * later edits to either never touch the other (BLUEPRINT §4).
 */
export async function applyTemplate(templateId: Id, recipeId: Id): Promise<Design> {
  const template = await db.templates.get(templateId)
  if (!template) throw new RecordNotFoundError('Template', templateId)
  return createDesign({
    recipeId,
    name: template.name,
    templateId,
    preset: template.preset,
    width: template.width,
    height: template.height,
    canvas: structuredClone(template.canvas),
    thumb: template.thumb,
  })
}

/** Save a design's layout as a new reusable template. */
export async function saveDesignAsTemplate(designId: Id, name: string): Promise<Template> {
  const design = await db.designs.get(designId)
  if (!design) throw new RecordNotFoundError('Design', designId)
  return createTemplate({
    name,
    preset: design.preset,
    width: design.width,
    height: design.height,
    canvas: structuredClone(design.canvas),
    thumb: design.thumb,
  })
}
