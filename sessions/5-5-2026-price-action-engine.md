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

## Bug Found During Testing

### Stray `ta.` calls in regime detection and `calculate_indicators`
- **Cause:** `run_backtest()` had two inline calls to `ta.adx()` and `ta.atr()` for regime pre-computation that were missed when removing `pandas_ta`. Both failed silently in `except Exception`, setting `adx_series` and `atr_pct_series` to `None`, causing every trade to show "unknown" regime.
- **Also:** `calculate_indicators()` (used by `/indicators` endpoint) still called `ta.macd()`, `ta.bbands()`, `ta.adx()`, `ta.stoch()`, `ta.supertrend()` directly.
- **Fix:** Replaced all remaining `ta.xxx()` calls with the native `_calc_*` functions. Both bugs found via BULL-E's post-backtest analysis.

### Note on BULL-E as QA tool
BULL-E's backtest analysis correctly flagged both the regime classification failure and the low trade count as bugs/signals worth investigating. This automatic analysis pass on every result is genuinely useful during early development — keep it prominent in the UI rather than collapsing it.

---

## BOS Investigation (Second Half of Session)

### Problem: Low BOS_BULLISH trade count on SPY 1D
Testing example 21 (BOS_BULLISH + VOLUME_RATIO > 1.3, SPY 1D, 2021–2024) returned only 10 trades. Expected more given 4 years of daily data.

### Fix 1: BOS crossover semantics
**Problem:** Original `BOS_BULLISH` fired `1.0` on every bar where `close > swing_high_level` — i.e., it was a state, not an event. This meant the same BOS cluster produced multiple signals, but `in_trade = True` suppressed all but the first. After a trade closed, if price was still above the level, the signal would re-fire and potentially enter again on the same BOS event.

**Fix:** Changed to true crossover detection — fires only on the bar where `prev_close <= level AND curr_close > level`. One clean signal per breakout event. Applied to both `BOS_BULLISH` and `BOS_BEARISH`.

**Result:** 10 → 6 trades (correct — now counting distinct BOS events, not re-entries on the same one).

### Fix 2 (attempted, reverted): n=2 swings + 50-bar lookback
**Hypothesis:** Relaxing swing detection from n=3 → n=2 and extending lookback from 20 → 50 bars would surface more signals.

**What happened:** Went from 6 → 5 trades. Lost the COVID recovery BOS at $353. Root cause: with n=2, more frequent swing highs form in the 50-bar window. `last_sh` keeps updating to newer, closer levels. The relevant resistance that was broken in the COVID recovery was no longer the "most recent" swing high in the window, so the crossover never fired.

**Decision:** Reverted to n=3, lookback=20. The original parameters were correct.

### Diagnostic tests on SPY 4H
Ran three tests to understand signal frequency:

| Test | Conditions | Trades | WR | Exp | PF | Sharpe |
|------|-----------|--------|----|----|----|----|
| Daily + volume filter | BOS_BULLISH + VOL > 1.3, 1D | 6 | 50% | 0.75R | 2.50 | 1.48 |
| 4H no filter | BOS_BULLISH only, 4H | 84 | 35.7% | 0.25R | 1.39 | 2.01 |
| 4H + ADX > 25 | BOS_BULLISH + ADX > 25, 4H | 27 | 33.3% | 0.17R | 1.25 | 1.53 |

**Key finding:** ADX filter made things worse. The BOS signals in ranging markets (ADX < 25) are actually the most valuable — they often represent breakouts FROM consolidation, i.e., the start of a new trend. ADX > 25 captured late-stage continuation BOS instead, which underperformed.

**Key finding:** The 84-trade 4H version has the strongest stats and the most useful regime coherence: trending (38.5% WR, 0.35R exp) > ranging (34.5% WR, 0.21R exp). This is directionally sensible and not obviously curve-fitted.

### Known limitation identified: BOS semantic correctness
The current `BOS_BULLISH` implementation checks against the **most recent confirmed swing high** in the lookback window. This is not fully correct by SMC/ICT definition.

**The problem:** If multiple swing highs exist in the window and the most recent one is a lower high (bearish structure), breaking it fires a "bullish" BOS — which is incorrect. A true bullish BOS requires breaking the swing high that preceded the most recent swing low (confirming a structural shift from bearish to bullish).

**Planned fix (next session):** Implement SMC-correct BOS:
1. Find the most recent confirmed swing LOW
2. Find the swing HIGH that preceded it
3. Fire `BOS_BULLISH` when close crosses above that specific high

This will produce fewer but semantically correct signals.

---

## Next Up

### BOS semantic fix (deferred to next session)
Rewrite `BOS_BULLISH` / `BOS_BEARISH` to use the SMC-correct definition:
- Bullish BOS = close crosses above the swing high that preceded the most recent swing low
- Bearish BOS = close crosses below the swing low that preceded the most recent swing high

### Phase 6 — Signal Engine (Prompt 13 in PLAN.MD)
- `services/signalEngine.ts` — composite edge score 0–100 from indicator values
- `/api/signals/[symbol]` route with rate limiting
