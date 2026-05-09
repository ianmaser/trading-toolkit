// Next.js Route Handler — POST /api/strategy/parse
// Receives a plain-English strategy description and returns a structured StrategyConfig
// by calling Claude via the strategyParser service. The parsed config is then used
// by the frontend to populate the StrategyBuilder and run a backtest.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseStrategy } from '@/services/strategyParser'

const schema = z.object({
  // min(10) rejects trivially short inputs like "buy" that Claude can't parse meaningfully.
  // max(500) caps prompt length to prevent prompt injection attempts via long inputs
  // and to keep Claude's context focused on the strategy description only.
  prompt: z.string().min(10).max(500),
})

export async function POST(request: NextRequest) {
  // Auth check — required so only logged-in users can trigger Claude API calls,
  // which cost money and count against rate limits.
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  try {
    // `parseStrategy` calls Claude via generateObject and returns a typed StrategyConfig.
    // If Claude's output fails schema validation, the AI SDK throws — caught below.
    const config = await parseStrategy(parsed.data.prompt)
    return NextResponse.json(config)
  } catch (err) {
    // Log the full error server-side for debugging (Claude validation failures are
    // verbose and useful), but return a generic message to the client.
    console.error('[strategy/parse]', err)
    return NextResponse.json({ error: 'Strategy parsing failed' }, { status: 500 })
  }
}
