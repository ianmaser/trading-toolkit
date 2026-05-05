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

---

## Candlestick Pattern Strategies

### 15. Hammer at Support (Classic Reversal)
**Prompt:** Buy when HAMMER pattern is detected and RSI is below 40. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** 8–20 trades over 3 years. High win rate — RSI filter keeps you in oversold context only.
**What to check:** Verify "pattern detected" badge appears in the condition row for HAMMER. Compare win rate vs. raw RSI < 40 (strategy #1 variant) — the candlestick filter should lift it.

---

### 16. Bullish Engulfing in an Uptrend
**Prompt:** Buy when BULLISH_ENGULFING pattern is detected and EMA 20 is greater than EMA 50. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** 10–25 trades. EMA filter means you only take reversal candles in the direction of the trend — reduces whipsaws.
**What to check:** All entries should occur when EMA 20 > EMA 50 (inspect trade log dates vs. EMA state). Regime breakdown should skew trending.

---

### 17. Evening Star Reversal Short
**Prompt:** Sell short when EVENING_STAR pattern is detected and RSI is above 65. Take profit 2R, stop loss 1R.
**Settings:** Direction: Short | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Rare setup — 3–8 trades over 3 years. High win rate when both conditions fire together.
**What to check:** Tests the short path with a 3-bar pattern. Verify R multiples are calculated correctly for short fills.

---

### 18. Inside Bar Breakout (Continuation)
**Prompt:** Buy when INSIDE_BAR pattern is detected and EMA 50 is greater than EMA 200 and ADX is above 20. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** Inside bars = consolidation before continuation. ADX filter keeps you in trending markets. 15–30 trades over 3 years.
**What to check:** Trailing ATR should capture extended moves after consolidation breakouts. Compare profit_factor vs. fixed exit.

---

### 19. Three White Soldiers (Momentum Reversal)
**Prompt:** Buy when THREE_WHITE_SOLDIERS pattern is detected. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Very rare — 2–6 trades over 3 years. Tests that 3-bar pattern detection works and doesn't overfire.
**What to check:** Manually inspect trade entry dates against a chart. Each entry date should show 3 consecutive bullish candles in the prior 3 bars. If firing too often, pattern detection is too loose.

---

### 20. Pin Bar at Bollinger Band Extreme
**Prompt:** Buy when BULLISH_PIN_BAR pattern is detected and BB Percent is below 0.1. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** BB_PCT < 0.1 means price is at the bottom 10% of the band — extreme oversold stretch. 5–15 trades.
**What to check:** This tests binary pattern + continuous indicator condition in the same AND block. Verify both conditions are independently evaluated.

---

## Market Structure Strategies

### 21. Break of Structure (BOS) Long
**Prompt:** Buy when BOS_BULLISH pattern is detected and Volume Ratio is above 1.3. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** 10–30 trades over 3 years. BOS fires when price closes above the most recent confirmed swing high — real structural breakouts.
**What to check:** Signals should cluster around major breakout events (Jan 2023 SPY rally, etc.). Volume filter should eliminate false breaks.

---

### 22. Higher High + Higher Low Confirmation
**Prompt:** Buy when HIGHER_HIGH pattern is detected and HIGHER_LOW pattern is detected and RSI is below 60. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Fires at swing points where both the high AND the low exceeded the previous swing. Pure trend continuation signal. 8–20 trades.
**What to check:** Multiple binary conditions ANDed together. RSI < 60 prevents chasing overbought breakouts at the top of a range.

---

### 23. Uptrend Structure Entry on Pullback
**Prompt:** Buy when UPTREND_STRUCTURE pattern is detected and RSI is below 50 and EMA 20 is greater than EMA 50. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** UPTREND_STRUCTURE confirms a sequence of HH + HL; RSI < 50 means you're entering on a pullback within that structure. Very selective — 5–15 trades.
**What to check:** High quality setups expected (high expectancy, decent win rate). Trailing stop should capture trend continuation.

---

### 24. BOS Short — Bearish Structure Break
**Prompt:** Sell short when BOS_BEARISH pattern is detected and EMA 20 is less than EMA 50. Take profit 2R, stop loss 1R.
**Settings:** Direction: Short | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Tests the bearish BOS path. Fires when price closes below a recent swing low. EMA filter confirms broader downtrend context.
**What to check:** Run on QQQ 2022 (bear market) — should produce more trades than a bull year. Verify direction column in trade log shows "short".

---

### 25. Downtrend Structure + MACD Momentum
**Prompt:** Sell short when DOWNTREND_STRUCTURE pattern is detected and MACD is less than MACD Signal. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Short | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** DOWNTREND_STRUCTURE confirms LH + LL sequence; MACD bearish cross adds momentum confirmation. 5–12 trades.
**What to check:** Regime breakdown should show mostly "trending" since structural downtrends are by definition trending. Test on QQQ 2022 vs SPY 2023 for contrast.

---

### 26. Swing Low Reversal (Mean Reversion)
**Prompt:** Buy when SWING_LOW pattern is detected and RSI is below 35 and Volume Ratio is above 1.2. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** SWING_LOW fires at confirmed local pivot lows (3-bar confirmation each side). Combined with oversold RSI = high-quality reversal signal. 6–15 trades.
**What to check:** Remember SWING_LOW has a 3-bar lag — the entry is 3+ bars after the actual low. Verify this in the trade log (entry dates should not be at the exact low).

---

## Support / Resistance & Trendline Strategies

### 27. Horizontal Support Bounce
**Prompt:** Buy when NEAR_HORIZONTAL_SUPPORT pattern is detected and RSI is below 45 and Volume Ratio is above 1.1. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Fires when price is within 0.5% of a level that has held 2+ times in the last 50 bars. 8–20 trades.
**What to check:** Should cluster around well-known support levels on SPY (e.g. 200-day MA intersections, prior highs becoming support). Volume filter confirms buying interest.

---

### 28. Resistance-into-Support Flip
**Prompt:** Buy when NEAR_HORIZONTAL_SUPPORT pattern is detected and BULLISH_ENGULFING pattern is detected. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Two binary conditions: price at a tested support level AND a reversal candle. Strong confluence. 5–12 trades.
**What to check:** Tests two pattern conditions ANDed together — both should evaluate to 1 on the same bar for a trade to trigger.

---

### 29. Trendline Breakout with Momentum
**Prompt:** Buy when TRENDLINE_BREAKOUT_UP pattern is detected and Volume Ratio is above 1.4 and RSI is above 50. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** Price closes above a projected descending resistance trendline with volume. Classic technical breakout. 5–15 trades per year.
**What to check:** Volume filter is critical here — trendline breaks on low volume frequently fail. Compare win rate with and without Volume Ratio condition.

---

### 30. Trendline Breakout Short
**Prompt:** Sell short when TRENDLINE_BREAKOUT_DOWN pattern is detected and RSI is below 50. Take profit 2R, stop loss 1R.
**Settings:** Direction: Short | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Price closes below a projected ascending support trendline. RSI < 50 confirms bearish momentum context.
**What to check:** Run on QQQ 2022 — should pick up the major trendline breaks during the bear market. Verify regime breakdown shows "trending" for the short side.

---

### 31. Near Support Trendline Bounce
**Prompt:** Buy when NEAR_SUPPORT_TRENDLINE pattern is detected and RSI is below 45 and BULLISH_PIN_BAR pattern is detected. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Price touches the projected ascending support trendline AND shows a pin bar reversal. Triple confluence — expect 3–8 very high-quality setups.
**What to check:** This is a stress test of three ANDed conditions (2 binary patterns + 1 numeric). Verify all three are independently gating the trade.

---

## Psychological Level Strategies

### 32. Round Number Bounce
**Prompt:** Buy when NEAR_ROUND_NUMBER pattern is detected and RSI is below 40 and Volume Ratio is above 1.2. Take profit 2R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Psychological levels act as support/resistance due to options clustering and stop positioning. 8–20 trades over 3 years.
**What to check:** Run on a high-priced stock (AAPL, NVDA, TSLA) where round numbers ($100, $150, $200) are well-known decision points. Lower-priced instruments have less obvious round number effects.

---

### 33. Round Number + Candlestick Reversal
**Prompt:** Buy when AT_ROUND_FIVE pattern is detected and HAMMER pattern is detected. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** AT_ROUND_FIVE is stricter — only $5/$50/$100/$500 etc. Combined with hammer = price rejecting a major level. Very rare, very high quality. 2–8 trades.
**What to check:** Run on TSLA or NVDA where $100/$200/$300 etc. are historically significant. Manually confirm entry dates coincide with these levels on a chart.

---

## Professional Multi-Confluence Setups

### 34. ICT-Style BOS + Pullback Entry
**Prompt:** Buy when BOS_BULLISH pattern is detected and RSI is below 55 and EMA 20 is greater than EMA 50. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1H | Entry: Next Open | Exit: Trailing ATR (multiplier: 1.5)
**Expected:** Smart money concept: after a BOS, price often retraces before continuing. RSI < 55 catches the pullback before full momentum resumes. 15–40 trades on 1H.
**What to check:** Compare 1H vs 4H — same logic but different trade frequency. MACD or RSI convergence at pullback levels should correlate with winners.

---

### 35. Structure + S/R + Volume Confluence
**Prompt:** Buy when UPTREND_STRUCTURE pattern is detected and NEAR_HORIZONTAL_SUPPORT pattern is detected and Volume Ratio is above 1.3. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** The "full confluence" setup: trend structure confirmed + price at a tested support level + volume surge. Expect 3–10 extremely selective trades over 3 years. High expectancy.
**What to check:** This is the quality-over-quantity archetype. Low trade count is correct behavior — if you're getting 30+ trades, one of the conditions isn't restricting enough.

---

### 36. Candlestick + Trend + Momentum Triple Confluence
**Prompt:** Buy when BULLISH_ENGULFING pattern is detected and EMA 50 is greater than EMA 200 and RSI is below 50 and ADX is above 20. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Four conditions: reversal candle + long-term trend + pullback RSI + trending regime. 5–15 trades over 3 years. Professional-grade mean-reversion-in-uptrend setup.
**What to check:** This is a real strategy many swing traders use. Win rate should be higher than simpler variants. Compare vs strategy #16 (engulfing + EMA only) — does ADX + RSI add value to profit factor?

---

### 37. Trendline Break + Structure Confirmation
**Prompt:** Buy when TRENDLINE_BREAKOUT_UP pattern is detected and BOS_BULLISH pattern is detected and Volume Ratio is above 1.5. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** Requires BOTH a trendline break AND a structure break on the same bar, with volume. The highest-conviction breakout signal — very rare, very clean. 2–8 trades.
**What to check:** Both trendline and BOS series must fire 1.0 on the same bar. If you're getting 0 trades, try relaxing by removing one condition to confirm each independently fires.

---

### 38. Full Bear Market Short Stack
**Prompt:** Sell short when DOWNTREND_STRUCTURE pattern is detected and NEAR_HORIZONTAL_RESISTANCE pattern is detected and RSI is above 55. Take profit 2.5R, stop loss 1R.
**Settings:** Direction: Short | Timeframe: 1D | Suggested Symbol: QQQ | Date range: 2022-01-01 → 2022-12-31
**Expected:** Bear year test — downtrend structure confirmed + price bouncing off resistance + not yet oversold. 5–15 trades.
**What to check:** A dedicated bear market test. Run on QQQ 2022 only. Should outperform bull market years for short strategies. Regime breakdown should show mostly "trending".

---

### 39. Round Number Rejection Short
**Prompt:** Sell short when NEAR_ROUND_NUMBER pattern is detected and BEARISH_ENGULFING pattern is detected and RSI is above 60. Take profit 2R, stop loss 1R.
**Settings:** Direction: Short | Timeframe: 1D | Entry: Next Open | Exit: Fixed
**Expected:** Price reaches a psychological level, fails to hold, and prints a bearish reversal candle with overbought RSI. 4–10 trades.
**What to check:** Run on AAPL or MSFT where $150/$170/$200/$220 etc. are clearly magnetic. Verify RSI > 60 is gating correctly (no entries when RSI was neutral).

---

### 40. Multi-Timeframe Price Action (Advanced)
**Prompt:** Buy when MORNING_STAR pattern is detected and NEAR_HORIZONTAL_SUPPORT pattern is detected and EMA 20 is greater than EMA 200. Take profit 3R, stop loss 1R.
**Settings:** Direction: Long | Timeframe: 1D | Entry: Next Open | Exit: Trailing ATR (multiplier: 2)
**Expected:** Three-bar reversal pattern at a proven support level, in a long-term uptrend. The most complete price action setup in this list. 3–10 trades over 3 years.
**What to check:** Morning star spans 3 bars — entry is bar+1 after the third candle. Verify the trade log shows entries 1 bar after a recognizable 3-candle pattern on a chart.

---

## Suggested Test Matrix

| Strategy | Symbol | Timeframe | Date Range |
|----------|--------|-----------|------------|
| #1–3 | SPY | 1D | 2020-01-01 → 2024-12-31 |
| #4–6 | QQQ | 1D | 2020-01-01 → 2024-12-31 |
| #7–9 | AAPL | 1H | 2023-01-01 → 2024-12-31 |
| #10 | SPY | 1D | 2020-01-01 → 2024-12-31 |
| #11 | SPY | 1D | 2022-01-01 → 2024-12-31 |
| #12 | QQQ | 1D | 2022-01-01 → 2023-12-31 |
| #13 A/B | SPY | 1D | 2020-01-01 → 2024-12-31 |
| #14 | NVDA | 1H | 2023-01-01 → 2024-12-31 |
| #15–16 | SPY | 1D | 2021-01-01 → 2024-12-31 |
| #17 | SPY | 1D | 2022-01-01 → 2023-12-31 |
| #18–20 | AAPL | 1D | 2021-01-01 → 2024-12-31 |
| #21–23 | SPY | 1D | 2020-01-01 → 2024-12-31 |
| #24–25 | QQQ | 1D | 2022-01-01 → 2022-12-31 |
| #26 | SPY | 1D | 2020-01-01 → 2024-12-31 |
| #27–28 | SPY | 1D | 2021-01-01 → 2024-12-31 |
| #29–31 | QQQ | 1D | 2020-01-01 → 2024-12-31 |
| #32 | NVDA | 1D | 2023-01-01 → 2024-12-31 |
| #33 | TSLA | 1D | 2021-01-01 → 2024-12-31 |
| #34 | SPY | 1H | 2023-01-01 → 2024-12-31 |
| #35–37 | SPY | 1D | 2020-01-01 → 2024-12-31 |
| #38 | QQQ | 1D | 2022-01-01 → 2022-12-31 |
| #39 | AAPL | 1D | 2021-01-01 → 2024-12-31 |
| #40 | SPY | 1D | 2020-01-01 → 2024-12-31 |
