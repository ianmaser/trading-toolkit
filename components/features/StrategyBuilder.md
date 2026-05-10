FILE: components/features/StrategyBuilder.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
A dual-mode strategy definition UI. The user can either type a strategy in plain English
("buy when RSI < 30 and EMA 20 crosses above EMA 50") or use dropdown menus to build it
visually. Both modes stay synchronized: typing triggers a debounced Claude AI parse that
populates the visual form; changing any visual control serializes the config back into the
text prompt. Prevents infinite update loops with a `skipSync` ref flag.

HOW IT WORKS (step by step):
1. The parent (BacktestPage) passes `value: StrategyConfig` and `onChange` — the component
   is fully controlled, it owns no config state.
2. `internalPrompt` holds the text when the parent doesn't control it; if the parent passes
   `prompt`, that is used instead (controlled-or-uncontrolled pattern).
3. On mount, `internalPrompt` is initialized by calling `serializeToPrompt(value)` — this
   converts the initial config into a readable sentence so the text box is never blank.
4. **Visual → text sync**: Whenever `value` changes (the parent prop updates), the `useEffect`
   re-serializes the config to a prompt string. This effect is skipped when `skipSync.current`
   is true, preventing a loop when the change originated from a visual control.
5. **Text → visual sync**: As the user types, `handlePromptChange` debounces 900ms, then
   POSTs the prompt to `/api/strategy/parse`. Claude returns a typed `StrategyConfig`. Before
   calling `onChange(config)`, `skipSync.current = true` is set so the sync effect doesn't
   overwrite the user's text with the re-serialized version.
6. **Visual builder**: Each condition row has three controls: Indicator (dropdown grouped by
   category), Operator (> < >= <= == crossover crossunder), and Value or Target indicator.
   - When a pattern indicator is selected (HAMMER, BOS_BULLISH, etc.), operator and value
     are auto-set to `== 1` and the operator/value controls are hidden — patterns are binary.
   - When a crossover/crossunder operator is selected, the value input is replaced with a
     second indicator dropdown for the crossover target.
7. `updateVisual` is the shared handler for all visual controls. It sets `skipSync.current`,
   calls `onChange(updated)`, and immediately re-serializes to update the text prompt.

KEY CONCEPTS USED:
- **`skipSync.current` anti-loop ref**: The text prompt and visual form are bidirectionally
  synced. Without protection, a visual change would trigger onChange → parent updates value
  → useEffect fires → setPrompt overwrites what the user typed. `skipSync.current = true`
  tells the effect to skip one cycle when the change came from the visual side.
- **Debounce (900ms)**: `handlePromptChange` stores the pending timeout in `debounceRef`.
  Each keystroke clears the previous timeout and sets a new one. The AI parse only fires
  after the user stops typing for 900ms. This prevents hammering the Claude API on every
  keypress.
- **`PATTERN_INDICATORS` Set**: Binary pattern indicators (candlestick shapes, structure
  events) use `Set<string>` for O(1) membership lookup. When an indicator is in this set,
  the operator/value controls are hidden and the condition is locked to `== 1`.
- **`serializeToPrompt`**: A pure function that converts a `StrategyConfig` back into a
  human-readable English sentence. Called on every visual change and on mount. This is the
  "source of truth" for what the text prompt should say given the current visual state.
- **`useCallback` for handlers**: `handlePromptChange` and `updateVisual` are memoized with
  `useCallback` to avoid recreating them on every render, which would cause unnecessary
  re-renders of child Select and Input components.

INPUTS AND OUTPUTS:
- Props: `value: StrategyConfig`, `onChange: (config) => void`,
  `prompt?: string` (optional controlled), `onPromptChange?: (text) => void`
- Output: a form UI that keeps a text textarea and a visual condition builder in sync
- Side effects: debounced POSTs to `/api/strategy/parse` on text changes

WHAT TO CHECK IF SOMETHING BREAKS:
- Text prompt not syncing after visual change: check `updateVisual` is setting
  `skipSync.current = true` before calling `onChange`. If it's missing, the useEffect
  runs and overwrites the serialized prompt with the same value (no-op, but can cause loops).
- AI parse not firing: check that the prompt is at least 15 characters (the minimum threshold
  in `handlePromptChange`). Also check that `/api/strategy/parse` returns 200 — check the
  network tab for 401 (auth) or 500 (Claude failure).
- Pattern indicator showing operator controls: `PATTERN_INDICATORS` may be missing the
  indicator string. Add it to the Set and ensure the Python service returns a binary value.
- Condition rows showing wrong operator after selecting crossover: `updateCondition` with
  a cross operator should set `target: 'EMA_50', value: undefined`. Check the onValueChange
  handler in the Operator Select.

DEPENDENCIES:
- `react` (useCallback, useEffect, useRef, useState): React hooks for state, memoization,
  and the sync loop protection ref.
- `@/types/backtest` (Direction, EntryTiming, EntryType, ExitType, Operator,
  StrategyCondition, StrategyConfig): TypeScript types for the strategy data model.
- `lucide-react` (Plus, Sparkles, Trash2): Icons for add/remove condition and parsing badge.
- `@/components/ui/*`: shadcn/ui form components (Select, Input, Label, Textarea, Badge, Button).
