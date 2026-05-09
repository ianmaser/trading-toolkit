FILE: python-service/main.py
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
The Python FastAPI backend service that handles all indicator math and backtesting.
It exposes two HTTP endpoints: POST /indicators (computes technical indicator values for a
candle series) and POST /backtest (fetches historical OHLCV data and simulates a strategy
bar-by-bar). All indicator calculations that the Next.js frontend needs — RSI, MACD, EMA,
ATR, Supertrend, candlestick patterns, market structure, support/resistance — live here.
Never in JavaScript.

HOW IT WORKS (step by step):

### /indicators endpoint
1. Receives `{ candles: OHLCVBar[], indicators: string[] }` via POST.
2. Converts the candle list to a pandas DataFrame sorted by timestamp.
3. For each requested indicator string, calls `calculate_indicators()` which dispatches to
   the appropriate `_calc_*` function and returns the last non-NaN value.
4. Returns a flat dict of `{ indicator_name: float_value }`.

### /backtest endpoint
1. Receives a `BacktestRequest` with symbol, timeframe, date range, and a `StrategyConfig`.
2. Fetches historical OHLCV data: tries Twelve Data first (primary), falls back to Polygon
   if Twelve Data fails. Raises 502 if both fail.
3. Converts raw bars to a DataFrame and calls `run_backtest()`.
4. Returns the full `BacktestResult` dict with stats, equity curve, trade log, and regime breakdown.

### run_backtest() — the core simulation
1. Pre-computes all indicator series needed by the strategy conditions (plus ATR for stops).
   Stored in a `cached` dict keyed by indicator name for O(1) per-bar lookup.
2. Pre-computes ADX and ATR% series for regime classification at each bar.
3. Iterates bar by bar from `warmup=100` to the end of the DataFrame.
   - **Pending entry**: if `entry_timing == 'next_open'`, a signal sets `pending_entry = True`
     and the actual entry happens at the open of the next bar (realistic fill simulation).
   - **Trailing stops**: if `exit_type` is `trailing_atr` or `trailing_pct`, the stop is
     ratcheted forward each bar (only in the direction of the trade — it never moves against you).
   - **Exit check**: each bar checks if price hit the stop or target. R-multiple is calculated
     as `(exit - entry) / risk_dollars`, then commission and slippage are subtracted.
   - **Regime**: each trade is tagged with the market regime at its entry bar:
     'trending' (ADX > 25), 'volatile' (ATR% > 3), or 'ranging' (otherwise).
4. After the loop, computes aggregate stats: win rate, expectancy, profit factor, max drawdown,
   Sharpe ratio (annualized by trades_per_year), expectancy per bar, regime breakdown.

### Indicator implementations
All indicators are implemented from scratch using pandas/numpy — no external library.
Key implementations:
- **RSI**: Wilder's smoothed EMA of gains/losses (`ewm(alpha=1/length)`).
- **MACD**: EMA(12) - EMA(26), signal = EMA(9) of MACD.
- **ATR**: True Range = max(H-L, |H-prev_C|, |L-prev_C|), smoothed with EWM.
- **ADX**: Directional Movement (DM+/DM-) smoothed with EWM, expressed as percentage of ATR.
- **Supertrend**: Adaptive ATR bands that flip direction when price crosses them. Computed
  iteratively (not vectorized) because each bar depends on the previous bar's band values.
- **Swing highs/lows**: n-bar lookback comparison (n=3). Has an n-bar lag on the right side
  to avoid lookahead bias — a swing high at bar i is only confirmed after bar i+3.
- **BOS (Break of Structure)**: Fires on the exact bar where close crosses the most recent
  swing high (bullish BOS) or swing low (bearish BOS). Crossover semantics: prev bar was
  below the level, current bar is above.
- **Horizontal S/R**: Scans a 50-bar lookback for local price extrema, clusters them within
  0.5% tolerance, and fires when price is within 0.5% of a cluster with ≥2 touches.
- **Trendlines**: Projects a linear regression through the 2 most recent swing points.
  Fires when price is within 0.5% of the projected line (proximity modes) or when price
  crosses through the line from one side to the other (breakout modes).
- **Round numbers**: Price-scaled increments ($1, $5, $10, $50, $100) with a 0.5% tolerance.

KEY CONCEPTS USED:
- **FastAPI**: A Python web framework for building HTTP APIs. Routes are defined with
  decorators (`@app.post('/backtest')`). Pydantic models auto-validate request bodies.
- **Pydantic `BaseModel`**: Defines the shape of API request/response bodies. FastAPI
  automatically parses and validates incoming JSON against these models.
- **pandas DataFrame**: The primary data structure for time-series operations. Vectorized
  operations (rolling, ewm, shift) run across all bars at once rather than in Python loops.
- **EWM (Exponential Weighted Mean)**: pandas' `ewm(alpha=1/length)` applies Wilder's
  smoothing — the same formula used by TradingView for RSI, ATR, ADX.
- **Warmup period (100 bars)**: Swing and trendline indicators need 50-100 bars of history
  to produce meaningful results. The backtest loop starts at bar 100 to skip the NaN-heavy
  initialization period.
- **R-multiple**: All P&L is expressed in units of risk (R). 1R = one stop-loss distance.
  This normalizes results across different price ranges and position sizes.
- **ATR-based stops**: Stop and target are placed at `entry ± ATR * stop_loss_r` and
  `entry ± ATR * take_profit_r`. ATR adapts the stop to current volatility.
- **Provider fallback**: Twelve Data is tried first (primary). On any exception, Polygon.io
  is tried as fallback. Both adapters normalize responses to the same `OHLCVBar` format.

INPUTS AND OUTPUTS:
- POST /indicators: `{ candles: OHLCVBar[], indicators: string[] }` → `{ name: float }`
- POST /backtest: `BacktestRequest` → `BacktestResult` with stats, trades[], equity_curve[],
  regime_breakdown{}
- POST /health: → `{ status: 'ok' }` (liveness probe)
- Environment: `POLYGON_API_KEY`, `TWELVE_DATA_API_KEY`

WHAT TO CHECK IF SOMETHING BREAKS:
- "Not enough data" error: the symbol/date range returned fewer than 60 bars. Try a wider
  date range or a longer timeframe.
- Zero trades: strategy conditions too restrictive for the test period. Try relaxing
  thresholds (e.g. RSI < 30 → RSI < 40) or test on a longer date range.
- `regime_breakdown` empty in results: ADX or ATR calculation may have failed. Check
  server logs for `_calc_adx` warnings. This was a known issue when `ta.adx()` calls
  (old library reference) shadowed the native `_calc_adx` function.
- 502 on backtest: both data providers failed. Check that `TWELVE_DATA_API_KEY` and
  `POLYGON_API_KEY` env vars are set in the Railway deployment.
- Indicator NaN for all bars: the indicator name may not match any case in `_get_series()`.
  Check spelling — all indicators are matched case-insensitively via `.upper()`.

DEPENDENCIES:
- `fastapi`: HTTP API framework with auto-validation via Pydantic.
- `pydantic`: Data validation — BaseModel defines request/response shapes.
- `pandas`: DataFrame for time-series operations (rolling, ewm, shift, cumsum).
- `numpy`: Vectorized array operations for pattern detection and structure calculations.
- `httpx`: Async HTTP client for fetching OHLCV data from Polygon and Twelve Data.
- `python-dotenv` (`load_dotenv`): Loads `.env` file in the python-service directory.
- `math`: Standard library for `sqrt` in the Sharpe ratio calculation.
