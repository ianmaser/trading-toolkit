import logging
import math
import os
from typing import Optional

import httpx
import numpy as np
import pandas as pd
import pandas_ta as ta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OHLCVBar(BaseModel):
    timestamp: int  # Unix seconds
    open: float
    high: float
    low: float
    close: float
    volume: float


class IndicatorsRequest(BaseModel):
    candles: list[OHLCVBar]
    indicators: list[str]


class Condition(BaseModel):
    indicator: str
    operator: str  # '>' | '<' | '>=' | '<=' | '==' | 'crossover' | 'crossunder'
    value: Optional[float] = None
    target: Optional[str] = None  # second indicator for crossover/crossunder


class StrategyConfig(BaseModel):
    conditions: list[Condition]
    take_profit_r: float = 2.0
    stop_loss_r: float = 1.0
    entry_type: str = "crossover"       # breakout | pullback | crossover
    direction: str = "long"             # long | short
    # --- 10b additions ---
    entry_timing: str = "next_open"     # close | next_open
    slippage_pct: float = 0.0          # % slippage on each fill
    commission_per_trade: float = 0.0  # flat $ commission per side
    exit_type: str = "fixed"           # fixed | trailing_atr | trailing_pct
    trail_atr_multiplier: float = 2.0  # used when exit_type = trailing_atr
    trail_pct: float = 2.0             # used when exit_type = trailing_pct


class BacktestRequest(BaseModel):
    symbol: str
    timeframe: str   # 1D | 4H | 1H | 15M | 5M
    date_from: str   # YYYY-MM-DD
    date_to: str     # YYYY-MM-DD
    strategy_config: StrategyConfig


# ---------------------------------------------------------------------------
# Timeframe maps
# ---------------------------------------------------------------------------

TWELVE_DATA_INTERVALS: dict[str, str] = {
    "1D": "1day",
    "4H": "4h",
    "1H": "1h",
    "15M": "15min",
    "5M": "5min",
}

POLYGON_MULTIPLIER_TIMESPAN: dict[str, tuple[str, str]] = {
    "1D": ("1", "day"),
    "4H": ("4", "hour"),
    "1H": ("1", "hour"),
    "15M": ("15", "minute"),
    "5M": ("5", "minute"),
}

