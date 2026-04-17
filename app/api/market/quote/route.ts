import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getMultipleQuotes, getQuote } from '@/services/marketData'
import { MarketDataError } from '@/types/market'

const singleSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
})

const multiSchema = z.object({
  symbols: z.string().transform((s) => s.split(',').map((sym) => sym.trim().toUpperCase())),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Multi-quote: ?symbols=NVDA,AAPL,TSLA
  if (searchParams.has('symbols')) {
    const parsed = multiSchema.safeParse({ symbols: searchParams.get('symbols') })
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const quotes = await getMultipleQuotes(parsed.data.symbols)
    return Response.json(quotes)
  }

  // Single quote: ?symbol=NVDA
  const parsed = singleSchema.safeParse({ symbol: searchParams.get('symbol') })
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const quote = await getQuote(parsed.data.symbol)
    return Response.json(quote)
  } catch (err) {
    if (err instanceof MarketDataError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
