FILE: hooks/useBacktest.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Exports two mutation hooks for the backtest workflow:
- `useRunBacktest` — fires a strategy config at the Python backtest engine and returns results.
- `useSavePlaybook` — persists a completed backtest (config + results) to Supabase as a named playbook.

Both use `useMutation` (not `useQuery`) because they are triggered by explicit user actions
(button clicks), not by component mounting or data dependencies.

HOW IT WORKS (step by step):
1. `useRunBacktest` returns a mutation. The component calls `mutation.mutate(req)` when
   the user hits "Run Backtest". This fires a POST to `/api/backtest` with the full
   `BacktestRequest` object serialised as JSON.
2. The API route validates the request, forwards it to the Python FastAPI service on
   Railway, and returns the full `BacktestResult` (trades list, metrics, regime breakdown).
3. On success, `mutation.data` holds the result. The component reads it from there —
   there is no TanStack cache involved since backtest results are one-off computations,
   not data that other components need to share.
4. `useSavePlaybook` is called when the user names and saves a completed backtest.
   It inserts a row into the `playbooks` Supabase table with the name, strategy prompt,
   parsed config (as JSONB), and full results (as JSONB).
5. `.select('id').single()` at the end of the Supabase insert tells Postgres to return
   the newly created row's `id` immediately (a RETURNING clause under the hood). Supabase
   unwraps the single-row array into a plain object via `.single()`.
6. The returned `{ id }` is available in `mutation.data` and used by the UI to navigate
   to or highlight the saved playbook.

KEY CONCEPTS USED:
- **`useMutation` vs `useQuery`**: useQuery is for reading data that should be cached and
  automatically re-fetched. useMutation is for one-off write or compute operations that
  run only when explicitly triggered. Backtests and DB inserts are always the latter.
- **Supabase JSONB columns**: `strategy_config` and `backtest_results` are stored as
  Postgres JSONB — a binary JSON format that allows indexing and querying into nested
  fields. From the application's perspective they're plain JS objects; Supabase handles
  serialisation automatically.
- **`.select('id').single()`**: Supabase's chainable API for returning specific columns
  of the newly-inserted row. `.single()` unwraps a 1-row array result into a plain object
  and throws if 0 or 2+ rows are returned, which is the expected behaviour for an insert.
- **Defensive `.catch(() => ({}))`** on error parsing: if the API route returns a
  non-JSON error body, the catch prevents a parse error from masking the original failure.

INPUTS AND OUTPUTS:
- `useRunBacktest` input: `BacktestRequest` (symbol, timeframe, date range, strategy config).
  Output: `BacktestResult` (trades array, summary metrics, regime breakdown).
- `useSavePlaybook` input: `{ name, prompt, config, results }`.
  Output: `{ id: string }` — the Supabase row ID of the new playbook.

WHAT TO CHECK IF SOMETHING BREAKS:
- Backtest mutation hanging: check `/api/backtest` logs. The Python service on Railway
  may be cold-starting (first request after inactivity can take 10-20s) or the request
  may be timing out.
- Save mutation failing with Supabase error: check that the `playbooks` table exists and
  has the expected columns (`name`, `strategy_prompt`, `strategy_config`, `backtest_results`).
  Also verify RLS allows INSERT for authenticated users.
- `mutation.data` is undefined after success: ensure you're reading `mutation.data` not
  the raw return value — useMutation stores the result asynchronously in `.data`.

DEPENDENCIES:
- `@tanstack/react-query` (useMutation): write-operation hook with pending/error/success states.
- `@/lib/supabase/client`: browser Supabase client for direct DB writes protected by RLS.
