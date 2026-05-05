// This service runs server-side only. It assembles institutional flow data from
// two providers and caches the result in Redis for 15 minutes.
//
// Provider hierarchy:
//   Primary:  Unusual Whales — full suite (options flow, short interest, dark pool)
//   Fallback: Tradier — options chain only (no short interest or dark pool)
//   Graceful: if both fail, returns null fields rather than throwing. Institutional
//             data is supplemental; the ticker page works fine without it.
import { Redis } from '@upstash/redis'
import type {
  DarkPoolPrint,
  InstitutionalData,
  ShortInterest,
  UnusualOptionsFlow,
} from '@/types/institutional'

// ─── Redis ───────────────────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const TTL_INSTITUTIONAL = 15 * 60 // 15 minutes in seconds

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns an ISO date string N calendar days ago (covers ≥5 trading days). */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const UW_BASE = 'https://api.unusualwhales.com'
const TRADIER_BASE = 'https://api.tradier.com/v1'

// ─── Unusual Whales fetchers ──────────────────────────────────────────────────

// Fetches options flow alerts from Unusual Whales for the last 7 calendar days.
// Applies a volume/open-interest filter to surface only "unusual" activity:
//
// Volume-to-open-interest ratio (volumeRatio) explained:
//   - Open interest = total number of outstanding contracts for a strike
//   - Volume = contracts traded today
//   - If volume >> open interest, new money is coming in (not just closing existing positions)
//   - volumeRatio > 3 means today's volume is more than 3× the standing open interest —
//     a strong signal that an institution is opening a fresh, directional position
async function fetchUWOptionsFlow(symbol: string): Promise<UnusualOptionsFlow[]> {
  const from = daysAgo(7) // 7 calendar days covers ≥5 trading days
  const res = await fetch(
    `${UW_BASE}/api/option-trades/flow-alerts?ticker=${symbol}&date_from=${from}`,
    {
      headers: {
        Authorization: `Token ${process.env.UNUSUAL_WHALES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 }, // bypass Next.js fetch cache; Redis is our cache
    }
  )

  if (!res.ok) throw new Error(`Unusual Whales options flow ${res.status}`)

  const json = await res.json()
  const rows: UnusualOptionsFlow[] = []

  for (const item of json.data ?? []) {
    const volume = Number(item.volume ?? 0)
    const openInterest = Number(item.open_interest ?? 0)
    const volumeRatio = openInterest > 0 ? volume / openInterest : 0

    // Only keep high-conviction flow where volume is >3× open interest.
    if (volumeRatio <= 3) continue

    // UW occasionally changes field names between API versions — the ?? fallbacks
    // handle both old and new naming conventions gracefully.
    rows.push({
      symbol: symbol.toUpperCase(),
      expiry: item.expiry ?? item.expiration_date ?? '',
      strike: Number(item.strike_price ?? item.strike ?? 0),
      type: (item.put_call ?? item.option_type ?? '').toLowerCase() === 'put' ? 'put' : 'call',
      volume,
      openInterest,
      volumeRatio,
      premiumUsd: Number(item.total_premium ?? item.premium ?? 0),
      timestamp: item.created_at ?? item.timestamp ?? new Date().toISOString(),
    })
  }

  return rows
}

// Fetches short interest data. Returns the two most recent weekly reports so we
// can compute week-over-week change (a rising short float is more meaningful than
// the absolute number alone).
async function fetchUWShortInterest(symbol: string): Promise<ShortInterest> {
  const res = await fetch(`${UW_BASE}/api/stock/${symbol}/short-interest`, {
    headers: {
      Authorization: `Token ${process.env.UNUSUAL_WHALES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`Unusual Whales short interest ${res.status}`)

  const json = await res.json()
  // data[0] = most recent report, data[1] = previous week's report
  const current = json.data?.[0] ?? {}
  const prev = json.data?.[1] ?? {}

  const shortFloat = Number(current.short_float ?? current.short_percent_float ?? 0)
  const shortFloatPrevWeek = Number(prev.short_float ?? prev.short_percent_float ?? 0)

  return {
    symbol: symbol.toUpperCase(),
    shortFloat,
    shortFloatPrevWeek,
    changeVsPrevWeek: shortFloat - shortFloatPrevWeek,
    updatedAt: current.updated_at ?? current.date ?? new Date().toISOString(),
  }
}

// Fetches dark pool (off-exchange) print data for the last 7 days.
// Dark pool trades are large block transactions executed away from public exchanges —
// when institutions buy/sell in size they often use dark pools to avoid moving the market.
// We filter to prints above $1M notional to exclude noise from small retail orders.
async function fetchUWDarkPool(symbol: string): Promise<DarkPoolPrint[]> {
  const from = daysAgo(7)
  const res = await fetch(
    `${UW_BASE}/api/darkpool/recent?ticker=${symbol}&date_from=${from}`,
    {
      headers: {
        Authorization: `Token ${process.env.UNUSUAL_WHALES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) throw new Error(`Unusual Whales dark pool ${res.status}`)

  const json = await res.json()
  const prints: DarkPoolPrint[] = []

  for (const item of json.data ?? []) {
    // `notional` may be pre-computed by UW, or we calculate it ourselves from size × price.
    const notional = item.notional != null
      ? Number(item.notional)
      : Number(item.size ?? 0) * Number(item.price ?? 0)

    // Filter out sub-$1M prints — these are too small to indicate institutional intent.
    if (notional < 1_000_000) continue

    prints.push({
      symbol: symbol.toUpperCase(),
      price: Number(item.price ?? 0),
      size: Number(item.size ?? item.volume ?? 0),
      notionalUsd: notional,
      timestamp: item.executed_at ?? item.timestamp ?? new Date().toISOString(),
      exchange: item.exchange ?? item.market_center ?? '',
    })
  }

  return prints
}

// ─── Tradier fallback (options flow only) ────────────────────────────────────
// Tradier is a brokerage API — it doesn't offer pre-filtered unusual flow or dark
// pool data. As a fallback, we pull the nearest-expiry options chain and apply the
// same volume/OI filter ourselves. This is a degraded approximation:
//   - No short interest data (Tradier doesn't have it)
//   - No dark pool data (Tradier doesn't have it)
//   - premiumUsd is estimated (volume × last price × 100 per contract)

async function fetchTradierOptionsFlow(symbol: string): Promise<UnusualOptionsFlow[]> {
  // Tradier's chain endpoint requires a specific expiry date — we first fetch the
  // list of available expiries and pick the nearest one.
  const expiry = await getNearestTradierExpiry(symbol)
  if (!expiry) return []

  // `greeks=false` skips delta/gamma/vega calculation to keep the response fast.
  const res = await fetch(
    `${TRADIER_BASE}/markets/options/chains?symbol=${symbol}&expiration=${expiry}&greeks=false`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TRADIER_API_KEY}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) throw new Error(`Tradier options chain ${res.status}`)

  const json = await res.json()
  const options = json.options?.option ?? []
  const results: UnusualOptionsFlow[] = []
  const today = new Date().toISOString()

  for (const opt of options) {
    const volume = Number(opt.volume ?? 0)
    const openInterest = Number(opt.open_interest ?? 0)
    const volumeRatio = openInterest > 0 ? volume / openInterest : 0

    // Same filter as UW — only surface high-conviction flow.
    if (volumeRatio <= 3) continue

    results.push({
      symbol: symbol.toUpperCase(),
      expiry,
      strike: Number(opt.strike ?? 0),
      type: opt.option_type === 'put' ? 'put' : 'call',
      volume,
      openInterest,
      volumeRatio,
      // Rough premium estimate: contracts × last price × 100 shares per contract.
      premiumUsd: volume * Number(opt.last ?? opt.bid ?? 0) * 100,
      timestamp: today,
    })
  }

  return results
}

// Fetches available option expiry dates from Tradier and returns the nearest one.
// Returns null if the request fails so the caller can return an empty array gracefully.
async function getNearestTradierExpiry(symbol: string): Promise<string | null> {
  const res = await fetch(
    `${TRADIER_BASE}/markets/options/expirations?symbol=${symbol}&includeAllRoots=false`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TRADIER_API_KEY}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) return null

  const json = await res.json()
  const dates: string[] = json.expirations?.date ?? []
  return dates[0] ?? null // dates are sorted ascending; [0] is the nearest expiry
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function getInstitutionalData(symbol: string): Promise<InstitutionalData> {
  const upper = symbol.toUpperCase()
  const cacheKey = `institutional:${upper}`

  // ── 1. Cache check ────────────────────────────────────────────────────────
  // Return cached data immediately if it's still within the 15-minute TTL.
  const cached = await redis.get<InstitutionalData>(cacheKey)
  if (cached) return cached

  // ── 2. Unusual Whales ─────────────────────────────────────────────────────
  // Run all three UW fetches in parallel with Promise.all — they're independent
  // API calls and parallelising cuts total latency from ~3× to ~1× slowest call.
  if (process.env.UNUSUAL_WHALES_API_KEY) {
    try {
      const [unusualOptions, shortInterest, darkPool] = await Promise.all([
        fetchUWOptionsFlow(upper),
        fetchUWShortInterest(upper),
        fetchUWDarkPool(upper),
      ])

      const data: InstitutionalData = { unusualOptions, shortInterest, darkPool }
      await redis.set(cacheKey, data, { ex: TTL_INSTITUTIONAL })
      return data
    } catch {
      // One or more UW calls failed — fall through to Tradier.
    }
  }

  // ── 3. Tradier fallback (options only) ────────────────────────────────────
  // Tradier can only provide a subset: options flow approximation, no short
  // interest or dark pool. shortInterest and darkPool are null in this case.
  if (process.env.TRADIER_API_KEY) {
    try {
      const unusualOptions = await fetchTradierOptionsFlow(upper)
      const data: InstitutionalData = {
        unusualOptions,
        shortInterest: null,
        darkPool: null,
      }
      await redis.set(cacheKey, data, { ex: TTL_INSTITUTIONAL })
      return data
    } catch {
      // Tradier also failed — fall through to the empty result.
    }
  }

  // ── 4. All providers failed ───────────────────────────────────────────────
  // Return null fields instead of throwing. The ticker page still renders without
  // institutional data — components check for null and show a graceful empty state.
  return { unusualOptions: null, shortInterest: null, darkPool: null }
}
