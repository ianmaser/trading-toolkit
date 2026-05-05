# Backtest Testing Examples

A range of strategies for manual QA of the backtest engine — from simple to complex to edge-case stress tests.
Paste the prompt directly into the Strategy Prompt field on the Backtest Lab page.

---

## Simple (1–2 conditions)

### 1. RSI Oversold Bounce
**Prompt:** Buy when RSI is below 30. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Few trades (4–10 over 3yrs on 1D), high win rate, mean-reversion behavior
**What to check:** Equity curve should be smooth with few data points; regime breakdown likely "trending"

---

### 2. MACD Signal Crossover
**Prompt:** Buy when MACD crosses above MACD Signal. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Moderate trade frequency (20–60 over 3yrs on 1D)
**What to check:** Should generate more trades than RSI < 30; check bars_held distribution in trade log

---

### 3. EMA Golden Cross
**Prompt:** Buy when EMA 20 crosses above EMA 50. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Very few signals on 1D (trend-following), more on 1H/15M
**What to check:** Try same strategy on 1D vs 1H — trade count should increase significantly on lower timeframe

---

## Moderate (2–3 conditions)

### 4. Pullback in Uptrend
**Prompt:** Buy when EMA 20 is greater than EMA 200 and RSI is below 45. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Win rate should be higher than raw RSI < 30 due to trend filter
**What to check:** All trades should occur in trending regime; expectancy vs. strategy #1

---

### 5. ADX Trend Filter + MACD
**Prompt:** Buy when ADX is above 25 and MACD crosses above MACD Signal. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Fewer trades than raw MACD crossover but higher quality
**What to check:** Compare profit factor vs. strategy #2; should be higher with ADX filter

---

### 6. Stochastic Oversold
**Prompt:** Buy when Stochastic K is below 20 and Stochastic D is below 20. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Short-term exhaustion signals — works better on 15M/1H than 1D
**What to check:** Run on both 1D SPY and 15M SPY — compare trade count and expectancy

---

## Complex (3+ conditions)

### 7. Triple EMA Stack + Volume
**Prompt:** Buy when EMA 20 is greater than EMA 50 and EMA 50 is greater than EMA 200 and Volume Ratio is above 1.5. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** Very selective — full trend alignment with volume surge, 5–15 trades on 1D
**What to check:** High expectancy expected; verify VOLUME_RATIO condition is respected in trade entry bars

---

### 8. VWAP + MACD + ADX (Intraday)
**Prompt:** Buy when Close is above VWAP and MACD crosses above MACD Signal and ADX is above 20. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1H or 15M | Entry: Next Open | Exit: Fixed
**Expected:** Best on intraday timeframes; VWAP resets daily so 1D data won't be meaningful
**What to check:** VWAP utility on 1D vs 1H; regime breakdown variety

---

### 9. BB Squeeze Breakout
**Prompt:** Buy when BB Width is below 0.015 and EMA 20 crosses above EMA 50. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** Rare setups (volatility compression + momentum break); test trailing stop vs fixed
**What to check:** Compare fixed exit vs trailing_atr on same strategy — trailing should capture more on breakout continuation

---

## Stress Tests / Edge Cases

### 10. Everything Must Align (ultra-restrictive)
**Prompt:** Buy when EMA 20 is greater than EMA 50 and EMA 50 is greater than EMA 200 and RSI is below 45 and ADX is above 25 and Volume Ratio is above 1.3. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** 0–5 trades over 3 years — tests "no trades" / near-empty result state
**What to check:** UI should handle 0 trades gracefully (equity curve empty state, all stats showing 0 or —)

---

### 11. Wide-Open RSI (high frequency)
**Prompt:** Buy when RSI is below 70. Take profit 1R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Fixed
**Expected:** 50–200+ trades — stress tests equity curve rendering and trade log scroll performance
**What to check:** Trade log scroll at 100+ rows; equity curve with many points; Sharpe calculation with large N

---

### 12. Short Strategy — Overbought in Downtrend
**Prompt:** Sell short when RSI is above 65 and EMA 20 is less than EMA 50. Take profit 2R, stop loss 1R.
**Settings:** Direction: Short | Entry: Next Open | Exit: Fixed
**Expected:** Tests the short-side simulation path end-to-end
**What to check:** Direction column in trade log shows "short"; R multiples calculated correctly for short fills

---

### 13. Trailing ATR Stop vs Fixed (comparison test)
**Prompt:** Buy when MACD crosses above MACD Signal and ADX is above 20. Take profit 3R, stop loss 1R.
**Run A:** Exit Type: Fixed
**Run B:** Exit Type: Trailing ATR, multiplier: 2
**Expected:** Trailing ATR should let winners run further but may reduce win rate
**What to check:** Compare avg_win_r, largest_win_r, and profit_factor between runs

---

### 14. Supertrend + Volume Surge
**Prompt:** Buy when Supertrend is greater than 0 and Volume Ratio is above 1.4. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Entry: Next Open | Exit: Trailing ATR (multiplier: 1.5)
**Expected:** SUPERTREND > 0 = bullish signal; volume surge = institutional participation
**What to check:** Verify SUPERTREND flips correctly between trending/ranging regimes in trade log

---

## Suggested Test Matrix

| Strategy | Symbol | Timeframe | Date Range        |
|----------|--------|-----------|-------------------|
| #1–3     | SPY    | 1D        | 2020-01-01 → 2024-12-31 |
| #4–6     | QQQ    | 1D        | 2020-01-01 → 2024-12-31 |
| #7–9     | AAPL   | 1H        | 2023-01-01 → 2024-12-31 |
| #10      | SPY    | 1D        | 2020-01-01 → 2024-12-31 |
| #11      | SPY    | 1D        | 2022-01-01 → 2024-12-31 |
| #12      | QQQ    | 1D        | 2022-01-01 → 2023-12-31 |
| #13 A/B  | SPY    | 1D        | 2020-01-01 → 2024-12-31 |
| #14      | NVDA   | 1H        | 2023-01-01 → 2024-12-31 |
