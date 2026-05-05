# Session Notes — 5-5-2026 — Price Action & Market Structure Engine (Prompt 10c)

## What Was Completed

### Prompt 10c — Price Action & Market Structure Engine

Extended the backtest engine to support price action and market structure concepts that real traders use, beyond the existing mathematical indicators.

**Key architectural decision:** All new patterns implemented as binary (0/1) pandas Series in `_get_series()`. They slot into the existing `Condition` model via `operator: "==" value: 1` — zero changes to Condition model, Zod schemas, or API routes.

---

### `python-service/main.py`

**New helper functions** (added before `_get_series()`, ~line 125):

| Function | Purpose |
|----------|---------|
| `_swing_highs_series(df, n=3)` | Confirmed local swing highs; n-bar lag on right side — no lookahead |
| `_swing_lows_series(df, n=3)` | Confirmed local swing lows |
| `_consecutive_swing_comparison(df, swing_series, price_col, direction)` | 1.0 where current swing is higher/lower than previous (HH/HL/LH/LL) |
| `_trendline_series(df, mode, tolerance_pct=0.005, max_age=100)` | Projects line through 2 most recent confirmed swing points; modes: resistance/support/breakout_up/breakout_down; expires after max_age bars |
| `_horizontal_sr_series(df, mode, lookback=50, tolerance_pct=0.005)` | Detects clusters of local extrema with 2+ touches |
| `_round_number_series(df, mode, tolerance_pct=0.005)` | Proximity to psychological price levels |

**New `_get_series()` indicators (25 total):**

Candlestick patterns:
- `HAMMER` / `BULLISH_PIN_BAR` — small body in upper 2/3, lower wick > 2× body
- `SHOOTING_STAR` / `BEARISH_PIN_BAR` — small body in lower 2/3, upper wick > 2× body
- `DOJI` — |close - open| < range × 0.1
- `BULLISH_ENGULFING` / `BEARISH_ENGULFING` — body fully contains previous opposite body
- `INSIDE_BAR` / `OUTSIDE_BAR` — range contained/expanded vs prior bar
- `MORNING_STAR` / `EVENING_STAR` — 3-bar reversal patterns
- `THREE_WHITE_SOLDIERS` / `THREE_BLACK_CROWS` — 3-bar continuation patterns

Market structure:
- `SWING_HIGH` / `SWING_LOW` — confirmed local pivots (3-bar each side)
- `BOS_BULLISH` / `BOS_BEARISH` — close breaks above/below most recent swing level (20-bar lookback)
- `HIGHER_HIGH` / `HIGHER_LOW` / `LOWER_HIGH` / `LOWER_LOW` — consecutive swing comparisons
- `UPTREND_STRUCTURE` / `DOWNTREND_STRUCTURE` — confirmed H-L-H (HH+HL) or L-H-L (LH+LL) sequences

Support / Resistance:
- `NEAR_HORIZONTAL_SUPPORT` / `NEAR_HORIZONTAL_RESISTANCE` — near a level with 2+ historical touches
- `NEAR_RESISTANCE_TRENDLINE` / `NEAR_SUPPORT_TRENDLINE` — within 0.5% of projected trendline
- `TRENDLINE_BREAKOUT_UP` / `TRENDLINE_BREAKOUT_DOWN` — close crosses through projected trendline

Round numbers:
- `NEAR_ROUND_NUMBER` — within 0.5% of major round level ($1/$5/$10/$50/$100 scaled by price)
- `AT_ROUND_FIVE` — within 0.5% of $5/$10/$50/$100/$500/$1000 only

**Warmup bumped from 50 → 100** to accommodate swing/trendline history requirements.

---

### `components/features/StrategyBuilder.tsx`

- Replaced flat `INDICATORS` array (16 items) with `INDICATOR_GROUPS` (9 groups, ~41 indicators total)
- Added `ALL_INDICATORS` flat list derived from groups
- Added `PATTERN_INDICATORS` Set and `isPattern()` helper
- Added `SelectGroup` / `SelectLabel` to shadcn imports for grouped dropdown
- Indicator dropdown now grouped with section headers
- When a pattern indicator is selected: auto-sets `operator: "==" value: 1`, shows "pattern detected" badge, hides operator/value inputs
- Cross-target dropdown filters out pattern indicators (can't meaningfully cross a binary series)
- `serializeToPrompt()` renders pattern conditions as `"[INDICATOR] pattern is detected"`

---

### `services/strategyParser.ts`

- Replaced outdated `SYSTEM_PROMPT` (missing STOCH_K, STOCH_D, BB_PCT, VWAP, SUPERTREND) with comprehensive grouped prompt
- All new indicators documented with descriptions
- Binary pattern convention taught explicitly: "ALWAYS use operator '==' and value 1"
- Natural language mappings added: "break of structure" → BOS_BULLISH/BOS_BEARISH, "round number/handle" → NEAR_ROUND_NUMBER, etc.

---

## Next Up

Phase 6 — Signal Engine (Prompt 13 in PLAN.MD)
- `services/signalEngine.ts` — composite edge score 0–100 from indicator values
- `/api/signals/[symbol]` route with rate limiting
