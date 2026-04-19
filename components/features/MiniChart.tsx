'use client'

import { useEffect, useRef } from 'react'
import {
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

export type Trend = 'up' | 'down' | 'neutral'

interface MiniChartProps {
  candles: Candle[]
  timeframe: Timeframe
  trend: Trend
  isLoading?: boolean
  className?: string
}

const MINI_CHART_COLORS = {
  background: 'transparent',
  up: '#22c55e',
  down: '#ef4444',
  neutral: '#94a3b8',
  grid: '#1e293b',
  border: '#334155',
  text: '#64748b',
}

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
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const lineColor =
      trend === 'up'
        ? MINI_CHART_COLORS.up
        : trend === 'down'
          ? MINI_CHART_COLORS.down
          : MINI_CHART_COLORS.neutral

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

    const series = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    if (candles.length > 0) {
      series.setData(
        candles.map(c => ({ time: c.timestamp as Time, value: c.close }))
      )
      chart.timeScale().fitContent()
    }

    chartRef.current = chart

    const observer = new ResizeObserver(entries => {
      if (!chartRef.current) return
      const { width, height } = entries[0].contentRect
      chartRef.current.applyOptions({ width, height })
    })
    observer.observe(containerRef.current)

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
