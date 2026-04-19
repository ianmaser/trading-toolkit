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

const TTL_INSTITUTIONAL = 15 * 60 // 15 minutes

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

async function fetchUWOptionsFlow(symbol: string): Promise<UnusualOptionsFlow[]> {
  const from = daysAgo(7) // 7 calendar days covers ≥5 trading days
  const res = await fetch(
    `${UW_BASE}/api/option-trades/flow-alerts?ticker=${symbol}&date_from=${from}`,
    {
      headers: {
        Authorization: `Token ${process.env.UNUSUAL_WHALES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) throw new Error(`Unusual Whales options flow ${res.status}`)

  const json = await res.json()
  const rows: UnusualOptionsFlow[] = []

  for (const item of json.data ?? []) {
    const volume = Number(item.volume ?? 0)
    const openInterest = Number(item.open_interest ?? 0)
    const volumeRatio = openInterest > 0 ? volume / openInterest : 0

    // Filter: volume must be >3× open interest
    if (volumeRatio <= 3) continue

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
    const notional = item.notional != null
      ? Number(item.notional)
      : Number(item.size ?? 0) * Number(item.price ?? 0)
    // Filter: only prints above $1M notional
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

async function fetchTradierOptionsFlow(symbol: string): Promise<UnusualOptionsFlow[]> {
  // Tradier provides options chains, not pre-filtered unusual flow.
  // We fetch the nearest-term expiry chain and surface strikes where
  // volume > 3× open interest as a best-effort fallback.
  const expiry = await getNearestTradierExpiry(symbol)
  if (!expiry) return []

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

    if (volumeRatio <= 3) continue

    results.push({
      symbol: symbol.toUpperCase(),
      expiry,
      strike: Number(opt.strike ?? 0),
      type: opt.option_type === 'put' ? 'put' : 'call',
      volume,
      openInterest,
      volumeRatio,
      premiumUsd: volume * Number(opt.last ?? opt.bid ?? 0) * 100, // rough estimate
      timestamp: today,
    })
  }

  return results
}

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
  return dates[0] ?? null
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function getInstitutionalData(symbol: string): Promise<InstitutionalData> {
  const upper = symbol.toUpperCase()
  const cacheKey = `institutional:${upper}`

  // ── 1. Cache check ────────────────────────────────────────────────────────
  const cached = await redis.get<InstitutionalData>(cacheKey)
  if (cached) return cached

  // ── 2. Unusual Whales ─────────────────────────────────────────────────────
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
      // Fall through to Tradier
    }
  }

  // ── 3. Tradier fallback (options only) ────────────────────────────────────
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
      // Fall through to null result
    }
  }

  // ── 4. All providers failed ───────────────────────────────────────────────
  return { unusualOptions: null, shortInterest: null, darkPool: null }
}
