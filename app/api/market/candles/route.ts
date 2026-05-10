// Next.js Route Handler — GET /api/market/candles
// In Next.js App Router, a file named route.ts inside app/api/... becomes an API
// endpoint. Exporting a function named GET, POST, etc. handles that HTTP method.
// NextRequest extends the standard Web API Request with Next.js-specific helpers
// like `.nextUrl` for URL parsing.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCandles } from '@/services/marketData'
import { MarketDataError, Timeframe } from '@/types/market'

// Input validation schema for the query string parameters.
// All API inputs are validated with Zod before any logic runs (per CLAUDE.md rules).
const schema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(), // normalise to uppercase
  // `satisfies [Timeframe, ...Timeframe[]]` is a TypeScript assertion that tells
  // the compiler this array is a non-empty tuple whose elements are all valid
  // Timeframe values. Zod's z.enum() requires a non-empty tuple type — without
  // `satisfies`, TypeScript would infer string[] which Zod rejects.
  timeframe: z.enum(['1D', '4H', '1H', '15M', '5M'] satisfies [Timeframe, ...Timeframe[]]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // enforce YYYY-MM-DD format
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: NextRequest) {
  // `request.nextUrl.searchParams` is a URLSearchParams object that parses
  // the query string. `.get('symbol')` returns null if the param is absent.
  const { searchParams } = request.nextUrl

  // `safeParse` validates without throwing — returns { success, data } or
  // { success: false, error }. Using safeParse (not parse) lets us return a
  // structured 400 response instead of an uncaught exception crashing the handler.
  const parsed = schema.safeParse({
    symbol: searchParams.get('symbol'),
    timeframe: searchParams.get('timeframe'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  })

  if (!parsed.success) {
    // `.flatten()` converts Zod's nested error object into a flat { fieldErrors, formErrors }
    // shape that's easier for the client to read and display per-field.
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { symbol, timeframe, from, to } = parsed.data

  try {
    const candles = await getCandles(symbol, timeframe, from, to)
    return Response.json(candles)
  } catch (err) {
    // MarketDataError means both providers (Polygon + Twelve Data) failed.
    // 502 "Bad Gateway" is the correct HTTP status when an upstream dependency
    // failed — it signals to the client that our server is fine but a third-party
    // service is not, which is more actionable than a generic 500.
    if (err instanceof MarketDataError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