# Approximate bars per year for annualising Sharpe
BARS_PER_YEAR: dict[str, float] = {
    "1D": 252,
    "4H": 252 * 6,
    "1H": 252 * 7,
    "15M": 252 * 26,
    "5M": 252 * 78,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _last(series: Optional[pd.Series]) -> Optional[float]:
    """Return the last non-NaN value of a Series, or None."""
    if series is None or len(series) == 0:
        return None
    val = series.iloc[-1]
    return None if pd.isna(val) else float(val)


def candles_to_df(candles: list[OHLCVBar]) -> pd.DataFrame:
    df = pd.DataFrame([c.model_dump() for c in candles])
    return df.sort_values("timestamp").reset_index(drop=True)


def _max_consecutive(outcomes: list[str], target: str) -> int:
    max_streak = current = 0
    for o in outcomes:
        if o == target:
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 0
    return max_streak


# ---------------------------------------------------------------------------
# Market structure helpers (used by _get_series)
# ---------------------------------------------------------------------------

def _swing_highs_series(df: pd.DataFrame, n: int = 3) -> pd.Series:
    """1.0 at confirmed swing highs. Has n-bar lag on right side — no lookahead."""
    h = df["high"].values
    result = np.zeros(len(h))
    for i in range(n, len(h) - n):
        if h[i] > np.max(h[i - n:i]) and h[i] > np.max(h[i + 1:i + n + 1]):
            result[i] = 1.0
    return pd.Series(result, index=df.index)


def _swing_lows_series(df: pd.DataFrame, n: int = 3) -> pd.Series:
    """1.0 at confirmed swing lows. Has n-bar lag on right side — no lookahead."""
    l = df["low"].values
    result = np.zeros(len(l))
    for i in range(n, len(l) - n):
        if l[i] < np.min(l[i - n:i]) and l[i] < np.min(l[i + 1:i + n + 1]):
            result[i] = 1.0
    return pd.Series(result, index=df.index)


def _consecutive_swing_comparison(
    df: pd.DataFrame,
    swing_series: pd.Series,
    price_col: str,
    direction: str,
) -> pd.Series:
    """1.0 where the current swing point is higher/lower than the previous one."""
    levels = [
        (i, float(df[price_col].iloc[i]))
        for i in range(len(df))
        if swing_series.iloc[i] == 1.0
    ]
    result = np.zeros(len(df))
    for k in range(1, len(levels)):
        idx, price = levels[k]
        prev_price = levels[k - 1][1]
        if direction == "higher" and price > prev_price:
            result[idx] = 1.0
        elif direction == "lower" and price < prev_price:
            result[idx] = 1.0
    return pd.Series(result, index=df.index)


def _trendline_series(
    df: pd.DataFrame,
    mode: str,
    tolerance_pct: float = 0.005,
    max_age: int = 100,
) -> pd.Series:
    """
    Projects a trendline through the 2 most recent confirmed swing points.
    mode: 'resistance' | 'support' | 'breakout_up' | 'breakout_down'
    tolerance_pct: how close price must be (0.005 = 0.5%) for proximity modes.
    max_age: trendline expires if the older swing point is more than max_age bars back.
    """
    use_highs = mode in ("resistance", "breakout_up")
    swings = _swing_highs_series(df, n=3) if use_highs else _swing_lows_series(df, n=3)
    price_col = "high" if use_highs else "low"
    price_vals = df[price_col].values
    close_vals = df["close"].values
    result = np.zeros(len(df))
    swing_indices = [j for j in range(len(df)) if swings.iloc[j] == 1.0]

    for i in range(len(df)):
        available = [j for j in swing_indices if j < i]
        if len(available) < 2:
            continue
        p2_idx = available[-1]
        p1_idx = available[-2]
        if p1_idx < i - max_age:
            continue
        if p2_idx == p1_idx:
            continue
        slope = (price_vals[p2_idx] - price_vals[p1_idx]) / (p2_idx - p1_idx)
        intercept = price_vals[p1_idx] - slope * p1_idx
        projected = slope * i + intercept
        if projected <= 0:
            continue
        pct_diff = abs(close_vals[i] - projected) / projected
        if mode in ("resistance", "support"):
            result[i] = 1.0 if pct_diff <= tolerance_pct else 0.0
        elif mode == "breakout_up" and i > 0:
            prev_proj = slope * (i - 1) + intercept
            if close_vals[i - 1] < prev_proj and close_vals[i] > projected:
                result[i] = 1.0
        elif mode == "breakout_down" and i > 0:
            prev_proj = slope * (i - 1) + intercept
            if close_vals[i - 1] > prev_proj and close_vals[i] < projected:
                result[i] = 1.0

    return pd.Series(result, index=df.index)


def _horizontal_sr_series(
    df: pd.DataFrame,
    mode: str,
    lookback: int = 50,
    tolerance_pct: float = 0.005,
    min_touches: int = 2,
) -> pd.Series:
    """
    mode: 'support' | 'resistance'
    Fires 1.0 when current close is within tolerance_pct of a price level that
    has been touched at least min_touches times in the last lookback bars.
    """
    close_vals = df["close"].values
    high_vals = df["high"].values
    low_vals = df["low"].values
    result = np.zeros(len(df))

    for i in range(lookback, len(df)):
        price = close_vals[i]
        if mode == "support":
            window = low_vals[i - lookback:i]
        else:
            window = high_vals[i - lookback:i]

        # find local extrema in window (simple: bars lower/higher than their neighbours)
        extrema = []
        for j in range(1, len(window) - 1):
            if mode == "support" and window[j] <= window[j - 1] and window[j] <= window[j + 1]:
                extrema.append(window[j])
            elif mode == "resistance" and window[j] >= window[j - 1] and window[j] >= window[j + 1]:
                extrema.append(window[j])

        if not extrema:
            continue

        # cluster extrema within tolerance_pct of each other
        extrema_arr = np.array(sorted(extrema))
        clusters: list[list[float]] = []
        for val in extrema_arr:
            placed = False
            for cluster in clusters:
                ref = cluster[0]
                if ref > 0 and abs(val - ref) / ref <= tolerance_pct:
                    cluster.append(val)
                    placed = True
                    break
            if not placed:
                clusters.append([val])

        # check if current price is near any cluster with enough touches
        for cluster in clusters:
            if len(cluster) >= min_touches:
                level = float(np.mean(cluster))
                if level > 0 and abs(price - level) / level <= tolerance_pct:
                    result[i] = 1.0
                    break

    return pd.Series(result, index=df.index)


def _round_number_series(df: pd.DataFrame, mode: str, tolerance_pct: float = 0.005) -> pd.Series:
    """
    mode: 'near_round' | 'at_round_five'
    Fires 1.0 when close is within tolerance_pct of a psychological price level.
    """
    close_vals = df["close"].values
    result = np.zeros(len(close_vals))

    for i, price in enumerate(close_vals):
        if price <= 0:
            continue
        if mode == "near_round":
            if price < 20:
                increment = 1.0
            elif price < 100:
                increment = 5.0
            elif price < 500:
                increment = 10.0
            elif price < 2000:
                increment = 50.0
            else:
                increment = 100.0
            nearest = round(price / increment) * increment
            if nearest > 0 and abs(price - nearest) / nearest <= tolerance_pct:
                result[i] = 1.0
        elif mode == "at_round_five":
            for inc in [5.0, 10.0, 50.0, 100.0, 500.0, 1000.0]:
                nearest = round(price / inc) * inc
                if nearest > 0 and abs(price - nearest) / nearest <= tolerance_pct:
                    result[i] = 1.0
                    break

    return pd.Series(result, index=df.index)


# ---------------------------------------------------------------------------
# Indicator calculation (shared by /indicators and /backtest)
# ---------------------------------------------------------------------------

def _get_series(df: pd.DataFrame, indicator: str) -> Optional[pd.Series]:
    """Return the full indicator Series for a given name."""
    ind = indicator.upper()

    try:
        if ind == "RSI":
            return ta.rsi(df["close"], length=14)

        if ind == "MACD":
            res = ta.macd(df["close"])
            return res.iloc[:, 0] if res is not None and not res.empty else None

        if ind == "MACD_SIGNAL":
            res = ta.macd(df["close"])
            return res.iloc[:, 2] if res is not None and not res.empty else None

        if ind == "MACD_HIST":
            res = ta.macd(df["close"])
            return res.iloc[:, 1] if res is not None and not res.empty else None

        if ind.startswith("EMA_"):
            length = int(ind.split("_")[1])
            return ta.ema(df["close"], length=length)

        if ind in ("BB_WIDTH", "BB"):
            res = ta.bbands(df["close"])
            return res.iloc[:, 3] if res is not None and not res.empty else None

        if ind == "BB_PCT":
            res = ta.bbands(df["close"])
            return res.iloc[:, 4] if res is not None and not res.empty else None

        if ind == "ATR":
            return ta.atr(df["high"], df["low"], df["close"], length=14)

        if ind == "VOLUME_RATIO":
            vol_ma = df["volume"].rolling(20).mean()
            return df["volume"] / vol_ma

        if ind == "ADX":
            res = ta.adx(df["high"], df["low"], df["close"])
            return res.iloc[:, 0] if res is not None and not res.empty else None

        if ind == "VWAP":
            typical = (df["high"] + df["low"] + df["close"]) / 3
            return (typical * df["volume"]).cumsum() / df["volume"].cumsum()

        if ind in ("STOCH", "STOCH_K"):
            res = ta.stoch(df["high"], df["low"], df["close"])
            return res.iloc[:, 0] if res is not None and not res.empty else None

        if ind == "STOCH_D":
            res = ta.stoch(df["high"], df["low"], df["close"])
            return res.iloc[:, 1] if res is not None and not res.empty else None

        if ind == "SUPERTREND":
            # Returns direction: 1 = bullish, -1 = bearish
            res = ta.supertrend(df["high"], df["low"], df["close"], length=10, multiplier=3.0)
            return res.iloc[:, 1] if res is not None and not res.empty else None

        if ind == "SUPERTREND_VALUE":
            res = ta.supertrend(df["high"], df["low"], df["close"], length=10, multiplier=3.0)
            return res.iloc[:, 0] if res is not None and not res.empty else None

        if ind == "CLOSE":
            return df["close"]

        if ind == "VOLUME":
            return df["volume"]

        # ── Candlestick patterns ────────────────────────────────────────────
        # All return a float Series of 0.0 / 1.0 so they work with operator "=="

        o = df["open"]
        h = df["high"]
        l = df["low"]
        c = df["close"]
        body = (c - o).abs()
        rng = h - l
        rng_safe = rng.replace(0, np.nan)

        if ind in ("HAMMER", "BULLISH_PIN_BAR"):
            body_top = pd.concat([o, c], axis=1).max(axis=1)
            lower_wick = pd.concat([o, c], axis=1).min(axis=1) - l
            small_body = body / rng_safe < 0.3
            body_in_upper = (body_top - l) / rng_safe > 0.67
            long_lower_wick = lower_wick > 2 * body
            return (small_body & body_in_upper & long_lower_wick).astype(float).fillna(0.0)

        if ind in ("SHOOTING_STAR", "BEARISH_PIN_BAR"):
            body_bot = pd.concat([o, c], axis=1).min(axis=1)
            upper_wick = h - pd.concat([o, c], axis=1).max(axis=1)
            small_body = body / rng_safe < 0.3
            body_in_lower = (h - body_bot) / rng_safe > 0.67
            long_upper_wick = upper_wick > 2 * body
            return (small_body & body_in_lower & long_upper_wick).astype(float).fillna(0.0)

        if ind == "DOJI":
            return (body < rng_safe * 0.1).astype(float).fillna(0.0)

        if ind == "BULLISH_ENGULFING":
            prev_red = o.shift(1) > c.shift(1)
            curr_green = c > o
            engulf = (o <= c.shift(1)) & (c >= o.shift(1))
            return (prev_red & curr_green & engulf).astype(float).fillna(0.0)

        if ind == "BEARISH_ENGULFING":
            prev_green = c.shift(1) > o.shift(1)
            curr_red = o > c
            engulf = (o >= c.shift(1)) & (c <= o.shift(1))
            return (prev_green & curr_red & engulf).astype(float).fillna(0.0)

        if ind == "INSIDE_BAR":
            return ((h <= h.shift(1)) & (l >= l.shift(1))).astype(float).fillna(0.0)

        if ind == "OUTSIDE_BAR":
            return ((h > h.shift(1)) & (l < l.shift(1))).astype(float).fillna(0.0)

        if ind == "MORNING_STAR":
            bar1_bear = o.shift(2) > c.shift(2)
            bar2_small = (body.shift(1) / rng_safe.shift(1)) < 0.3
            bar3_bull = c > o
            midpoint_bar1 = (o.shift(2) + c.shift(2)) / 2
            bar3_above_mid = c > midpoint_bar1
            return (bar1_bear & bar2_small & bar3_bull & bar3_above_mid).astype(float).fillna(0.0)

        if ind == "EVENING_STAR":
            bar1_bull = c.shift(2) > o.shift(2)
            bar2_small = (body.shift(1) / rng_safe.shift(1)) < 0.3
            bar3_bear = o > c
            midpoint_bar1 = (o.shift(2) + c.shift(2)) / 2
            bar3_below_mid = c < midpoint_bar1
            return (bar1_bull & bar2_small & bar3_bear & bar3_below_mid).astype(float).fillna(0.0)

        if ind == "THREE_WHITE_SOLDIERS":
            green1 = c.shift(2) > o.shift(2)
            green2 = c.shift(1) > o.shift(1)
            green3 = c > o
            open2_in_body1 = (o.shift(1) >= o.shift(2)) & (o.shift(1) <= c.shift(2))
            open3_in_body2 = (o >= o.shift(1)) & (o <= c.shift(1))
            near_high2 = (h.shift(1) - c.shift(1)) < rng_safe.shift(1) * 0.2
            near_high3 = (h - c) < rng_safe * 0.2
            return (
                green1 & green2 & green3
                & open2_in_body1 & open3_in_body2
                & near_high2 & near_high3
            ).astype(float).fillna(0.0)

        if ind == "THREE_BLACK_CROWS":
            red1 = o.shift(2) > c.shift(2)
            red2 = o.shift(1) > c.shift(1)
            red3 = o > c
            open2_in_body1 = (o.shift(1) <= o.shift(2)) & (o.shift(1) >= c.shift(2))
            open3_in_body2 = (o <= o.shift(1)) & (o >= c.shift(1))
            near_low2 = (c.shift(1) - l.shift(1)) < rng_safe.shift(1) * 0.2
            near_low3 = (c - l) < rng_safe * 0.2
            return (
                red1 & red2 & red3
                & open2_in_body1 & open3_in_body2
                & near_low2 & near_low3
            ).astype(float).fillna(0.0)

        # ── Market structure ────────────────────────────────────────────────

        if ind == "SWING_HIGH":
            return _swing_highs_series(df, n=3)

        if ind == "SWING_LOW":
            return _swing_lows_series(df, n=3)

        if ind == "BOS_BULLISH":
            sh = _swing_highs_series(df, n=3)
            close_vals = df["close"].values
            high_vals = df["high"].values
            res = np.zeros(len(df))
            lookback = 20
            for i in range(lookback, len(df)):
                window = sh.iloc[i - lookback:i]
                sh_locs = window[window == 1.0].index
                if len(sh_locs) == 0:
                    continue
                last_sh = sh_locs[-1]
                level = float(high_vals[df.index.get_loc(last_sh)])
                if close_vals[i] > level:
                    res[i] = 1.0
            return pd.Series(res, index=df.index)

        if ind == "BOS_BEARISH":
            sl = _swing_lows_series(df, n=3)
            close_vals = df["close"].values
            low_vals = df["low"].values
            res = np.zeros(len(df))
            lookback = 20
            for i in range(lookback, len(df)):
                window = sl.iloc[i - lookback:i]
                sl_locs = window[window == 1.0].index
                if len(sl_locs) == 0:
                    continue
                last_sl = sl_locs[-1]
                level = float(low_vals[df.index.get_loc(last_sl)])
                if close_vals[i] < level:
                    res[i] = 1.0
            return pd.Series(res, index=df.index)

        if ind == "HIGHER_HIGH":
            sh = _swing_highs_series(df, n=3)
            return _consecutive_swing_comparison(df, sh, "high", "higher")

        if ind == "LOWER_HIGH":
            sh = _swing_highs_series(df, n=3)
            return _consecutive_swing_comparison(df, sh, "high", "lower")

        if ind == "HIGHER_LOW":
            sl = _swing_lows_series(df, n=3)
            return _consecutive_swing_comparison(df, sl, "low", "higher")

        if ind == "LOWER_LOW":
            sl = _swing_lows_series(df, n=3)
            return _consecutive_swing_comparison(df, sl, "low", "lower")

        if ind == "UPTREND_STRUCTURE":
            sh = _swing_highs_series(df, n=3)
            sl = _swing_lows_series(df, n=3)
            # merge into chronological sequence: (bar_idx, type, price)
            points: list[tuple[int, str, float]] = []
            for i in range(len(df)):
                if sh.iloc[i] == 1.0:
                    points.append((i, "H", float(df["high"].iloc[i])))
                if sl.iloc[i] == 1.0:
                    points.append((i, "L", float(df["low"].iloc[i])))
            points.sort(key=lambda x: x[0])
            res = np.zeros(len(df))
            # scan for H-L-H with HH and HL
            for k in range(2, len(points)):
                p0, t0, v0 = points[k - 2]
                p1, t1, v1 = points[k - 1]
                p2, t2, v2 = points[k]
                if t0 == "H" and t1 == "L" and t2 == "H":
                    prev_h = [px[2] for px in points[:k - 2] if px[1] == "H"]
                    prev_l = [px[2] for px in points[:k - 1] if px[1] == "L"]
                    if prev_h and prev_l:
                        if v2 > prev_h[-1] and v1 > prev_l[-1]:
                            res[p2] = 1.0
            return pd.Series(res, index=df.index)

        if ind == "DOWNTREND_STRUCTURE":
            sh = _swing_highs_series(df, n=3)
            sl = _swing_lows_series(df, n=3)
            points = []
            for i in range(len(df)):
                if sh.iloc[i] == 1.0:
                    points.append((i, "H", float(df["high"].iloc[i])))
                if sl.iloc[i] == 1.0:
                    points.append((i, "L", float(df["low"].iloc[i])))
            points.sort(key=lambda x: x[0])
            res = np.zeros(len(df))
            # scan for L-H-L with LH and LL
            for k in range(2, len(points)):
                p0, t0, v0 = points[k - 2]
                p1, t1, v1 = points[k - 1]
                p2, t2, v2 = points[k]
                if t0 == "L" and t1 == "H" and t2 == "L":
                    prev_h = [px[2] for px in points[:k - 1] if px[1] == "H"]
                    prev_l = [px[2] for px in points[:k - 2] if px[1] == "L"]
                    if prev_h and prev_l:
                        if v1 < prev_h[-1] and v2 < prev_l[-1]:
                            res[p2] = 1.0
            return pd.Series(res, index=df.index)

        # ── Horizontal support / resistance ─────────────────────────────────

        if ind == "NEAR_HORIZONTAL_SUPPORT":
            return _horizontal_sr_series(df, mode="support")

        if ind == "NEAR_HORIZONTAL_RESISTANCE":
            return _horizontal_sr_series(df, mode="resistance")

        # ── Angular trendlines ───────────────────────────────────────────────

        if ind == "NEAR_RESISTANCE_TRENDLINE":
            return _trendline_series(df, mode="resistance")

        if ind == "NEAR_SUPPORT_TRENDLINE":
            return _trendline_series(df, mode="support")

        if ind == "TRENDLINE_BREAKOUT_UP":
            return _trendline_series(df, mode="breakout_up")

        if ind == "TRENDLINE_BREAKOUT_DOWN":
            return _trendline_series(df, mode="breakout_down")

        # ── Psychological / round number levels ──────────────────────────────

        if ind == "NEAR_ROUND_NUMBER":
            return _round_number_series(df, mode="near_round")

        if ind == "AT_ROUND_FIVE":
            return _round_number_series(df, mode="at_round_five")

    except Exception as e:
        logger.warning("Failed to compute indicator %s: %s", indicator, e)

    return None


def calculate_indicators(df: pd.DataFrame, indicators: list[str]) -> dict:
    """Calculate indicators and return flat dict of latest values."""
    result: dict = {}

    for ind in indicators:
        ind_upper = ind.upper()
        try:
            if ind_upper == "MACD":
                res = ta.macd(df["close"])
                if res is not None and not res.empty:
                    result["macd"] = _last(res.iloc[:, 0])
                    result["macd_hist"] = _last(res.iloc[:, 1])
                    result["macd_signal"] = _last(res.iloc[:, 2])

            elif ind_upper in ("BB_WIDTH", "BB"):
                res = ta.bbands(df["close"])
                if res is not None and not res.empty:
                    result["bb_lower"] = _last(res.iloc[:, 0])
                    result["bb_mid"] = _last(res.iloc[:, 1])
                    result["bb_upper"] = _last(res.iloc[:, 2])
                    result["bb_width"] = _last(res.iloc[:, 3])
                    result["bb_pct"] = _last(res.iloc[:, 4])

            elif ind_upper == "ADX":
                res = ta.adx(df["high"], df["low"], df["close"])
                if res is not None and not res.empty:
                    result["adx"] = _last(res.iloc[:, 0])
                    result["adx_pos"] = _last(res.iloc[:, 1])
                    result["adx_neg"] = _last(res.iloc[:, 2])

            elif ind_upper in ("STOCH", "STOCH_K"):
                res = ta.stoch(df["high"], df["low"], df["close"])
                if res is not None and not res.empty:
                    result["stoch_k"] = _last(res.iloc[:, 0])
                    result["stoch_d"] = _last(res.iloc[:, 1])

            elif ind_upper == "SUPERTREND":
                res = ta.supertrend(df["high"], df["low"], df["close"], length=10, multiplier=3.0)
                if res is not None and not res.empty:
                    result["supertrend_value"] = _last(res.iloc[:, 0])
                    result["supertrend_direction"] = _last(res.iloc[:, 1])

            else:
                series = _get_series(df, ind_upper)
                if series is not None:
                    result[ind.lower()] = _last(series)

        except Exception as e:
            logger.warning("Failed to calculate %s: %s", ind, e)

    return result


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

async def _fetch_twelvedata(
    symbol: str, interval: str, date_from: str, date_to: str
) -> list[dict]:
    api_key = os.environ.get("TWELVE_DATA_API_KEY")
    if not api_key:
        raise ValueError("TWELVE_DATA_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://api.twelvedata.com/time_series",
            params={
                "symbol": symbol,
                "interval": interval,
                "start_date": date_from,
                "end_date": date_to,
                "apikey": api_key,
                "order": "ASC",
                "outputsize": 5000,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") == "error" or "values" not in data:
        raise ValueError(f"Twelve Data error: {data.get('message', 'unknown')}")

    return [
        {
            "timestamp": int(pd.Timestamp(bar["datetime"]).timestamp()),
            "open": float(bar["open"]),
            "high": float(bar["high"]),
            "low": float(bar["low"]),
            "close": float(bar["close"]),
            "volume": float(bar.get("volume", 0)),
        }
        for bar in data["values"]
    ]


async def _fetch_polygon(
    symbol: str, multiplier: str, timespan: str, date_from: str, date_to: str
) -> list[dict]:
    api_key = os.environ.get("POLYGON_API_KEY")
    if not api_key:
        raise ValueError("POLYGON_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/{multiplier}/{timespan}/{date_from}/{date_to}",
            params={"apiKey": api_key, "limit": 50000, "sort": "asc"},
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") not in ("OK", "DELAYED") or "results" not in data:
        raise ValueError(f"Polygon error: {data.get('message', 'unknown')}")

    return [
        {
            "timestamp": int(bar["t"] / 1000),
            "open": float(bar["o"]),
            "high": float(bar["h"]),
            "low": float(bar["l"]),
            "close": float(bar["c"]),
            "volume": float(bar.get("v", 0)),
        }
        for bar in data["results"]
    ]


async def fetch_ohlcv(
    symbol: str, timeframe: str, date_from: str, date_to: str
) -> list[dict]:
    interval = TWELVE_DATA_INTERVALS.get(timeframe)
    if not interval:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {timeframe}")

    try:
        return await _fetch_twelvedata(symbol, interval, date_from, date_to)
    except Exception as e:
        logger.warning("Twelve Data failed for %s: %s — trying Polygon", symbol, e)

    multiplier, timespan = POLYGON_MULTIPLIER_TIMESPAN[timeframe]
    try:
        return await _fetch_polygon(symbol, multiplier, timespan, date_from, date_to)
    except Exception as e:
        logger.error("Polygon fallback also failed for %s: %s", symbol, e)
        raise HTTPException(status_code=502, detail=f"Could not fetch OHLCV data for {symbol}")


# ---------------------------------------------------------------------------
# Regime detection
# ---------------------------------------------------------------------------

def _regime_at(
    idx: int,
    adx_series: Optional[pd.Series],
    atr_pct_series: Optional[pd.Series],
) -> str:
    if adx_series is None or atr_pct_series is None:
        return "unknown"
    try:
        adx_val = adx_series.iloc[idx]
        atr_pct = atr_pct_series.iloc[idx]
        if pd.isna(adx_val) or pd.isna(atr_pct):
            return "unknown"
        if atr_pct > 3:
            return "volatile"
        if adx_val > 25:
            return "trending"
        return "ranging"
    except Exception:
        return "unknown"


# ---------------------------------------------------------------------------
# Condition evaluation
# ---------------------------------------------------------------------------

def _eval_conditions(
    df: pd.DataFrame,
    idx: int,
    conditions: list[Condition],
    cached: dict[str, pd.Series],
) -> bool:
    if idx < 1:
        return False

    for cond in conditions:
        series_a = cached.get(cond.indicator.upper())
        if series_a is None or idx >= len(series_a):
            return False

        val_a = series_a.iloc[idx]
        if pd.isna(val_a):
            return False

        op = cond.operator

        if op in ("crossover", "crossunder"):
            if not cond.target:
                return False
            series_b = cached.get(cond.target.upper())
            if series_b is None or idx >= len(series_b):
                return False

            prev_a = series_a.iloc[idx - 1]
            prev_b = series_b.iloc[idx - 1]
            val_b = series_b.iloc[idx]
            if pd.isna(prev_a) or pd.isna(prev_b) or pd.isna(val_b):
                return False

            if op == "crossover" and not (prev_a < prev_b and val_a >= val_b):
                return False
            if op == "crossunder" and not (prev_a > prev_b and val_a <= val_b):
                return False

        else:
            if cond.target:
                series_b = cached.get(cond.target.upper())
                if series_b is None or idx >= len(series_b):
                    return False
                compare = series_b.iloc[idx]
                if pd.isna(compare):
                    return False
            elif cond.value is not None:
                compare = cond.value
            else:
                return False

            checks = {
                ">": val_a > compare,
                "<": val_a < compare,
                ">=": val_a >= compare,
                "<=": val_a <= compare,
                "==": val_a == compare,
            }
            if not checks.get(op, False):
                return False

    return True


# ---------------------------------------------------------------------------
# Backtest simulation
# ---------------------------------------------------------------------------

def run_backtest(df: pd.DataFrame, config: StrategyConfig, timeframe: str = "1D") -> dict:
    # Pre-compute all indicator series needed
    needed: set[str] = set()
    for cond in config.conditions:
        needed.add(cond.indicator.upper())
        if cond.target:
            needed.add(cond.target.upper())
    needed.add("ATR")

    cached: dict[str, pd.Series] = {}
    for ind in needed:
        s = _get_series(df, ind)
        if s is not None:
            cached[ind] = s.reset_index(drop=True)

    # Pre-compute regime series
    try:
        adx_res = ta.adx(df["high"], df["low"], df["close"])
        adx_series: Optional[pd.Series] = (
            adx_res.iloc[:, 0].reset_index(drop=True) if adx_res is not None else None
        )
    except Exception:
        adx_series = None

    try:
        atr_full = ta.atr(df["high"], df["low"], df["close"], length=14)
        atr_pct_series: Optional[pd.Series] = (
            (atr_full / df["close"] * 100).reset_index(drop=True)
            if atr_full is not None
            else None
        )
    except Exception:
        atr_pct_series = None

    atr_series: pd.Series = cached.get("ATR", pd.Series([None] * len(df)))
    direction = config.direction.lower()
    warmup = 100  # increased from 50; swing/trendline indicators need ~100 bars of history
    trades: list[dict] = []
    equity: list[float] = [0.0]
    cumulative_r = 0.0

    in_trade = False
    pending_entry = False          # waiting for next bar's open
    entry_price = stop_price = target_price = current_stop = 0.0
    entry_idx = 0
    signal_atr = 0.0               # ATR at signal bar, used for trailing

    for i in range(warmup, len(df)):
        bar = df.iloc[i]

        # ── Resolve pending next_open entry ───────────────────────────────
        if pending_entry and not in_trade:
            raw_entry = float(bar["open"])
            raw_atr = float(atr_series.iloc[i - 1]) if i > 0 and not pd.isna(atr_series.iloc[i - 1]) else signal_atr

            if direction == "long":
                entry_price = raw_entry * (1 + config.slippage_pct / 100)
                stop_price = entry_price - raw_atr * config.stop_loss_r
                target_price = entry_price + raw_atr * config.take_profit_r
            else:
                entry_price = raw_entry * (1 - config.slippage_pct / 100)
                stop_price = entry_price + raw_atr * config.stop_loss_r
                target_price = entry_price - raw_atr * config.take_profit_r

            current_stop = stop_price
            signal_atr = raw_atr
            entry_idx = i
            in_trade = True
            pending_entry = False

        # ── Update trailing stop ──────────────────────────────────────────
        if in_trade and config.exit_type != "fixed":
            raw_atr_now = atr_series.iloc[i]
            if not pd.isna(raw_atr_now) and float(raw_atr_now) > 0:
                atr_now = float(raw_atr_now)

                if config.exit_type == "trailing_atr":
                    if direction == "long":
                        new_stop = float(bar["close"]) - atr_now * config.trail_atr_multiplier
                        current_stop = max(current_stop, new_stop)
                    else:
                        new_stop = float(bar["close"]) + atr_now * config.trail_atr_multiplier
                        current_stop = min(current_stop, new_stop)

                elif config.exit_type == "trailing_pct":
                    trail_amount = float(bar["close"]) * (config.trail_pct / 100)
                    if direction == "long":
                        new_stop = float(bar["close"]) - trail_amount
                        current_stop = max(current_stop, new_stop)
                    else:
                        new_stop = float(bar["close"]) + trail_amount
                        current_stop = min(current_stop, new_stop)

        # ── Check exits ───────────────────────────────────────────────────
        if in_trade:
            exit_price: Optional[float] = None
            outcome: Optional[str] = None

            if direction == "long":
                if float(bar["low"]) <= current_stop:
                    exit_price = current_stop
                    outcome = "loss" if current_stop < entry_price else "win"
                elif float(bar["high"]) >= target_price and config.exit_type == "fixed":
                    exit_price = target_price
                    outcome = "win"
            else:
                if float(bar["high"]) >= current_stop:
                    exit_price = current_stop
                    outcome = "loss" if current_stop > entry_price else "win"
                elif float(bar["low"]) <= target_price and config.exit_type == "fixed":
                    exit_price = target_price
                    outcome = "win"

            if exit_price is not None:
                # Apply slippage on exit
                if direction == "long":
                    exit_price_filled = exit_price * (1 - config.slippage_pct / 100)
                else:
                    exit_price_filled = exit_price * (1 + config.slippage_pct / 100)

                risk_dollars = abs(entry_price - stop_price)
                if risk_dollars > 0:
                    gross_r = (
                        (exit_price_filled - entry_price) / risk_dollars
                        if direction == "long"
                        else (entry_price - exit_price_filled) / risk_dollars
                    )
                    # Subtract commission as fraction of risk
                    commission_r = (2 * config.commission_per_trade) / risk_dollars
                    r_multiple = gross_r - commission_r
                else:
                    r_multiple = 0.0

                if outcome == "win" and r_multiple < 0:
                    outcome = "loss"
                elif outcome == "loss" and r_multiple > 0:
                    outcome = "win"

                cumulative_r += r_multiple
                trades.append({
                    "entry_idx": entry_idx,
                    "exit_idx": i,
                    "entry_price": round(entry_price, 4),
                    "exit_price": round(exit_price_filled, 4),
                    "outcome": outcome,
                    "r_multiple": round(r_multiple, 4),
                    "direction": direction,
                    "regime": _regime_at(entry_idx, adx_series, atr_pct_series),
                    "bars_held": i - entry_idx,
                })
                equity.append(round(cumulative_r, 4))
                in_trade = False

        # ── Check entry conditions ────────────────────────────────────────
        if not in_trade and not pending_entry and _eval_conditions(df, i, config.conditions, cached):
            raw_atr = atr_series.iloc[i]
            if raw_atr is None or pd.isna(raw_atr) or float(raw_atr) == 0:
                continue

            signal_atr = float(raw_atr)

            if config.entry_timing == "next_open" and i + 1 < len(df):
                pending_entry = True
            else:
                # Enter at signal bar's close
                raw_entry = float(bar["close"])
                if direction == "long":
                    entry_price = raw_entry * (1 + config.slippage_pct / 100)
                    stop_price = entry_price - signal_atr * config.stop_loss_r
                    target_price = entry_price + signal_atr * config.take_profit_r
                else:
                    entry_price = raw_entry * (1 - config.slippage_pct / 100)
                    stop_price = entry_price + signal_atr * config.stop_loss_r
                    target_price = entry_price - signal_atr * config.take_profit_r

                current_stop = stop_price
                entry_idx = i
                in_trade = True

    # ── Close open trade at last bar ──────────────────────────────────────
    if in_trade:
        last_bar = df.iloc[-1]
        last_close = float(last_bar["close"])
        if direction == "long":
            exit_filled = last_close * (1 - config.slippage_pct / 100)
        else:
            exit_filled = last_close * (1 + config.slippage_pct / 100)

        risk_dollars = abs(entry_price - stop_price)
        if risk_dollars > 0:
            gross_r = (
                (exit_filled - entry_price) / risk_dollars
                if direction == "long"
                else (entry_price - exit_filled) / risk_dollars
            )
            commission_r = (2 * config.commission_per_trade) / risk_dollars
            r_multiple = gross_r - commission_r
        else:
            r_multiple = 0.0

        outcome = "win" if r_multiple > 0 else ("loss" if r_multiple < 0 else "breakeven")
        cumulative_r += r_multiple
        trades.append({
            "entry_idx": entry_idx,
            "exit_idx": len(df) - 1,
            "entry_price": round(entry_price, 4),
            "exit_price": round(exit_filled, 4),
            "outcome": outcome,
            "r_multiple": round(r_multiple, 4),
            "direction": direction,
            "regime": _regime_at(entry_idx, adx_series, atr_pct_series),
            "bars_held": len(df) - 1 - entry_idx,
        })
        equity.append(round(cumulative_r, 4))

    # ── Empty result ───────────────────────────────────────────────────────
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0, "expectancy": 0, "profit_factor": None,
            "max_drawdown": 0, "avg_rr": round(config.take_profit_r / config.stop_loss_r, 2),
            "avg_win_r": None, "avg_loss_r": None,
            "largest_win_r": None, "largest_loss_r": None,
            "max_consecutive_wins": 0, "max_consecutive_losses": 0,
            "sharpe_ratio": None, "expectancy_per_bar": None,
            "equity_curve": [0.0], "trades": [], "regime_breakdown": {},
        }

    # ── Core stats ────────────────────────────────────────────────────────
    wins = [t for t in trades if t["outcome"] == "win"]
    losses = [t for t in trades if t["outcome"] == "loss"]
    r_multiples = [t["r_multiple"] for t in trades]

    win_rate = len(wins) / len(trades)
    expectancy = sum(r_multiples) / len(trades)
    gross_profit = sum(t["r_multiple"] for t in wins) if wins else 0.0
    gross_loss = abs(sum(t["r_multiple"] for t in losses)) if losses else 0.0
    profit_factor = round(gross_profit / gross_loss, 4) if gross_loss > 0 else None

    avg_win_r = round(gross_profit / len(wins), 4) if wins else None
    avg_loss_r = round(-gross_loss / len(losses), 4) if losses else None
    largest_win_r = round(max(t["r_multiple"] for t in wins), 4) if wins else None
    largest_loss_r = round(min(t["r_multiple"] for t in losses), 4) if losses else None

    # ── Max drawdown ──────────────────────────────────────────────────────
    peak, max_dd = equity[0], 0.0
    for val in equity:
        if val > peak:
            peak = val
        dd = peak - val
        if dd > max_dd:
            max_dd = dd

    # ── Consecutive streaks ───────────────────────────────────────────────
    outcomes_list = [t["outcome"] for t in trades]
    max_consecutive_wins = _max_consecutive(outcomes_list, "win")
    max_consecutive_losses = _max_consecutive(outcomes_list, "loss")

    # ── Sharpe ratio ──────────────────────────────────────────────────────
    sharpe_ratio: Optional[float] = None
    if len(r_multiples) >= 3:
        mean_r = sum(r_multiples) / len(r_multiples)
        variance = sum((x - mean_r) ** 2 for x in r_multiples) / (len(r_multiples) - 1)
        std_r = math.sqrt(variance)
        if std_r > 0:
            bpy = BARS_PER_YEAR.get(timeframe, 252)
            avg_bars_held = (
                sum(t["bars_held"] for t in trades) / len(trades)
                if trades else 1
            )
            trades_per_year = bpy / max(avg_bars_held, 1)
            sharpe_ratio = round((mean_r / std_r) * math.sqrt(trades_per_year), 4)

    # ── Expectancy per bar ────────────────────────────────────────────────
    avg_bars = sum(t["bars_held"] for t in trades) / len(trades)
    expectancy_per_bar = round(expectancy / avg_bars, 6) if avg_bars > 0 else None

    # ── Regime breakdown ──────────────────────────────────────────────────
    regime_groups: dict[str, list[dict]] = {}
    for trade in trades:
        regime_groups.setdefault(trade["regime"], []).append(trade)

    regime_breakdown = {
        regime: {
            "total_trades": len(rt),
            "win_rate": round(len([t for t in rt if t["outcome"] == "win"]) / len(rt), 4),
            "expectancy": round(sum(t["r_multiple"] for t in rt) / len(rt), 4),
        }
        for regime, rt in regime_groups.items()
    }

    return {
        "total_trades": len(trades),
        "win_rate": round(win_rate, 4),
        "expectancy": round(expectancy, 4),
        "profit_factor": profit_factor,
        "max_drawdown": round(max_dd, 4),
        "avg_rr": round(config.take_profit_r / config.stop_loss_r, 2),
        "avg_win_r": avg_win_r,
        "avg_loss_r": avg_loss_r,
        "largest_win_r": largest_win_r,
        "largest_loss_r": largest_loss_r,
        "max_consecutive_wins": max_consecutive_wins,
        "max_consecutive_losses": max_consecutive_losses,
        "sharpe_ratio": sharpe_ratio,
        "expectancy_per_bar": expectancy_per_bar,
        "equity_curve": equity,
        "trades": trades,
        "regime_breakdown": regime_breakdown,
    }


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="EDGE Python Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/indicators")
def indicators(req: IndicatorsRequest) -> dict:
    if len(req.candles) < 2:
        raise HTTPException(status_code=400, detail="At least 2 candles required")
    df = candles_to_df(req.candles)
    return calculate_indicators(df, req.indicators)


@app.post("/backtest")
async def backtest(req: BacktestRequest) -> dict:
    if req.timeframe not in TWELVE_DATA_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {req.timeframe}")

    raw = await fetch_ohlcv(req.symbol, req.timeframe, req.date_from, req.date_to)

    if len(raw) < 60:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough data for {req.symbol} ({len(raw)} bars — need at least 60)",
        )

    df = pd.DataFrame(raw).sort_values("timestamp").reset_index(drop=True)
    result = run_backtest(df, req.strategy_config, timeframe=req.timeframe)
    result.update(
        symbol=req.symbol,
        timeframe=req.timeframe,
        date_from=req.date_from,
        date_to=req.date_to,
    )
    return result
