'use client'

import { useRef, useState, useCallback } from 'react'
import { ArrowUp, ArrowDown, Minus, BarChart2, Calculator, Layers } from 'lucide-react'
import { useQuote } from '@/hooks/useMarketData'
import { useTickerDetails } from '@/hooks/useMarketData'
import { useCandles } from '@/hooks/useMarketData'
import { useAppStore } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import CandlestickChart, { type CandlestickChartHandle } from '@/components/features/CandlestickChart'
import MiniChart, { computeTrend } from '@/components/features/MiniChart'
import { CatalystStrip } from '@/components/features/CatalystStrip'
import type { Timeframe } from '@/types/market'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function mainChartRange(tf: Timeframe): { from: string; to: string } {
  const to = today()
  switch (tf) {
    case '1D':  return { from: daysAgoStr(180), to }
    case '4H':  return { from: daysAgoStr(60),  to }
    case '1H':  return { from: daysAgoStr(14),  to }
    case '15M': return { from: daysAgoStr(7),   to }
    case '5M':  return { from: daysAgoStr(3),   to }
  }
}

// ─── Confluence helpers ───────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'neutral'

function confluenceScore(trends: Trend[]): number {
  const raw = trends.reduce((acc, t) => {
    if (t === 'up') return acc + 1
    if (t === 'down') return acc - 1
    return acc
  }, 0)
  // raw: -3 to +3 → normalize to 0-100
  return Math.round(((raw + 3) / 6) * 100)
}

function confluenceLabel(score: number): string {
  if (score >= 75) return 'Bullish'
  if (score >= 55) return 'Leaning Bullish'
  if (score >= 45) return 'Neutral'
  if (score >= 25) return 'Leaning Bearish'
  return 'Bearish'
}

function confluenceColor(score: number): string {
  if (score >= 75) return 'text-green-500'
  if (score >= 55) return 'text-green-400'
  if (score >= 45) return 'text-muted-foreground'
  if (score >= 25) return 'text-red-400'
  return 'text-red-500'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriceChangeChip({ change, changePercent }: { change: number; changePercent: number }) {
  const positive = change >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-sm font-medium',
        positive ? 'text-green-500' : 'text-red-500'
      )}
      aria-label={`${positive ? 'Up' : 'Down'} ${Math.abs(changePercent).toFixed(2)}%`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(changePercent).toFixed(2)}%
      <span className="text-xs opacity-70">({positive ? '+' : ''}{change.toFixed(2)})</span>
    </span>
  )
}

function SignalCardPlaceholder() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Signal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">No signal generated yet</p>
          <p className="text-xs text-muted-foreground/60">
            Signal generation wires up in Phase 5.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function RiskCalculatorPlaceholder() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Risk Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="shares-input">Shares</label>
              <input
                id="shares-input"
                type="number"
                disabled
                placeholder="—"
                className="w-full h-8 px-2 text-sm rounded border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                aria-label="Shares input — requires a signal"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="dollar-risk-input">$ Risk</label>
              <input
                id="dollar-risk-input"
                type="number"
                disabled
                placeholder="—"
                className="w-full h-8 px-2 text-sm rounded border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                aria-label="Dollar risk input — requires a signal"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/50 text-center">
            Activates when a signal is available
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function PatternSidebarPlaceholder() {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Patterns
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <p className="text-sm text-muted-foreground/60">
            Pattern detection wires up in Phase 5.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TickerPageClientProps {
  symbol: string
}

export default function TickerPageClient({ symbol }: TickerPageClientProps) {
  const chartRef = useRef<CandlestickChartHandle>(null)
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1D')
  const { setActiveTicker } = useAppStore()

  // Set active ticker in global store for BULL-E context
  useState(() => { setActiveTicker(symbol) })

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: quote, isLoading: quoteLoading } = useQuote(symbol)
  const { data: details, isLoading: detailsLoading } = useTickerDetails(symbol)

  const mainRange = mainChartRange(activeTimeframe)
  const { data: mainCandles = [], isLoading: mainLoading } = useCandles(
    symbol, activeTimeframe, mainRange.from, mainRange.to
  )

  // Confluence mini charts — fixed ranges, always load in background
  const todayStr = today()
  const { data: daily1D = [], isLoading: daily1DLoading } = useCandles(symbol, '1D', daysAgoStr(60), todayStr)
  const { data: daily4H = [], isLoading: daily4HLoading } = useCandles(symbol, '4H', daysAgoStr(30), todayStr)
  const { data: daily1H = [], isLoading: daily1HLoading } = useCandles(symbol, '1H', daysAgoStr(7), todayStr)

  const trend1D = computeTrend(daily1D)
  const trend4H = computeTrend(daily4H)
  const trend1H = computeTrend(daily1H)
  const score = confluenceScore([trend1D, trend4H, trend1H])

  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    setActiveTimeframe(tf)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">
      {/* Catalyst strip */}
      <CatalystStrip symbol={symbol} />

      <div className="p-4 lg:p-6 flex flex-col gap-4 max-w-screen-2xl mx-auto w-full">
        {/* Top bar */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold">{symbol}</h1>

          {detailsLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : (
            <span className="text-muted-foreground text-sm">{details?.name}</span>
          )}

          {quoteLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : quote ? (
            <>
              <span className="text-xl font-semibold">${quote.price.toFixed(2)}</span>
              <PriceChangeChip change={quote.change} changePercent={quote.changePercent} />
            </>
          ) : null}
        </div>

        {/* Main grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-[3fr_2fr] gap-4">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <CandlestickChart
              ref={chartRef}
              candles={mainCandles}
              isLoading={mainLoading}
              defaultTimeframe={activeTimeframe}
              onTimeframeChange={handleTimeframeChange}
              className="min-h-[400px]"
            />

            <SignalCardPlaceholder />
            <RiskCalculatorPlaceholder />
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* Confluence panel */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Multi-Timeframe Confluence</CardTitle>
                  <span
                    className={cn('text-xs font-semibold', confluenceColor(score))}
                    aria-label={`Confluence score: ${score} — ${confluenceLabel(score)}`}
                  >
                    {confluenceLabel(score)} {score}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <MiniChart
                    candles={daily1D}
                    timeframe="1D"
                    trend={trend1D}
                    isLoading={daily1DLoading}
                  />
                  <MiniChart
                    candles={daily4H}
                    timeframe="4H"
                    trend={trend4H}
                    isLoading={daily4HLoading}
                  />
                  <MiniChart
                    candles={daily1H}
                    timeframe="1H"
                    trend={trend1H}
                    isLoading={daily1HLoading}
                  />
                </div>
              </CardContent>
            </Card>

            <PatternSidebarPlaceholder />
          </div>
        </div>
      </div>
    </div>
  )
}
