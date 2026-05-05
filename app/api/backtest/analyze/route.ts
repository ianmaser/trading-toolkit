import { NextRequest } from 'next/server'
import { z } from 'zod'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import type { BacktestResult } from '@/types/backtest'

const schema = z.object({
  results: z.unknown(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return new Response('Invalid request', { status: 400 })
  }

  const results = parsed.data.results as unknown as BacktestResult

  const regimeText = Object.entries(results.regime_breakdown ?? {})
    .map(
      ([regime, stats]) =>
        `${regime}: ${stats.total_trades} trades, ${(stats.win_rate * 100).toFixed(1)}% win rate, ${stats.expectancy.toFixed(2)}R expectancy`
    )
    .join('\n')

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `You are BULL-E, an AI trading coach embedded in a trading toolkit called EDGE.
Analyze backtest results honestly — point out both strengths and red flags.
Be direct and lead with the most important insight.
Keep your response to 3-4 focused paragraphs. No bullet lists — flowing analysis only.`,
    prompt: `Analyze these backtest results and give your honest assessment of whether this edge looks real or overfitted:

Symbol: ${results.symbol} | Timeframe: ${results.timeframe} | Period: ${results.date_from} to ${results.date_to}
Total trades: ${results.total_trades}
Win rate: ${(results.win_rate * 100).toFixed(1)}%
Expectancy: ${results.expectancy.toFixed(2)}R per trade
Profit factor: ${results.profit_factor ?? 'N/A'}
Max drawdown: ${results.max_drawdown.toFixed(2)}R
Reward:risk ratio: ${results.avg_rr}:1

Regime breakdown:
${regimeText || 'No regime data'}

Key questions to address: Is the sample size (${results.total_trades} trades) statistically meaningful? Does the strategy perform consistently across market regimes, or is it regime-dependent? What are the biggest risks with this strategy going forward?`,
  })

  return result.toTextStreamResponse()
}
