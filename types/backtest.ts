export type Operator = '>' | '<' | '>=' | '<=' | '==' | 'crossover' | 'crossunder'
export type Direction = 'long' | 'short'
export type EntryType = 'breakout' | 'pullback' | 'crossover'
export type EntryTiming = 'close' | 'next_open'
export type ExitType = 'fixed' | 'trailing_atr' | 'trailing_pct'
export type TradeOutcome = 'win' | 'loss' | 'breakeven'
export type Regime = 'trending' | 'ranging' | 'volatile' | 'unknown'

export interface StrategyCondition {
  indicator: string
  operator: Operator
  value?: number
  target?: string
}

export interface StrategyConfig {
  conditions: StrategyCondition[]
  take_profit_r: number
  stop_loss_r: number
  entry_type?: EntryType
  direction?: Direction
  // 10b additions
  entry_timing?: EntryTiming
  slippage_pct?: number
  commission_per_trade?: number
  exit_type?: ExitType
  trail_atr_multiplier?: number
  trail_pct?: number
}

export interface BacktestTrade {
  entry_idx: number
  exit_idx: number
  entry_price: number
  exit_price: number
  outcome: TradeOutcome
  r_multiple: number
  direction: Direction
  regime: Regime
  bars_held: number
}

export interface RegimeStats {
  total_trades: number
  win_rate: number
  expectancy: number
}

export interface BacktestResult {
  symbol: string
  timeframe: string
  date_from: string
  date_to: string
  total_trades: number
  win_rate: number
  expectancy: number
  profit_factor: number | null
  max_drawdown: number
  avg_rr: number
  // 10b additions
  avg_win_r: number | null
  avg_loss_r: number | null
  largest_win_r: number | null
  largest_loss_r: number | null
  max_consecutive_wins: number
  max_consecutive_losses: number
  sharpe_ratio: number | null
  expectancy_per_bar: number | null
  equity_curve: number[]
  trades: BacktestTrade[]
  regime_breakdown: Partial<Record<Regime, RegimeStats>>
}

export interface BacktestRequest {
  symbol: string
  timeframe: string
  date_from: string
  date_to: string
  strategy_config: StrategyConfig
}
