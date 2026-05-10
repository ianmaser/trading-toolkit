FILE: components/features/CandlestickChart.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
The primary interactive OHLCV (open/high/low/close/volume) candlestick chart for the ticker
detail page. Built on lightweight-charts (TradingView's open-source charting library). Uses
the React `forwardRef` + `useImperativeHandle` pattern to expose a `scrollToTime()` method
to the parent component, allowing programmatic chart navigation without re-renders.

HOW IT WORKS (step by step):
1. **Mount (init effect — `[]` deps)**: Creates the lightweight-charts chart instance inside
   the container `<div>`. Adds a CandlestickSeries for price and a HistogramSeries for volume.
   Volume is attached to a named `'volume'` price scale with `scaleMargins: { top: 0.8 }`
   so it occupies only the bottom 20% of the chart height. Series instances are stored in
   `useRef`s so they can be accessed from other effects without triggering re-renders.
2. **Data sync effect (`[candles]` dep)**: Runs whenever new candle data arrives. Calls
   `setData()` on the existing series instances — this is far cheaper than recreating the
   chart and preserves zoom/scroll state between timeframe switches.
3. **Annotation effect (`[annotations]` dep)**: Clears all existing price lines from the
   candle series and redraws them from the updated `annotations` prop. Used by the Phase 6
   signal engine to draw support/resistance lines and zones on the chart.
4. **Resize effect (`[]` dep)**: Attaches a `ResizeObserver` to the container div on mount.
   When the container resizes (sidebar toggle, window resize), it calls `chart.applyOptions`
   with the new dimensions to keep the canvas in sync.
5. **`useImperativeHandle`**: Exposes `scrollToTime(timestamp)` to the parent via the ref.
   The method reads the current visible range, computes its half-width, and re-centers
   the same window on the target timestamp — preserving the user's current zoom level.
6. **Timeframe selector**: A row of buttons above the chart. Clicking a button calls
   `handleTimeframeClick`, which updates internal `activeTimeframe` state (for button
   highlighting) and fires `onTimeframeChange` so the parent can re-fetch candles.

KEY CONCEPTS USED:
- **`forwardRef` + `useImperativeHandle`**: React's imperative escape hatch. `forwardRef`
  allows a parent to pass a `ref` prop to a custom component (normally refs only work on
  DOM elements). `useImperativeHandle` defines the shape of the object the ref points to —
  in this case, `{ scrollToTime: (ts: number) => void }`.
- **Split `useEffect` for init vs. data**: The chart is created once in a `[]`-dep effect.
  Data is synced in a `[candles]`-dep effect. This prevents tearing down and recreating the
  chart (and losing scroll position) every time new data arrives.
- **`ISeriesApi` refs**: The candle and volume series objects are stored in `useRef` rather
  than `useState` so the data-sync effect can call `setData()` without triggering a
  component re-render on every update.
- **`priceScaleId: 'volume'`**: lightweight-charts supports multiple named price scales.
  Assigning the volume histogram to the `'volume'` scale isolates it from the main price
  scale so the two y-axes don't interfere with each other.
- **ResizeObserver**: A browser API that watches an element's bounding box. Used here to
  keep the canvas sized to its container on every layout shift.

INPUTS AND OUTPUTS:
- Props: `candles: Candle[]`, `isLoading?: boolean`, `onTimeframeChange?: fn`,
  `defaultTimeframe?: Timeframe`, `annotations?: ChartAnnotation[]`, `className?: string`
- Ref: exposes `CandlestickChartHandle` with `scrollToTime(timestamp: number)`
- Output: a 400px tall interactive candlestick chart with timeframe selector buttons

WHAT TO CHECK IF SOMETHING BREAKS:
- Blank chart, no candles showing: check that the `candles` prop is non-empty. The data
  effect guard `candles.length === 0` skips setData on empty arrays — the chart will render
  but show no data.
- Chart overflowing its container or wrong dimensions: the ResizeObserver may not be firing.
  Ensure the container div has a defined height (currently `h-[400px]`).
- `scrollToTime` doing nothing: check that `chartRef.current` is set (i.e. the mount effect
  has run and the chart was created). If the ref is null, the imperative method is a no-op.
- Volume bars not showing: check that candles have a non-zero `volume` field. If the Python
  service or market data provider returns volume as 0 or undefined, the bars will be invisible.

DEPENDENCIES:
- `lightweight-charts` (createChart, CandlestickSeries, HistogramSeries, CrosshairMode,
  LineStyle, IChartApi, ISeriesApi, Time): Canvas charting library for OHLCV rendering.
- `react` (forwardRef, useEffect, useImperativeHandle, useRef, useState): React hooks
  for the chart lifecycle, imperative handle, and timeframe state.
