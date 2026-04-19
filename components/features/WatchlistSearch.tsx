'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTickerSearch } from '@/hooks/useMarketData'

interface WatchlistSearchProps {
  onAdd: (symbol: string) => void
  isAdding: boolean
  existingSymbols: string[]
}

export function WatchlistSearch({ onAdd, isAdding, existingSymbols }: WatchlistSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: results, isFetching } = useTickerSearch(debouncedQuery)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(symbol: string) {
    onAdd(symbol)
    setQuery('')
    setDebouncedQuery('')
    setOpen(false)
  }

  const filtered = (results ?? []).filter((r) => !existingSymbols.includes(r.symbol))

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-9 pr-4"
          placeholder="Add ticker…"
          aria-label="Search for a ticker to add to watchlist"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => query && setOpen(true)}
          disabled={isAdding}
          autoComplete="off"
        />
        {(isFetching || isAdding) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {open && debouncedQuery.length > 0 && (
        <ul
          role="listbox"
          aria-label="Ticker search results"
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden"
        >
          {filtered.length === 0 && !isFetching ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No results</li>
          ) : (
            filtered.map((ticker) => (
              <li key={ticker.symbol}>
                <button
                  role="option"
                  aria-selected={false}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                  onClick={() => handleSelect(ticker.symbol)}
                >
                  <span className="font-semibold text-sm w-16 shrink-0">{ticker.symbol}</span>
                  <span className="text-sm text-muted-foreground truncate">{ticker.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
