'use client'

import { TrendingUp, TrendingDown, Minus, Bot } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useInstitutionalData } from '@/hooks/useInstitutionalData'
import { useAppStore } from '@/lib/store'
import type { InstitutionalData } from '@/types/institutional'

interface CatalystStripProps {
  symbol: string
  earningsDate?: string | null
}

function fmt$M(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  return `$${(usd / 1000).toFixed(0)}K`
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

function OptionsFlowBadge({ data }: { data: InstitutionalData['unusualOptions'] }) {
  if (!data || data.length === 0) {
    return <span className="text-muted-foreground/50">Options —</span>
  }

  const calls = data.filter(f => f.type === 'call')
  const puts = data.filter(f => f.type === 'put')
  const callPremium = calls.reduce((s, f) => s + f.premiumUsd, 0)
  const putPremium = puts.reduce((s, f) => s + f.premiumUsd, 0)

  return (
    <div className="flex items-center gap-1.5" aria-label="Unusual options flow">
      {calls.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-green-500 font-medium text-[11px]">
          <TrendingUp className="h-3 w-3" aria-hidden="true" />
          {calls.length}C {fmt$M(callPremium)}
        </span>
      )}
      {puts.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-red-500 font-medium text-[11px]">
          <TrendingDown className="h-3 w-3" aria-hidden="true" />
          {puts.length}P {fmt$M(putPremium)}
        </span>
      )}
    </div>
  )
}

function ShortInterestBadge({ data }: { data: InstitutionalData['shortInterest'] }) {
  if (!data) {
    return <span className="text-muted-foreground/50">Short —</span>
  }

  const delta = data.changeVsPrevWeek
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaColor = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-muted-foreground'

  return (
    <div className="flex items-center gap-1" aria-label={`Short interest: ${fmtPct(data.shortFloat)}`}>
      <span className="text-[11px] text-muted-foreground">Short</span>
      <span className="text-[11px] font-medium">{fmtPct(data.shortFloat)}</span>
      <DeltaIcon className={cn('h-3 w-3', deltaColor)} aria-hidden="true" />
    </div>
  )
}

function DarkPoolBadge({ data }: { data: InstitutionalData['darkPool'] }) {
  if (!data || data.length === 0) {
    return <span className="text-muted-foreground/50">Dark pool —</span>
  }

  const totalNotional = data.reduce((s, p) => s + p.notionalUsd, 0)

  return (
    <div
      className="flex items-center gap-1"
      aria-label={`Dark pool: ${data.length} prints, ${fmt$M(totalNotional)} notional`}
    >
      <span className="text-[11px] text-muted-foreground">Dark pool</span>
      <span className="text-[11px] font-medium">{data.length} · {fmt$M(totalNotional)}</span>
    </div>
  )
}

export function CatalystStrip({ symbol, earningsDate }: CatalystStripProps) {
  const { data, isLoading } = useInstitutionalData(symbol)
  const { setBullEOpen, setActiveTicker } = useAppStore()

  function handleDeepAnalysis() {
    setActiveTicker(symbol)
    setBullEOpen(true)
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-1.5 bg-muted/40 border-b border-border text-xs overflow-x-auto"
      role="region"
      aria-label="Catalyst strip"
    >
      {isLoading ? (
        <>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </>
      ) : (
        <>
          <OptionsFlowBadge data={data?.unusualOptions ?? null} />
          <Separator />
          <ShortInterestBadge data={data?.shortInterest ?? null} />
          <Separator />
          <DarkPoolBadge data={data?.darkPool ?? null} />

          {earningsDate && (
            <>
              <Separator />
              <div className="flex items-center gap-1" aria-label={`Earnings: ${earningsDate}`}>
                <span className="text-muted-foreground">Earnings</span>
                <span className="font-medium">{earningsDate}</span>
              </div>
            </>
          )}
        </>
      )}

      <div className="ml-auto flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px] gap-1"
          onClick={handleDeepAnalysis}
          aria-label="Open BULL-E deep analysis"
        >
          <Bot className="h-3 w-3" aria-hidden="true" />
          Deep Analysis
        </Button>
      </div>
    </div>
  )
}

function Separator() {
  return <span className="text-border" aria-hidden="true">·</span>
}
