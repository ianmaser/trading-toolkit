FILE: components/features/BullEChat.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Renders the BULL-E floating chat widget — a circular FAB button fixed to the bottom-right
corner that toggles a sliding chat drawer. This is a placeholder for Phase 7. The drawer
renders the chrome (header, input bar, send button) but the message area and API connection
are not yet implemented.

HOW IT WORKS (step by step):
1. `bullEOpen` and `setBullEOpen` come from the Zustand global store. The sidebar, the FAB
   button, and any future "ask BULL-E about this signal" inline buttons all share this flag —
   clicking any of them opens the same drawer.
2. The FAB button (fixed, z-50, bottom-right) renders an X icon when the drawer is open and
   a MessageCircle icon when closed. Clicking it toggles `bullEOpen`.
3. The drawer is always present in the DOM — it slides in/out using Tailwind opacity and
   translateY transitions (`opacity-0 translate-y-4` ↔ `opacity-100 translate-y-0`).
   `pointer-events-none` prevents interaction when hidden.
4. `aria-hidden={!bullEOpen}` hides the drawer from screen readers when it's not visible.
5. The input and send button are `disabled` until Phase 7 wires in the `/api/chat` route.

KEY CONCEPTS USED:
- **Zustand store (`useAppStore`)**: The `bullEOpen` flag lives in global state so other
  parts of the UI (signal cards, pattern annotations) can open the drawer programmatically
  without prop drilling.
- **CSS transition drawer**: The drawer is shown/hidden with CSS classes rather than
  conditional rendering. This keeps the DOM stable and allows smooth CSS transitions —
  mounting/unmounting would lose the transition animation.

INPUTS AND OUTPUTS:
- No props — state is driven entirely by the Zustand store
- Output: a fixed FAB + sliding drawer in the bottom-right corner of the viewport

WHAT TO CHECK IF SOMETHING BREAKS:
- FAB not appearing: check that BullEChat is rendered inside the dashboard layout. It's
  currently included in the root layout or dashboard shell.
- Drawer not toggling: check that `useAppStore` is returning `bullEOpen` and `setBullEOpen`.
  If the store key was renamed, this component won't update.
- Phase 7 integration: this component will be rewritten to use Vercel AI SDK's `useChat`
  hook with the `/api/chat` route. See PLAN.md Prompt 15.

DEPENDENCIES:
- `@/lib/store` (useAppStore): Zustand global store, provides `bullEOpen` toggle.
- `lucide-react` (MessageCircle, X, Send): Icons for the FAB and drawer controls.
- `@/components/ui/button`, `@/components/ui/input`: shadcn/ui components.
