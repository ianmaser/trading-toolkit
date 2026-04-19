'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Candle, Timeframe } from '@/types/market'

// ─── Public types ────────────────────────────────────────────────────────────

export interface ChartAnnotation {
  type: 'zone' | 'line'
  priceMin: number
  priceMax: number
  timeStart?: number
  timeEnd?: number
  color: string
  label?: string
}

export interface CandlestickChartHandle {
  scrollToTime: (timestamp: number) => void
}

interface CandlestickChartProps {
  candles: Candle[]
  isLoading?: boolean
  onTimeframeChange?: (timeframe: Timeframe) => void
  defaultTimeframe?: Timeframe
  annotations?: ChartAnnotation[]
  className?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIMEFRAMES: Timeframe[] = ['1D', '4H', '1H', '15M', '5M']

// CSS variable values aren't resolved by lightweight-charts — use explicit
// dark-mode-friendly colors that work on both dark and light backgrounds.
const CHART_COLORS = {
  background: 'transparent',
  text: '#94a3b8',       // slate-400
  grid: '#1e293b',       // slate-800
  border: '#334155',     // slate-700
  upCandle: '#22c55e',   // green-500
  downCandle: '#ef4444', // red-500
  upVolume: 'rgba(34,197,94,0.35)',
  downVolume: 'rgba(239,68,68,0.35)',
}

// ─── Component ───────────────────────────────────────────────────────────────

const CandlestickChart = forwardRef<CandlestickChartHandle, CandlestickChartProps>(
  function CandlestickChart(
    {
      candles,
      isLoading = false,
      onTimeframeChange,
      defaultTimeframe = '1D',
      annotations = [],
      className,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
    const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(defaultTimeframe)

    // ── Create chart on mount ─────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: CHART_COLORS.background },
          textColor: CHART_COLORS.text,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid },
          horzLines: { color: CHART_COLORS.grid },
        },
        crosshair: {
          mode: CrosshairMode.Magnet,
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.border,
        },
        timeScale: {
          borderColor: CHART_COLORS.border,
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: CHART_COLORS.upCandle,
        downColor: CHART_COLORS.downCandle,
        borderUpColor: CHART_COLORS.upCandle,
        borderDownColor: CHART_COLORS.downCandle,
        wickUpColor: CHART_COLORS.upCandle,
        wickDownColor: CHART_COLORS.downCandle,
      })

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })

      chartRef.current = chart
      candleSeriesRef.current = candleSeries
      volumeSeriesRef.current = volumeSeries

      return () => {
        chart.remove()
        chartRef.current = null
        candleSeriesRef.current = null
        volumeSeriesRef.current = null
      }
    }, [])

    // ── Sync candle + volume data ─────────────────────────────────────────
    useEffect(() => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

      candleSeriesRef.current.setData(
        candles.map(c => ({
          time: c.timestamp as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      )

      volumeSeriesRef.current.setData(
        candles.map(c => ({
          time: c.timestamp as Time,
          value: c.volume,
          color: c.close >= c.open ? CHART_COLORS.upVolume : CHART_COLORS.downVolume,
        }))
      )
    }, [candles])

    // ── Sync annotations ─────────────────────────────────────────────────
    useEffect(() => {
      if (!candleSeriesRef.current) return

      // Remove all existing price lines before re-drawing
      for (const line of candleSeriesRef.current.priceLines()) {
        candleSeriesRef.current.removePriceLine(line)
      }

      for (const ann of annotations) {
        if (ann.type === 'line') {
          candleSeriesRef.current.createPriceLine({
            price: ann.priceMin,
            color: ann.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: ann.label ?? '',
          })
        } else {
          // Zone: render top and bottom boundary lines
          candleSeriesRef.current.createPriceLine({
            price: ann.priceMax,
            color: ann.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: ann.label ?? '',
          })
          candleSeriesRef.current.createPriceLine({
            price: ann.priceMin,
            color: ann.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: '',
          })
        }
      }
    }, [annotations])

    // ── ResizeObserver ────────────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return

      const observer = new ResizeObserver(entries => {
        if (!chartRef.current) return
        const { width, height } = entries[0].contentRect
        chartRef.current.applyOptions({ width, height })
      })

      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }, [])

    // ── Imperative handle ─────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      scrollToTime: (timestamp: number) => {
        const ts = chartRef.current?.timeScale()
        if (!ts) return
        const range = ts.getVisibleRange()
        if (range) {
          const half = ((range.to as number) - (range.from as number)) / 2
          ts.setVisibleRange({
            from: (timestamp - half) as Time,
            to: (timestamp + half) as Time,
          })
        } else {
          ts.scrollToRealTime()
        }
      },
    }))

    // ── Handlers ──────────────────────────────────────────────────────────
    function handleTimeframeClick(tf: Timeframe) {
      setActiveTimeframe(tf)
      onTimeframeChange?.(tf)
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {/* Timeframe selector */}
        <div
          className="flex gap-1"
          role="group"
          aria-label="Select timeframe"
        >
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              type="button"
              onClick={() => handleTimeframeClick(tf)}
              aria-label={`${tf} timeframe`}
              aria-pressed={activeTimeframe === tf}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeTimeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart area — container is always in the DOM so the chart can
            initialize on mount. The skeleton overlays it while data loads. */}
        <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 rounded-lg overflow-hidden">
              <Skeleton className="w-full h-full" aria-label="Loading chart" />
            </div>
          )}
          <div
            ref={containerRef}
            className="w-full h-full"
            aria-label="Candlestick chart"
          />
        </div>
      </div>
    )
  }
)

export default CandlestickChart
