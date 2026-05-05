'use client'

import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { BacktestRequest, BacktestResult, StrategyConfig } from '@/types/backtest'

// ---------------------------------------------------------------------------
// Run backtest
// ---------------------------------------------------------------------------

export function useRunBacktest() {
  return useMutation({
    mutationFn: async (req: BacktestRequest): Promise<BacktestResult> => {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) {
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

interface SavePlaybookArgs {
  name: string
  prompt: string
  config: StrategyConfig
  results: BacktestResult
}

export function useSavePlaybook() {
  return useMutation({
    mutationFn: async ({ name, prompt, config, results }: SavePlaybookArgs) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('playbooks')
        .insert({
          name,
          strategy_prompt: prompt,
          strategy_config: config,
          backtest_results: results,
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return data as { id: string }
    },
  })
}
