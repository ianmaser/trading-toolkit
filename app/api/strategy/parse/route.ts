import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseStrategy } from '@/services/strategyParser'

const schema = z.object({
  prompt: z.string().min(10).max(500),
})

export async function POST(request: NextRequest) {
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
    const config = await parseStrategy(parsed.data.prompt)
    return NextResponse.json(config)
  } catch (err) {
    console.error('[strategy/parse]', err)
    return NextResponse.json({ error: 'Strategy parsing failed' }, { status: 500 })
  }
}
