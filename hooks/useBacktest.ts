'use client'

// Both hooks here use useMutation instead of useQuery.
// The key difference: useQuery auto-runs when the component mounts and re-runs when
// its queryKey changes. useMutation does nothing until you explicitly call `.mutate()`.
// Backtests and playbook saves are triggered by user actions (button clicks), not by
// the component mounting — so mutations are the right tool here.
import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { BacktestRequest, BacktestResult, StrategyConfig } from '@/types/backtest'

// ---------------------------------------------------------------------------
// Run backtest
// ---------------------------------------------------------------------------

// Fires a POST request to /api/backtest with the full strategy config. The API route
// validates the input, forwards it to the Python FastAPI service, and streams the
// result back. This hook returns the result via `mutation.data` once complete.
//
// No queryKey / cache involved — backtest results are one-off computations that the
// component holds in local state. The user can save them to Supabase with useSavePlaybook.
export function useRunBacktest() {
  return useMutation({
    mutationFn: async (req: BacktestRequest): Promise<BacktestResult> => {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) {
        // Defensive parse: if the error body isn't valid JSON (e.g. a gateway timeout),
        // the .catch(() => ({})) prevents a secondary crash and falls back to the status code.
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `Backtest failed (${res.status})`)
      }
      return res.json() as Promise<BacktestResult>
    },
  })
}

// ---------------------------------------------------------------------------
// Save as playbook
// ---------------------------------------------------------------------------

// The arguments required to save a completed backtest as a named playbook entry.
interface SavePlaybookArgs {
  name: string          // user-supplied name for this strategy
  prompt: string        // the natural-language strategy prompt text
  config: StrategyConfig // the parsed machine-readable strategy config
  results: BacktestResult // the full backtest result including trades and metrics
}

// Writes a completed backtest to the `playbooks` table in Supabase.
// Uses the browser Supabase client directly — RLS on the `playbooks` table ensures
// the insert is tagged to the logged-in user and only they can read it back.
//
// `.select('id').single()` tells Supabase to return the newly-inserted row's ID
// immediately after the insert completes. This is a Postgres RETURNING clause under
// the hood. The ID is used by the UI to navigate to the saved playbook.
export function useSavePlaybook() {
  return useMutation({
    mutationFn: async ({ name, prompt, config, results }: SavePlaybookArgs) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('playbooks')
        .insert({
          name,
          strategy_prompt: prompt,
          strategy_config: config,    // stored as JSONB column in Postgres
          backtest_results: results,  // stored as JSONB column in Postgres
        })
        .select('id')  // ask Supabase to return only the id field of the new row
        .single()      // unwrap the result from an array to a single object

      if (error) throw new Error(error.message)
      return data as { id: string }
    },
  })
}
