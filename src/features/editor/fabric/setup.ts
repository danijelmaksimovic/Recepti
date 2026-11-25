/**
 * One-time Fabric configuration: our custom properties are always serialized,
 * text is edited in a side panel (in-canvas editing is unreliable on iOS),
 * and controls get the app's look with larger handles for touch.
 */
import { FabricObject, InteractiveFabricObject, Textbox } from 'fabric'
import { CUSTOM_PROPS } from '@/domain/card/doc'

let done = false

export function setupFabric() {
  if (done) return
  done = true
  FabricObject.customProperties = [...CUSTOM_PROPS]
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  Object.assign(InteractiveFabricObject.ownDefaults, {
    borderColor: '#b5532f',
    cornerColor: '#fffdf9',
    cornerStrokeColor: '#b5532f',
    cornerStyle: 'circle',
    transparentCorners: false,
    cornerSize: coarse ? 18 : 12,
    touchCornerSize: 36,
    borderScaleFactor: 1.5,
    padding: 6,
  })
  Object.assign(Textbox.ownDefaults, { editable: false, lockScalingFlip: true })
}

export interface CardTextProps {
  sourceText?: string
  listStyle?: 'bullets' | 'numbered' | 'plain'
  /** Size chosen by the user; `fontSize` may be smaller when shrunk to fit. */
  baseFontSize?: number
  /** When set, the text shrinks (to half size at most) to stay within this height. */
  maxHeight?: number
  name?: string
}

export type CardText = Textbox & CardTextProps & { overflow?: boolean }

export function isCardText(o: unknown): o is CardText {
  return o instanceof Textbox
}
