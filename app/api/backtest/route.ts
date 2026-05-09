// Next.js Route Handler — POST /api/backtest
// This route is a secure proxy between the browser and the Python FastAPI service.
// It does three things the browser can't do safely on its own:
//   1. Verifies the user is authenticated (JWT check server-side)
//   2. Validates and sanitises the request body before it reaches Python
//   3. Forwards the request to the internal Python service URL (never exposed to clients)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { BacktestResult } from '@/types/backtest'

// A single backtest condition — mirrors the Condition model in the Python service.
const conditionSchema = z.object({
  indicator: z.string().min(1),
  operator: z.enum(['>', '<', '>=', '<=', '==', 'crossover', 'crossunder']),
  value: z.number().optional(),   // numeric threshold (e.g. 30 for RSI < 30)
  target: z.string().optional(),  // second indicator for crossover conditions
})

// The full strategy configuration. Nested inside the outer request schema.
// These fields map 1:1 to the BacktestRequest model the Python service expects.
const strategyConfigSchema = z.object({
  conditions: z.array(conditionSchema).min(1),
  take_profit_r: z.number().positive(),   // R-multiple (e.g. 2 = 2× the stop distance)
  stop_loss_r: z.number().positive(),
  entry_type: z.enum(['breakout', 'pullback', 'crossover']).optional(),
  direction: z.enum(['long', 'short']).optional().default('long'),
  // Execution realism settings (added in prompt 10b):
  entry_timing: z.enum(['close', 'next_open']).optional().default('next_open'), // when to enter
  slippage_pct: z.number().min(0).max(5).optional().default(0),      // fill price penalty %
  commission_per_trade: z.number().min(0).optional().default(0),      // flat fee per trade
  exit_type: z.enum(['fixed', 'trailing_atr', 'trailing_pct']).optional().default('fixed'),
  trail_atr_multiplier: z.number().positive().optional().default(2),  // for trailing_atr exits
  trail_pct: z.number().positive().optional().default(2),             // for trailing_pct exits
})

// Outer request schema — wraps strategy_config with the market data parameters.
const schema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  timeframe: z.enum(['1D', '4H', '1H', '15M', '5M']),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  strategy_config: strategyConfigSchema,
})

export async function POST(request: NextRequest) {
  // ── 1. Auth check — always first, before parsing the body ─────────────────
  // `supabase.auth.getUser()` verifies the JWT session cookie server-side.
  // This cannot be spoofed — the server checks the token against Supabase's
  // signing key. Never trust a userId passed in the request body.
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse and validate the request body ────────────────────────────────
  // request.json() throws if the body isn't valid JSON — catch it explicitly
  // so we return a clean 400 rather than an unhandled 500.
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

  // ── 3. Guard: Python service URL must be configured ───────────────────────
  // PYTHON_SERVICE_URL is the Railway deployment URL. It's never exposed to
  // the browser — only this server-side route knows it. 503 = service unavailable.
  const pythonUrl = process.env.PYTHON_SERVICE_URL
  if (!pythonUrl) {
    return NextResponse.json({ error: 'Python service not configured' }, { status: 503 })
  }

  // ── 4. Proxy to Python FastAPI service ────────────────────────────────────
  // We send `parsed.data` (the Zod-validated object) rather than the raw body.
  // This ensures defaults are applied (e.g. slippage_pct = 0) and no unexpected
  // fields reach the Python service.
  let pyResponse: Response
  try {
    pyResponse = await fetch(`${pythonUrl}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
  } catch {
    // fetch() itself throws if the network is unreachable (not on an HTTP error).
    return NextResponse.json({ error: 'Python service unreachable' }, { status: 503 })
  }

  // ── 5. Forward Python errors to the client ────────────────────────────────
  if (!pyResponse.ok) {
    let detail = 'Backtest failed'
    try {
      // FastAPI returns errors as `{ "detail": "..." }` — extract and forward.
      const err = await pyResponse.json() as { detail?: string }
      detail = err.detail ?? detail
    } catch {
      // Python returned a non-JSON error body — use the default message.
    }
    return NextResponse.json({ error: detail }, { status: pyResponse.status })
  }

  const result = (await pyResponse.json()) as BacktestResult
  return NextResponse.json(result)
}
