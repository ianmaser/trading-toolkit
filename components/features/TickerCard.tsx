'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useTickerDetails } from '@/hooks/useMarketData'
import { Quote } from '@/types/market'
import { cn } from '@/lib/utils'

interface TickerCardProps {
  symbol: string
  quote: Quote | undefined
  quoteLoading: boolean
  onRemove: () => void
  isRemoving: boolean
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return v.toString()
}

function formatPrice(p: number): string {
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TickerCard({ symbol, quote, quoteLoading, onRemove, isRemoving }: TickerCardProps) {
  const router = useRouter()
  const { data: details, isLoading: detailsLoading } = useTickerDetails(symbol)

  const positive = (quote?.changePercent ?? 0) >= 0

  return (
    <Card
      className="relative p-4 cursor-pointer hover:bg-accent/40 transition-colors group"
      onClick={() => router.push(`/dashboard/ticker/${symbol}`)}
      role="button"
      aria-label={`View ${symbol} ticker page`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/ticker/${symbol}`)}
    >
      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Remove ${symbol} from watchlist`}
        disabled={isRemoving}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Symbol + name */}
      <div className="mb-3 pr-6">
        <p className="font-bold text-base leading-tight">{symbol}</p>
        {detailsLoading ? (
          <Skeleton className="h-3 w-24 mt-1" />
        ) : (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {details?.name ?? '—'}
          </p>
        )}
      </div>

      {/* Price + change */}
      {quoteLoading ? (
        <div className="space-y-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-14" />
        </div>
      ) : quote ? (
        <>
          <p className="text-lg font-semibold leading-tight">
            ${formatPrice(quote.price)}
          </p>
          <Badge
            variant="outline"
            className={cn(
              'mt-1 text-xs font-medium border-0 px-0',
              positive ? 'text-green-500' : 'text-red-500'
            )}
          >
            {positive ? '+' : ''}{quote.changePercent.toFixed(2)}%
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            Vol {formatVolume(quote.volume)}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No data</p>
      )}
    </Card>
  )
}

export function TickerCardSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-5 w-16 mb-1" />
      <Skeleton className="h-3 w-28 mb-3" />
      <Skeleton className="h-5 w-20 mb-1" />
      <Skeleton className="h-4 w-12" />
    </Card>
  )
}
