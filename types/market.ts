export type Timeframe = '1D' | '4H' | '1H' | '15M' | '5M'

export interface Candle {
  timestamp: number // Unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
  updatedAt: number // Unix ms
}

export interface TickerInfo {
  symbol: string
  name: string
  exchange: string
  type: string // 'CS' common stock, 'ETF', etc.
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly symbol: string,
    public readonly provider: 'polygon' | 'twelvedata' | 'both'
  ) {
    super(message)
    this.name = 'MarketDataError'
  }
}
