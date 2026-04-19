'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { WatchlistItem } from '@/types/watchlist'

async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('added_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export function useWatchlist() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const query = useQuery<WatchlistItem[], Error>({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
  })

  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('watchlist')
        .insert({ symbol: symbol.toUpperCase(), user_id: user.id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('symbol', symbol.toUpperCase())
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  return {
    watchlist: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addTicker: (symbol: string) => addMutation.mutate(symbol),
    removeTicker: (symbol: string) => removeMutation.mutate(symbol),
    isAdding: addMutation.isPending,
    removingSymbol: removeMutation.isPending ? removeMutation.variables : null,
  }
}
