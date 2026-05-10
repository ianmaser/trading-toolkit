// Next.js Route Handler — GET /api/market/quote
// Handles two different call signatures on the same endpoint:
//   - ?symbol=AAPL       → single quote
//   - ?symbols=AAPL,MSFT → batch quotes for the watchlist
// Two schemas are needed because the input shapes differ.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getMultipleQuotes, getQuote } from '@/services/marketData'
import { MarketDataError } from '@/types/market'

const singleSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
})

// `.transform()` is a Zod feature that runs a function on the validated value,
// converting it to a different type as part of parsing. Here it splits the
// comma-separated string "AAPL,MSFT,TSLA" into ["AAPL", "MSFT", "TSLA"].
// After safeParse, `parsed.data.symbols` is already a string[], not a string.
const multiSchema = z.object({
  symbols: z.string().transform((s) => s.split(',').map((sym) => sym.trim().toUpperCase())),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Multi-quote path: ?symbols=NVDA,AAPL,TSLA
  if (searchParams.has('symbols')) {
    const parsed = multiSchema.safeParse({ symbols: searchParams.get('symbols') })
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    // No try/catch needed here — getMultipleQuotes uses Promise.allSettled internally
    // and never throws. Failed individual symbols are silently dropped from the result.
    const quotes = await getMultipleQuotes(parsed.data.symbols)
    return Response.json(quotes)
  }

  // Single quote path: ?symbol=NVDA
  const parsed = singleSchema.safeParse({ symbol: searchParams.get('symbol') })
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const quote = await getQuote(parsed.data.symbol)
    return Response.json(quote)
  } catch (err) {
    // 502 = upstream provider failure. 500 = unexpected error on our side.
    if (err instanceof MarketDataError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
