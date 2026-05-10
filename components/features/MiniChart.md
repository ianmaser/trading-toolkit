FILE: components/features/MiniChart.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Renders a small sparkline-style line chart (64px tall) for the multi-timeframe confluence
panel on the ticker detail page. Three instances run side-by-side — one for 1D, 4H, and 1H —
each colored green, red, or gray based on the computed directional trend. No axes, labels,
or interaction handles are shown; the chart is purely visual.

HOW IT WORKS (step by step):
1. The parent (TickerPageClient) calls `computeTrend(candles)` for each timeframe and passes
   the result as the `trend` prop. computeTrend compares the most recent close to the close
   10 bars ago: if the change is >1%, trend is 'up'; if <-1%, 'down'; otherwise 'neutral'.
2. The single `useEffect` runs on every change to `candles` or `trend`. It:
   a. Selects a line color based on `trend`.
   b. Creates a fresh chart instance with all axes, crosshairs, and interaction disabled.
   c. Adds a LineSeries and calls `setData()` with `{ time, value }` pairs where `value`
      is the closing price of each candle.
   d. Calls `fitContent()` so all data fits in the chart's visible range.
   e. Attaches a ResizeObserver to the container so the canvas resizes with its parent.
   f. Returns a cleanup function that disconnects the observer and calls `chart.remove()`
      to free the canvas memory.
3. Because both `candles` and `trend` are in the dependency array, the entire chart is
   recreated when either changes. This is intentional — at 64px height the recreation cost
   is negligible, and it avoids the complexity of splitting init and data-sync effects.

KEY CONCEPTS USED:
- **lightweight-charts**: A TradingView open-source canvas-based charting library. Charts
  are created and manipulated imperatively (createChart, setData, remove), not through JSX.
  The canvas renders directly inside the referenced `<div>`.
- **`useRef` for DOM + chart instance**: Two refs are used — `containerRef` for the DOM
  element that lightweight-charts renders into, and `chartRef` to store the chart API
  instance so the ResizeObserver callback can access it after the effect has returned.
- **ResizeObserver**: A browser API that watches an element's size and fires a callback
  when it changes. Used here to keep the chart canvas dimensions synchronized with its
  container element, which resizes during layout shifts.
- **Full recreate on dependency change**: Unlike CandlestickChart which splits init/data
  effects, MiniChart uses a single effect that tears down and rebuilds the chart on any
  change. This keeps the code simpler at the cost of slightly more work per update.

INPUTS AND OUTPUTS:
- Props: `candles: Candle[]`, `timeframe: Timeframe`, `trend: Trend`, `isLoading?: boolean`
- Output: a 64px tall sparkline chart with a timeframe label and trend icon above it
- No state or side effects beyond the chart canvas

WHAT TO CHECK IF SOMETHING BREAKS:
- Charts all showing "neutral" gray: check that the three `useCandles` calls in
  TickerPageClient are returning data. If candles arrays are empty, computeTrend returns
  'neutral' regardless of actual price direction.
- Chart not filling its container: the ResizeObserver may not have fired yet on mount.
  Check that the container div has an explicit height (currently `h-16` in Tailwind).
- Memory leak warning: if `chart.remove()` is not called in the cleanup, lightweight-charts
  will leave orphaned canvas elements. Verify the useEffect cleanup returns `chart.remove()`.

DEPENDENCIES:
- `lightweight-charts` (createChart, LineSeries, ColorType, IChartApi, Time): Canvas
  charting library for the sparkline.
- `react` (useEffect, useRef): React hooks for DOM refs and the chart lifecycle.
- `lucide-react` (TrendingUp, TrendingDown, Minus): Trend direction icons.
