FILE: lib/store.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Defines the single global client-side state store for the EDGE app using Zustand.
It holds three pieces of UI state — sidebar expansion, BULL-E panel visibility, and
the currently active ticker symbol — that multiple unrelated components need to read
or write without passing props through every layer of the component tree.

HOW IT WORKS (step by step):
1. `create<AppStore>()` is called with a callback that receives a `set` function.
   Zustand uses this to build both the initial state values and the updater functions.
2. The callback returns an object that matches the `AppStore` interface exactly.
   Each piece of state (e.g. `sidebarExpanded`) is paired with its setter
   (e.g. `setSidebarExpanded`) in the same object.
3. `create` returns a React hook — `useAppStore` — that any component can import
   and call. The hook re-renders the component only when the specific slice of state
   it selected actually changes (Zustand uses shallow equality by default).
4. To read state: `const ticker = useAppStore(s => s.activeTicker)`
   To write state: `const setTicker = useAppStore(s => s.setActiveTicker)`
   Components can select only what they need, avoiding unnecessary re-renders.

KEY CONCEPTS USED:
- **Zustand `create`**: The factory function that builds the store and the hook in one
  call. Unlike Redux, there is no Provider wrapping the app — the store is a module-level
  singleton that any component can import directly.
- **`set` function**: Zustand's updater. It shallow-merges the object you pass into the
  current state, similar to React's `setState` in class components. You never mutate
  state directly.
- **Selector pattern**: Callers pass a selector function to `useAppStore` to pick only
  the state slice they need: `useAppStore(s => s.bullEOpen)`. This prevents a component
  from re-rendering when unrelated state changes.

INPUTS AND OUTPUTS:
- Inputs: none — the store is initialized with hardcoded defaults (sidebar closed,
  BULL-E hidden, no active ticker).
- Outputs: exports `useAppStore`, a React hook that returns the full store object or
  any selected slice of it.

WHAT TO CHECK IF SOMETHING BREAKS:
- Component not re-rendering when state changes: ensure the component is using a
  selector (`useAppStore(s => s.field)`) not destructuring the whole store.
- State not persisting across navigation: expected — Zustand in-memory state resets
  on hard refresh. If persistence is needed, add the `persist` middleware.
- TypeScript errors on `useAppStore`: check that `AppStore` interface and the
  implementation object returned by `create` stay in sync.

DEPENDENCIES:
- `zustand` (create): lightweight React state management library. No Provider required;
  the store is a plain JavaScript module that React hooks into via subscriptions.
