// Zustand is a lightweight global state manager for React. It lets any component
// anywhere in the tree read or update shared state without passing props down through
// every intermediate component ("prop drilling"). Think of it as a tiny, hook-based
// alternative to Redux — no actions, reducers, or providers required.
import { create } from 'zustand'

// AppStore defines the shape of the entire global client-side state.
// It follows Zustand's convention of co-locating each value with its setter
// in the same interface so consumers import a single hook for both reading and writing.
interface AppStore {
  // Whether the left navigation sidebar is expanded (wide) or collapsed (icon-only).
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void

  // Whether the BULL-E AI chat panel is currently open.
  bullEOpen: boolean
  setBullEOpen: (open: boolean) => void

  // The ticker symbol the user is currently viewing (e.g. "AAPL"), or null if none.
  // Used so BULL-E and other panels know which asset to reference without reading the URL.
  activeTicker: string | null
  setActiveTicker: (symbol: string | null) => void
}

// create<AppStore>() returns a React hook (`useAppStore`) that any component can call.
// The generic parameter tells Zustand the exact shape of the store so TypeScript can
// enforce correct usage at every call site.
//
// The callback receives `set`, which is Zustand's state updater. It works like
// React's setState — you pass a partial object and Zustand shallowly merges it
// into the current state. You never mutate state directly.
export const useAppStore = create<AppStore>((set) => ({
  // Initial values — sidebar closed, BULL-E hidden, no active ticker.
  sidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

  bullEOpen: false,
  setBullEOpen: (open) => set({ bullEOpen: open }),

  activeTicker: null,
  setActiveTicker: (symbol) => set({ activeTicker: symbol }),
}))
