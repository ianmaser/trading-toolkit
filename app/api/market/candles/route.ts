import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCandles } from '@/services/marketData'
import { MarketDataError, Timeframe } from '@/types/market'

const schema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  timeframe: z.enum(['1D', '4H', '1H', '15M', '5M'] satisfies [Timeframe, ...Timeframe[]]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const parsed = schema.safeParse({
    symbol: searchParams.get('symbol'),
    timeframe: searchParams.get('timeframe'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  })

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { symbol, timeframe, from, to } = parsed.data

  try {
    const candles = await getCandles(symbol, timeframe, from, to)
    return Response.json(candles)
  } catch (err) {
    if (err instanceof MarketDataError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
