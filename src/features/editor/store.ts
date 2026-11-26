import { create } from 'zustand'
import type { GridSettings, SelectionSnapshot } from './fabric/engine'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
export type ToolId = 'text' | 'fields' | 'photos' | 'images' | 'background' | 'canvas'
export type SelectionPanel = 'edit' | 'style' | 'crop' | 'arrange'

const GRID_KEY = 'studio.grid'

function loadGrid(): Omit<GridSettings, 'size'> & { density: GridDensity } {
  try {
    const v = JSON.parse(localStorage.getItem(GRID_KEY) ?? '{}')
    return { show: !!v.show, snap: !!v.snap, density: ['fine', 'medium', 'coarse'].includes(v.density) ? v.density : 'medium' }
  } catch {
    return { show: false, snap: false, density: 'medium' }
  }
}

export type GridDensity = 'fine' | 'medium' | 'coarse'
/** Grid spacing as a fraction of the card's short side. */
export const GRID_DIVISIONS: Record<GridDensity, number> = { fine: 36, medium: 18, coarse: 9 }

interface EditorUIState {
  selection: SelectionSnapshot
  zoom: number
  fitZoom: number
  save: SaveState
  tool: ToolId | null
  panel: SelectionPanel | null
  grid: { show: boolean; snap: boolean; density: GridDensity }
  set: (patch: Partial<Omit<EditorUIState, 'set' | 'setGrid'>>) => void
  setGrid: (patch: Partial<EditorUIState['grid']>) => void
}

export const useEditorUI = create<EditorUIState>((set, get) => ({
  selection: null,
  zoom: 1,
  fitZoom: 1,
  save: 'saved',
  tool: null,
  panel: null,
  grid: loadGrid(),
  set: (patch) => set(patch),
  setGrid: (patch) => {
    const grid = { ...get().grid, ...patch }
    try {
      localStorage.setItem(GRID_KEY, JSON.stringify(grid))
    } catch {
      /* private mode */
    }
    set({ grid })
  },
}))

export function gridSize(density: GridDensity, width: number, height: number) {
  return Math.round(Math.min(width, height) / GRID_DIVISIONS[density])
}
