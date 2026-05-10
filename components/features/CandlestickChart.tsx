'use client'

// CandlestickChart — the main interactive OHLCV chart for the ticker detail page.
// Built on lightweight-charts (TradingView's open-source canvas charting library).
// Uses the imperative forwardRef pattern so the parent can call scrollToTime()
// without going through props or causing unnecessary re-renders.

import {
  // forwardRef lets a parent component pass a `ref` into this component so it can
  // call methods on the chart imperatively. Without forwardRef, refs can only point
  // to DOM elements, not to custom component instances.
  forwardRef,
  useEffect,
  // useImperativeHandle works together with forwardRef — it defines exactly which
  // methods the parent can call through the ref, rather than exposing the full DOM node.
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  // lightweight-charts is a canvas-based charting library. All chart operations are
  // imperative (createChart, addSeries, setData) rather than declarative React JSX.
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

// ChartAnnotation represents a price-level overlay drawn on the chart.
// 'line' draws a single horizontal price line (e.g. a key level).
// 'zone' draws two lines at priceMin and priceMax to indicate a support/resistance zone.
// Used by the Phase 6 signal engine to highlight entry zones and targets.
export interface ChartAnnotation {
  type: 'zone' | 'line'
  priceMin: number
  priceMax: number
  timeStart?: number
  timeEnd?: number
  color: string
  label?: string
}

// CandlestickChartHandle is the shape of the imperative API exposed to parents via the ref.
// A parent holds a `useRef<CandlestickChartHandle>()` and calls `ref.current.scrollToTime(ts)`
// to programmatically navigate the chart to a specific bar.
export interface CandlestickChartHandle {
  scrollToTime: (timestamp: number) => void
}

interface CandlestickChartProps {
  candles: Candle[]
  isLoading?: boolean
  // Callback fired when the user clicks a timeframe button.
  // The parent (TickerPageClient) uses this to re-fetch candles for the new timeframe.
  onTimeframeChange?: (timeframe: Timeframe) => void
  defaultTimeframe?: Timeframe
  // Optional price-level overlays from the signal engine (Phase 6+).
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

// `forwardRef` wraps the component so a parent can pass `ref={chartRef}` and receive
// the CandlestickChartHandle object back. The two type parameters are:
// 1. The type of the ref handle (CandlestickChartHandle)
// 2. The type of the component's props (CandlestickChartProps)
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
    // containerRef points to the <div> that lightweight-charts renders its canvas into.
    const containerRef = useRef<HTMLDivElement>(null)
    // These three refs store the chart and series instances so they can be accessed
    // across multiple useEffect hooks without being in component state (which would
    // cause extra re-renders every time they're set).
    const chartRef = useRef<IChartApi | null>(null)
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
    const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(defaultTimeframe)

    // ── Create chart on mount ─────────────────────────────────────────────
    // Empty dependency array `[]` means this runs exactly once when the component mounts.
    // It initializes the chart, creates the candle and volume series, and wires up cleanup.
    // Data is NOT set here — that's handled by a separate effect so data changes don't
    // recreate the entire chart (just call setData on the existing series).
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
        // CrosshairMode.Magnet snaps the crosshair to the nearest candle price
        // rather than tracking the exact cursor position.
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

      // `addSeries(CandlestickSeries, ...)` creates an OHLC candlestick series.
      // Up/down colors and wick colors are set here at creation time.
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: CHART_COLORS.upCandle,
        downColor: CHART_COLORS.downCandle,
        borderUpColor: CHART_COLORS.upCandle,
        borderDownColor: CHART_COLORS.downCandle,
        wickUpColor: CHART_COLORS.upCandle,
        wickDownColor: CHART_COLORS.downCandle,
      })

      // Volume is rendered as a separate Histogram series overlaid on the price chart.
      // `priceScaleId: 'volume'` assigns it to a named secondary price scale so it
      // doesn't share the y-axis with the candle prices.
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })

      // `scaleMargins` controls how much of the chart height the volume series occupies.
      // `top: 0.8` means the volume bars start at 80% down the chart, leaving the top
      // 80% for price candles and squeezing volume into the bottom 20%.
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
    // Runs whenever the `candles` prop changes (new timeframe, new symbol, data loaded).
    // Calls `setData` on the existing series instances rather than recreating the chart —
    // this preserves zoom level and scroll position between data updates.
    useEffect(() => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

      // `setData` replaces all existing data on the series in one call.
      // lightweight-charts requires data to be sorted by time ascending.
      candleSeriesRef.current.setData(
        candles.map(c => ({
          time: c.timestamp as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      )

      // Volume bars are colored green for up-closes, red for down-closes.
      // This is set per-bar in the `color` field of each data point.
      volumeSeriesRef.current.setData(
        candles.map(c => ({
          time: c.timestamp as Time,
          value: c.volume,
          color: c.close >= c.open ? CHART_COLORS.upVolume : CHART_COLORS.downVolume,
        }))
      )
    }, [candles])

    // ── Sync annotations ─────────────────────────────────────────────────
    // Runs whenever the `annotations` prop changes — removes all existing price lines
    // and redraws from the updated list. Price lines are lightweight-charts' mechanism
    // for horizontal lines drawn at specific price levels (used for support/resistance zones).
    useEffect(() => {
      if (!candleSeriesRef.current) return

      // Remove all existing price lines before re-drawing
      for (const line of candleSeriesRef.current.priceLines()) {
        candleSeriesRef.current.removePriceLine(line)
      }

      for (const ann of annotations) {
        if (ann.type === 'line') {
          // A single dashed horizontal line at `priceMin`.
          candleSeriesRef.current.createPriceLine({
            price: ann.priceMin,
            color: ann.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: ann.label ?? '',
          })
        } else {
          // Zone: render top and bottom boundary lines as dotted lines.
          // The label appears on the lower boundary line only.
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
    // Watches the container div and updates the chart canvas dimensions when the
    // container is resized (sidebar toggle, window resize, responsive layout shifts).
    // The empty dep array means this runs once on mount and cleans up on unmount.
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
    // `useImperativeHandle` defines the public API that parent components can call
    // through the `ref` passed via forwardRef. Without this, the ref would point to
    // the raw DOM node with no useful methods.
    //
    // `scrollToTime` centers the chart's visible range on a given Unix timestamp.
    // It preserves the current zoom level by computing the visible range width and
    // re-centering the same window on the target timestamp.
    useImperativeHandle(ref, () => ({
      scrollToTime: (timestamp: number) => {
        const ts = chartRef.current?.timeScale()
        if (!ts) return
        const range = ts.getVisibleRange()
        if (range) {
          // Compute half-width of the current visible range and center on the target.
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
