// Next.js Route Handler — POST /api/backtest/analyze
// Takes a completed BacktestResult and streams BULL-E's analysis back to the browser.
// Uses streaming (not a normal JSON response) so the UI can display text as it arrives
// rather than waiting for the full response — important for 4-paragraph analyses
// that could take 5+ seconds if returned all at once.
import { NextRequest } from 'next/server'
import { z } from 'zod'
// `streamText` from the Vercel AI SDK returns a streaming response. Unlike `generateObject`
// (which waits for the complete output then validates it), streamText sends tokens
// to the client incrementally as Claude produces them.
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import type { BacktestResult } from '@/types/backtest'

// `z.unknown()` accepts any value without validating its shape.
// We use it here because BacktestResult is a complex nested type and we trust
// that the data came from our own /api/backtest route. We cast it below rather
// than re-validating every field, which would duplicate the Python service's schema.
const schema = z.object({
  results: z.unknown(),
})

export async function POST(request: NextRequest) {
  // Auth check — same pattern as /api/backtest. Always first.
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

  // Cast the unknown to BacktestResult — safe because this data came from our own
  // backtest route which already validated it against the Python service's output.
  const results = parsed.data.results as unknown as BacktestResult

  // Build a plain-text summary of regime_breakdown to include in the prompt.
  // regime_breakdown is a dict keyed by market condition ("trending", "ranging", etc.)
  // with stats for each. We serialise it into readable lines before sending to Claude.
  const regimeText = Object.entries(results.regime_breakdown ?? {})
    .map(
      ([regime, stats]) =>
        `${regime}: ${stats.total_trades} trades, ${(stats.win_rate * 100).toFixed(1)}% win rate, ${stats.expectancy.toFixed(2)}R expectancy`
    )
    .join('\n')

  // `streamText` calls Claude and immediately returns a stream object — it does NOT
  // await the full response. The stream is then converted to an HTTP response that
  // the browser can read progressively. This is why the UI shows text appearing
  // word-by-word rather than all at once after a delay.
  //
  // Note: model slug should use dots — 'claude-sonnet-4.6' (known bug, tracked).
  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
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

  // `.toTextStreamResponse()` converts the AI SDK stream object into a standard
  // HTTP Response with the correct headers for server-sent text streaming.
  // The client reads this with the AI SDK's `useCompletion` hook or a plain fetch reader.
  return result.toTextStreamResponse()
}
