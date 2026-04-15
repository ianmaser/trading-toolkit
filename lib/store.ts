import { create } from 'zustand'

interface AppStore {
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  bullEOpen: boolean
  setBullEOpen: (open: boolean) => void
  activeTicker: string | null
  setActiveTicker: (symbol: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  bullEOpen: false,
  setBullEOpen: (open) => set({ bullEOpen: open }),
  activeTicker: null,
  setActiveTicker: (symbol) => set({ activeTicker: symbol }),
}))
