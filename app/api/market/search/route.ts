import { NextRequest } from 'next/server'
import { z } from 'zod'
import { searchTickers } from '@/services/marketData'
import { MarketDataError } from '@/types/market'

const schema = z.object({
  query: z.string().min(1).max(50),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const parsed = schema.safeParse({ query: searchParams.get('query') })

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const results = await searchTickers(parsed.data.query)
    return Response.json(results)
  } catch (err) {
    if (err instanceof MarketDataError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
