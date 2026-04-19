// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ─── Mock lightweight-charts ──────────────────────────────────────────────────
// The library uses canvas APIs unavailable in happy-dom, so we mock it entirely.

const mockPriceLines: unknown[] = []
const mockCandleSeries = {
  setData: vi.fn(),
  createPriceLine: vi.fn(),
  removePriceLine: vi.fn(),
  priceLines: vi.fn(() => mockPriceLines),
}
const mockVolumeSeries = { setData: vi.fn() }
const mockPriceScale = { applyOptions: vi.fn() }
const mockTimeScale = {
  getVisibleRange: vi.fn(() => ({ from: 1000, to: 2000 })),
  setVisibleRange: vi.fn(),
  scrollToRealTime: vi.fn(),
}
const mockChart = {
  addSeries: vi.fn((type: unknown) => {
    if (type === 'candlestick-sentinel') return mockCandleSeries
    return mockVolumeSeries
  }),
  priceScale: vi.fn(() => mockPriceScale),
  timeScale: vi.fn(() => mockTimeScale),
  applyOptions: vi.fn(),
  remove: vi.fn(),
}

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  CandlestickSeries: 'candlestick-sentinel',
  HistogramSeries: 'histogram-sentinel',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Magnet: 1 },
  LineStyle: { Dashed: 2, Dotted: 1 },
}))

// ─── Import component AFTER mocks ─────────────────────────────────────────────

import CandlestickChart from '@/components/features/CandlestickChart'
import type { Candle } from '@/types/market'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const candles: Candle[] = [
  { timestamp: 1700000000, open: 180, high: 185, low: 179, close: 183, volume: 1_000_000 },
  { timestamp: 1700086400, open: 183, high: 187, low: 182, close: 186, volume: 1_200_000 },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CandlestickChart', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders a loading skeleton when isLoading is true', () => {
    render(<CandlestickChart candles={[]} isLoading />)

    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument()
    // Container is always in DOM (fix for chart init on mount)
    expect(screen.getByLabelText('Candlestick chart')).toBeInTheDocument()
  })

  it('hides the skeleton when not loading', () => {
    render(<CandlestickChart candles={candles} />)

    expect(screen.getByLabelText('Candlestick chart')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading chart')).not.toBeInTheDocument()
  })

  // ── Timeframe buttons ─────────────────────────────────────────────────────

  it('renders all five timeframe buttons', () => {
    render(<CandlestickChart candles={candles} />)

    for (const tf of ['1D', '4H', '1H', '15M', '5M']) {
      expect(screen.getByLabelText(`${tf} timeframe`)).toBeInTheDocument()
    }
  })

  it('marks the default timeframe as pressed', () => {
    render(<CandlestickChart candles={candles} defaultTimeframe="4H" />)

    expect(screen.getByLabelText('4H timeframe')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('1D timeframe')).toHaveAttribute('aria-pressed', 'false')
  })

  it('updates aria-pressed when a timeframe is clicked', () => {
    render(<CandlestickChart candles={candles} />)

    fireEvent.click(screen.getByLabelText('1H timeframe'))

    expect(screen.getByLabelText('1H timeframe')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('1D timeframe')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onTimeframeChange with the selected timeframe', () => {
    const onChange = vi.fn()
    render(<CandlestickChart candles={candles} onTimeframeChange={onChange} />)

    fireEvent.click(screen.getByLabelText('15M timeframe'))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('15M')
  })

  it('does not throw when onTimeframeChange is not provided', () => {
    render(<CandlestickChart candles={candles} />)

    expect(() => fireEvent.click(screen.getByLabelText('5M timeframe'))).not.toThrow()
  })

  // ── Timeframe button group accessibility ──────────────────────────────────

  it('timeframe button group has an accessible label', () => {
    render(<CandlestickChart candles={candles} />)

    expect(screen.getByRole('group', { name: 'Select timeframe' })).toBeInTheDocument()
  })
})
