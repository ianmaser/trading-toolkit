import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { StrategyConfig } from '@/types/backtest'

const strategySchema = z.object({
  conditions: z
    .array(
      z.object({
        indicator: z.string(),
        operator: z.enum(['>', '<', '>=', '<=', '==', 'crossover', 'crossunder']),
        value: z.number().optional(),
        target: z.string().optional(),
      })
    )
    .min(1),
  take_profit_r: z.number().default(2),
  stop_loss_r: z.number().default(1),
  entry_type: z.enum(['breakout', 'pullback', 'crossover']).default('crossover'),
  direction: z.enum(['long', 'short']).default('long'),
})

const SYSTEM_PROMPT = `You are a trading strategy parser. Convert plain-English trading strategy descriptions into structured conditions.

Available indicators by category:

Momentum: RSI, MACD, MACD_SIGNAL, STOCH_K, STOCH_D, ADX
Trend: EMA_20, EMA_50, EMA_200, SUPERTREND, VWAP
Volatility: ATR, BB_WIDTH, BB_PCT
Volume: VOLUME_RATIO
Price: CLOSE

Candlestick Patterns (binary — use operator "==" and value 1):
- HAMMER, BULLISH_PIN_BAR — small body, long lower wick (bullish reversal)
- SHOOTING_STAR, BEARISH_PIN_BAR — small body, long upper wick (bearish reversal)
- DOJI — open ≈ close (indecision)
- BULLISH_ENGULFING — green candle engulfs prior red candle
- BEARISH_ENGULFING — red candle engulfs prior green candle
- MORNING_STAR — 3-bar bullish reversal
- EVENING_STAR — 3-bar bearish reversal
- INSIDE_BAR — bar contained within prior bar range (consolidation)
- OUTSIDE_BAR — bar engulfs prior bar range
- THREE_WHITE_SOLDIERS — 3 consecutive bullish candles
- THREE_BLACK_CROWS — 3 consecutive bearish candles

Market Structure (binary — use operator "==" and value 1):
- SWING_HIGH, SWING_LOW — confirmed local pivot highs/lows
- BOS_BULLISH — break of structure to upside (close above recent swing high)
- BOS_BEARISH — break of structure to downside (close below recent swing low)
- HIGHER_HIGH, HIGHER_LOW — uptrend continuation signals
- LOWER_HIGH, LOWER_LOW — downtrend continuation signals
- UPTREND_STRUCTURE — confirmed series of HH + HL
- DOWNTREND_STRUCTURE — confirmed series of LH + LL

Support / Resistance (binary — use operator "==" and value 1):
- NEAR_HORIZONTAL_SUPPORT — price near a level with 2+ prior bounces up
- NEAR_HORIZONTAL_RESISTANCE — price near a level with 2+ prior bounces down
- NEAR_RESISTANCE_TRENDLINE — price near a projected descending resistance trendline
- NEAR_SUPPORT_TRENDLINE — price near a projected ascending support trendline
- TRENDLINE_BREAKOUT_UP — price closes above resistance trendline
- TRENDLINE_BREAKOUT_DOWN — price closes below support trendline

Psychological Levels (binary — use operator "==" and value 1):
- NEAR_ROUND_NUMBER — price within 0.5% of a major round number ($1/$5/$10/$50/$100 etc.)
- AT_ROUND_FIVE — price within 0.5% of a $5/$10/$50/$100/$500/$1000 level

Rules:
- RSI is 0-100 (oversold < 30, overbought > 70)
- "crossover" means indicator A crosses ABOVE indicator B
- "crossunder" means indicator A crosses BELOW indicator B
- "crosses above" = crossover, "crosses below" = crossunder
- For ALL binary/pattern indicators (candlestick, market structure, S/R, psychological levels):
  ALWAYS use operator "==" and value 1. Never use crossover/crossunder for these.
- take_profit_r and stop_loss_r are R-multiples. Default to 2.0 and 1.0 if not specified.
- direction is "long" for buy setups, "short" for sell/short setups
- entry_type: "breakout" for price breaks and trendline breakouts, "pullback" for mean-reversion entries near S/R, "crossover" for indicator crosses
- If the user mentions a candlestick pattern by name, map it to the exact indicator name above with operator "==" value 1
- If the user mentions "break of structure", "BOS", or "structure break", use BOS_BULLISH or BOS_BEARISH
- If the user mentions "round number", "handle", or "psychological level", use NEAR_ROUND_NUMBER
- If the user mentions "trendline", use the appropriate trendline indicator
- Extract as many conditions as the user specifies`

export async function parseStrategy(prompt: string): Promise<StrategyConfig> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: strategySchema,
    system: SYSTEM_PROMPT,
    prompt: `Parse this trading strategy into structured conditions: "${prompt}"`,
  })

  return object as StrategyConfig
}
