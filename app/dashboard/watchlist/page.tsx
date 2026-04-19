'use client'

import { useWatchlist } from '@/hooks/useWatchlist'
import { useWatchlistQuotes } from '@/hooks/useMarketData'
import { TickerCard, TickerCardSkeleton } from '@/components/features/TickerCard'
import { WatchlistSearch } from '@/components/features/WatchlistSearch'
import { Star } from 'lucide-react'

export default function WatchlistPage() {
  const { watchlist, isLoading, error, addTicker, removeTicker, isAdding, removingSymbol } =
    useWatchlist()

  const symbols = watchlist.map((item) => item.symbol)
  const { data: quotes, isLoading: quotesLoading } = useWatchlistQuotes(symbols)

  const quoteMap = new Map((quotes ?? []).map((q) => [q.symbol, q]))

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <WatchlistSearch
          onAdd={addTicker}
          isAdding={isAdding}
          existingSymbols={symbols}
        />
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="text-sm text-red-500 mb-4">
          Failed to load watchlist: {error.message}
        </p>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          aria-label="Loading watchlist"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <TickerCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && watchlist.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <Star className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-lg font-medium">Your watchlist is empty</p>
          <p className="text-sm text-muted-foreground">
            Search for a ticker above to start tracking it.
          </p>
        </div>
      )}

      {/* Ticker grid */}
      {!isLoading && watchlist.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {watchlist.map((item) => (
            <TickerCard
              key={item.id}
              symbol={item.symbol}
              quote={quoteMap.get(item.symbol)}
              quoteLoading={quotesLoading}
              onRemove={() => removeTicker(item.symbol)}
              isRemoving={removingSymbol === item.symbol}
            />
          ))}
        </div>
      )}
    </div>
  )
}
