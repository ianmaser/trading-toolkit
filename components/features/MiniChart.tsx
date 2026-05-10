'use client'

// MiniChart — a tiny sparkline-style line chart for the multi-timeframe confluence panel.
// It renders one candle series as a colored line (green/red/gray) to show directional bias
// at a glance. All chart axes, labels, and interaction handles are hidden — pure visual signal.

import { useEffect, useRef } from 'react'
import {
  // lightweight-charts is a TradingView open-source charting library. It uses a canvas-based
  // imperative API rather than declarative React rendering — the chart is created, updated,
  // and destroyed via direct method calls, not through JSX.
  createChart,
  LineSeries,
  ColorType,
  type IChartApi,
  type Time,
} from 'lightweight-charts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Candle, Timeframe } from '@/types/market'

// Trend is exported so TickerPageClient can use the same type when passing
// pre-computed trend values down to each MiniChart instance.
export type Trend = 'up' | 'down' | 'neutral'

interface MiniChartProps {
  candles: Candle[]
  timeframe: Timeframe
  // Pre-computed trend direction — computed by the parent using computeTrend()
  // so all three mini charts in the confluence panel share one computation pass.
  trend: Trend
  isLoading?: boolean
  className?: string
}

// Explicit hex colors because lightweight-charts cannot resolve CSS variables.
// Tailwind's CSS variable-based theme (e.g. hsl(var(--primary))) is not available
// inside the canvas rendering context.
const MINI_CHART_COLORS = {
  background: 'transparent',
  up: '#22c55e',
  down: '#ef4444',
  neutral: '#94a3b8',
  grid: '#1e293b',
  border: '#334155',
  text: '#64748b',
}

// Computes a directional trend signal from the last 10 candles in a series.
// Compares the most recent close to the close 10 bars ago as a percentage change.
// Returns 'up' if price is up more than 1%, 'down' if down more than 1%, else 'neutral'.
// A 1% threshold filters out noise while being sensitive enough for multi-timeframe reads.
// Exported so TickerPageClient can reuse the same logic without duplicating it.
export function computeTrend(candles: Candle[]): Trend {
  if (candles.length < 10) return 'neutral'
  const recent = candles[candles.length - 1].close
  const past = candles[candles.length - 10].close
  const pct = (recent - past) / past
  if (pct > 0.01) return 'up'
  if (pct < -0.01) return 'down'
  return 'neutral'
}

export default function MiniChart({
  candles,
  timeframe,
  trend,
  isLoading = false,
  className,
}: MiniChartProps) {
  // containerRef points to the <div> that lightweight-charts will render its canvas inside.
  // useRef is used (not useState) because we need a stable DOM reference that doesn't
  // trigger re-renders when assigned.
  const containerRef = useRef<HTMLDivElement>(null)
  // chartRef stores the chart instance so it can be accessed in the ResizeObserver callback
  // and in the cleanup function. Stored in a ref (not state) because the chart instance
  // itself doesn't cause any visual changes when it's set.
  const chartRef = useRef<IChartApi | null>(null)

  // This single useEffect handles the entire chart lifecycle: create, populate, observe, destroy.
  // It runs whenever `candles` or `trend` change — a full chart teardown and recreation.
  // This approach is simpler than splitting into init + data-sync effects (as CandlestickChart does)
  // because MiniChart is small and the recreation cost is negligible at 64px height.
  useEffect(() => {
    if (!containerRef.current) return

    // Choose line color based on computed trend before creating the chart.
    const lineColor =
      trend === 'up'
        ? MINI_CHART_COLORS.up
        : trend === 'down'
          ? MINI_CHART_COLORS.down
          : MINI_CHART_COLORS.neutral

    // `createChart` initializes the canvas-based chart inside the container element.
    // All axes, labels, crosshairs, and interaction handlers are explicitly disabled —
    // this chart is display-only with no user interaction.
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: MINI_CHART_COLORS.background },
        textColor: MINI_CHART_COLORS.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { horzLine: { visible: false }, vertLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    // `addSeries(LineSeries, ...)` adds a line series to the chart.
    // lightweight-charts v5 uses a generic `addSeries` factory with a series type constant
    // rather than the older `addLineSeries()` method.
    const series = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    if (candles.length > 0) {
      // `setData` takes an array of `{ time, value }` objects. `time` must be a Unix timestamp
      // in seconds (not milliseconds). lightweight-charts uses its own `Time` branded type
      // for this — the `as Time` cast satisfies TypeScript without a conversion.
      series.setData(
        candles.map(c => ({ time: c.timestamp as Time, value: c.close }))
      )
      // `fitContent` adjusts the visible time range to show all data points.
      chart.timeScale().fitContent()
    }

    chartRef.current = chart

    // ResizeObserver watches the container div and resizes the canvas whenever the
    // container's dimensions change (e.g. sidebar toggle, window resize). Without this,
    // the chart canvas would remain fixed at the size it was when first created.
    const observer = new ResizeObserver(entries => {
      if (!chartRef.current) return
      const { width, height } = entries[0].contentRect
      chartRef.current.applyOptions({ width, height })
    })
    observer.observe(containerRef.current)

    // Cleanup: disconnect the observer and destroy the chart instance.
    // lightweight-charts requires `chart.remove()` to free canvas memory.
    // If this isn't called, switching tickers would leak chart instances.
    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [candles, trend])

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const trendColor =
    trend === 'up'
      ? 'text-green-500'
      : trend === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground'

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{timeframe}</span>
        <TrendIcon
          className={cn('h-3.5 w-3.5', trendColor)}
          aria-label={`${timeframe} trend: ${trend}`}
        />
      </div>

      <div className="relative w-full h-16">
        {isLoading && (
          <div className="absolute inset-0 z-10">
            <Skeleton className="w-full h-full rounded" aria-label={`Loading ${timeframe} chart`} />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
          aria-label={`${timeframe} mini chart`}
        />
      </div>
    </div>
  )
}
