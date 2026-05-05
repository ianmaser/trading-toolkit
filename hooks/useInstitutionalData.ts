'use client'

import { useQuery } from '@tanstack/react-query'
import type { InstitutionalData } from '@/types/institutional'

// Fetches institutional flow data (dark pool prints, options flow, unusual activity)
// for a given symbol from our Next.js API route. The API route in turn calls
// Unusual Whales (primary) or Tradier (fallback) and caches the result in Redis
// for 15 minutes — so this client-side cache is intentionally aligned with that TTL.
//
// Note the defensive `.catch()` on `res.json()`: if the server returns a non-JSON
// error body (e.g. a raw network timeout), we fall back to a generic message
// rather than crashing with a JSON parse error.
async function fetchInstitutionalData(symbol: string): Promise<InstitutionalData> {
  const res = await fetch(`/api/institutional/${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error ?? 'Failed to fetch institutional data')
  }
  return res.json()
}

// Provides institutional flow data for a ticker page.
// staleTime is 15 minutes — intentionally matching the server-side Redis cache TTL.
// There's no point re-fetching more often than the server will give us new data.
// refetchOnWindowFocus is disabled because dark pool and options flow data doesn't
// meaningfully change in the seconds between a user switching tabs.
export function useInstitutionalData(symbol: string) {
  return useQuery<InstitutionalData, Error>({
    queryKey: ['institutional', symbol],
    queryFn: () => fetchInstitutionalData(symbol),
    enabled: Boolean(symbol),
    staleTime: 15 * 60 * 1000, // 15 minutes — matches server cache TTL
    refetchOnWindowFocus: false,
  })
}
