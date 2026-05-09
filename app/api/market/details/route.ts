// Next.js Route Handler — GET /api/market/details?symbol=AAPL
// Returns static ticker metadata: company name, exchange, asset type.
// Data is cached 24 hours in Redis — company names and exchanges don't change intraday.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTickerDetails } from '@/services/marketData'
import { MarketDataError } from '@/types/market'

const schema = z.object({
  symbol: z.string().min(1).max(10),
})

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const parsed = schema.safeParse({ symbol: searchParams.get('symbol') })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    const details = await getTickerDetails(parsed.data.symbol)
    return NextResponse.json(details)
  } catch (err) {
    // 502 = Polygon failed (no Twelve Data fallback for ticker details).
    // 500 = unexpected error on our side.
    if (err instanceof MarketDataError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
