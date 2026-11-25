import { createContext, useContext } from 'react'
import type { CardEditor } from './fabric/engine'

export interface EditorContextValue {
  editor: CardEditor | null
  presetId: string
  setPreset: (presetId: string, width: number, height: number) => void
}

export const EditorContext = createContext<EditorContextValue>({ editor: null, presetId: '', setPreset: () => {} })

export const useEditor = () => useContext(EditorContext)
