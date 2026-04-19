'use client'

import { useQuery } from '@tanstack/react-query'
import type { InstitutionalData } from '@/types/institutional'

async function fetchInstitutionalData(symbol: string): Promise<InstitutionalData> {
  const res = await fetch(`/api/institutional/${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error ?? 'Failed to fetch institutional data')
  }
  return res.json()
}

export function useInstitutionalData(symbol: string) {
  return useQuery<InstitutionalData, Error>({
    queryKey: ['institutional', symbol],
    queryFn: () => fetchInstitutionalData(symbol),
    enabled: Boolean(symbol),
    staleTime: 15 * 60 * 1000, // 15 minutes — matches server cache TTL
    refetchOnWindowFocus: false,
  })
}
