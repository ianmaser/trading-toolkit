import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { BacktestResult } from '@/types/backtest'

const conditionSchema = z.object({
  indicator: z.string().min(1),
  operator: z.enum(['>', '<', '>=', '<=', '==', 'crossover', 'crossunder']),
  value: z.number().optional(),
  target: z.string().optional(),
})

const strategyConfigSchema = z.object({
  conditions: z.array(conditionSchema).min(1),
  take_profit_r: z.number().positive(),
  stop_loss_r: z.number().positive(),
  entry_type: z.enum(['breakout', 'pullback', 'crossover']).optional(),
  direction: z.enum(['long', 'short']).optional().default('long'),
  // 10b additions
  entry_timing: z.enum(['close', 'next_open']).optional().default('next_open'),
  slippage_pct: z.number().min(0).max(5).optional().default(0),
  commission_per_trade: z.number().min(0).optional().default(0),
  exit_type: z.enum(['fixed', 'trailing_atr', 'trailing_pct']).optional().default('fixed'),
  trail_atr_multiplier: z.number().positive().optional().default(2),
  trail_pct: z.number().positive().optional().default(2),
})

const schema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  timeframe: z.enum(['1D', '4H', '1H', '15M', '5M']),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  strategy_config: strategyConfigSchema,
})

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const pythonUrl = process.env.PYTHON_SERVICE_URL
  if (!pythonUrl) {
    return NextResponse.json({ error: 'Python service not configured' }, { status: 503 })
  }

  // Proxy to Python service
  let pyResponse: Response
  try {
    pyResponse = await fetch(`${pythonUrl}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
  } catch {
    return NextResponse.json({ error: 'Python service unreachable' }, { status: 503 })
  }

  if (!pyResponse.ok) {
    let detail = 'Backtest failed'
    try {
      const err = await pyResponse.json() as { detail?: string }
      detail = err.detail ?? detail
    } catch {
      // ignore parse error
    }
    return NextResponse.json({ error: detail }, { status: pyResponse.status })
  }

  const result = (await pyResponse.json()) as BacktestResult
  return NextResponse.json(result)
}
