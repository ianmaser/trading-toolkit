FILE: app/dashboard/backtest/page.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
The full Backtest Lab UI at /dashboard/backtest. The user defines a strategy using the
StrategyBuilder component, sets parameters (symbol, timeframe, date range), runs a backtest
against the Python service, and sees a results page with stats, an equity curve, a trade log,
regime breakdown, and a BULL-E AI analysis that streams in word-by-word. Results can be saved
as a playbook, and the same strategy can be tested against multiple tickers at once.

HOW IT WORKS (step by step):
1. The component starts in the 'input' `pageState`. The user sees the StrategyBuilder and
   a parameter form (symbol, timeframe, from/to dates).
2. On "Run Backtest", `handleRun` calls `runBacktest.mutateAsync(...)`. This is a TanStack
   Query mutation that POSTs to `/api/backtest`, which proxies to the Python FastAPI service.
   `mutateAsync` is the Promise-returning version of `mutate` — it lets us `await` the result
   inline rather than reading it from `runBacktest.data` in a `useEffect`.
3. While the mutation is in flight, `pageState` is set to 'loading' and a spinner is shown.
4. On success, `setResult(res)` stores the `BacktestResult` and `setPageState('results')`
   switches the view. `void streamAnalysis(res)` starts the BULL-E analysis as a
   fire-and-forget call — the `void` keyword discards the Promise intentionally so the
   user sees results immediately while the AI analysis streams in the background.
5. `streamAnalysis` manually reads the streaming response from `/api/backtest/analyze`:
   - `response.body` is a `ReadableStream` (a browser API for chunked HTTP).
   - `.getReader()` creates a reader locked to this stream.
   - Each `reader.read()` call yields `{ done, value }` where `value` is a `Uint8Array`.
   - `TextDecoder.decode(value, { stream: true })` converts the bytes to a string fragment.
     The `{ stream: true }` flag tells the decoder that more bytes are coming, preventing
     it from finalizing incomplete multi-byte characters mid-stream.
   - Each fragment is appended to the `analysis` state string using the updater form
     `(prev) => prev + fragment` to avoid stale closures inside the async loop.
6. The results view renders two rows of stat cards, an equity curve (recharts `LineChart`),
   a regime breakdown table, a scrollable trade log, and the BULL-E analysis card.
7. "Save as Playbook" opens a Dialog modal. `savePlaybook.mutateAsync` POSTs to Supabase
   via the `useSavePlaybook` hook. On success, a brief confirmation message appears before
   the modal closes.
8. "More Tickers" opens a second Dialog. `handleMultiRun` splits the user's input on commas
   and newlines, then runs backtests sequentially (not in parallel) to avoid overwhelming the
   Python service. Results appear row-by-row in a summary table as each run completes.

KEY CONCEPTS USED:
- **Three-state page machine** (`'input' | 'loading' | 'results'`): A single `pageState`
  string drives which of three completely different JSX trees is rendered. This is cleaner
  than multiple boolean flags (isLoading, hasResults, etc.) that can conflict.
- **`mutateAsync` vs `mutate`**: TanStack Query mutations have both. `mutate` is fire-and-
  forget (callback-based). `mutateAsync` returns a Promise you can `await`, which is needed
  here to get the result synchronously so we can call `streamAnalysis(res)` right after.
- **`void` fire-and-forget**: `void streamAnalysis(res)` starts the async stream but doesn't
  block the render update. Using `void` instead of just calling without assignment suppresses
  the TypeScript/ESLint "floating Promise" warning while making the intent explicit.
- **Manual streaming with ReadableStream + TextDecoder**: The Web Streams API lets the browser
  read chunked HTTP responses incrementally. This is the low-level API that libraries like
  the Vercel AI SDK's `useCompletion` hook use internally. We use it directly here for
  fine-grained control over how each chunk appends to state.
- **Sequential multi-ticker loop**: A `for...of` loop (not `Promise.all`) intentionally runs
  one backtest at a time. This prevents rate-limiting and makes progress visible row-by-row.
- **Recharts `LineChart`**: A declarative React charting library. The equity curve data is
  pre-shaped as `{ trade: number, value: number }[]` where `trade` is the x-axis trade index
  and `value` is the cumulative R.

INPUTS AND OUTPUTS:
- No props — this is a page component, it owns its own state entirely
- Output: full-page UI that cycles through input → loading → results states
- Side effects: POSTs to /api/backtest (Python service), /api/backtest/analyze (Claude),
  and Supabase (via useSavePlaybook)

WHAT TO CHECK IF SOMETHING BREAKS:
- Backtest returns no trades: the strategy conditions may be too restrictive. Check the
  Python service logs and the `total_trades` stat. Try relaxing entry conditions.
- BULL-E analysis shows nothing: check `ANTHROPIC_API_KEY` is set and the `/api/backtest/analyze`
  route returns a 200. If `isAnalyzing` is false and `analysis` is empty, the fetch may have
  failed silently — add a `console.error` inside the `streamAnalysis` catch block temporarily.
- Save fails with 401: the user's session may have expired. The `useSavePlaybook` mutation
  calls a Supabase client-side write, which requires an active auth session.
- Regime breakdown table is empty: the Python service may not be computing `regime_breakdown`.
  This was a known bug (stray `ta.adx()` calls) fixed during the 5-5-2026 price action session.

DEPENDENCIES:
- `recharts` (CartesianGrid, Line, LineChart, etc.): Declarative React charting library used
  for the equity curve visualization.
- `@/components/features/StrategyBuilder` (StrategyBuilder, DEFAULT_STRATEGY_CONFIG): The
  visual + AI-powered strategy builder component.
- `@/hooks/useBacktest` (useRunBacktest, useSavePlaybook): TanStack Query mutations for
  triggering backtests and saving playbooks to Supabase.
- `react` (useCallback, useRef, useState): React hooks for state and async logic.
- `lucide-react`: Icon library (ArrowLeft, BookmarkPlus, Bot, Loader2).
