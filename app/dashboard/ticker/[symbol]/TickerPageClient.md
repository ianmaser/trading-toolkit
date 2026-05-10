FILE: app/dashboard/ticker/[symbol]/TickerPageClient.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Renders the interactive body of the ticker detail page. It fetches quote, company details,
and candle data for a given symbol, displays a candlestick chart with a timeframe selector,
and computes a multi-timeframe confluence score from three simultaneously-loaded candle
series. Placeholder cards are shown for Signal and Pattern Detection features (Phase 6+).

HOW IT WORKS (step by step):
1. The parent server component passes `symbol` as a prop (from the URL's [symbol] segment).
2. On mount, `useState(() => { setActiveTicker(symbol) })` writes the symbol to the global
   Zustand store once. BULL-E reads `activeTicker` from this store to know the current context.
   A `useState` factory (not `useEffect`) is used so the call runs exactly once at mount time.
3. Three TanStack Query hooks (`useQuote`, `useTickerDetails`, `useCandles`) fetch data in
   parallel. Each is keyed by symbol and timeframe, so the cache correctly separates results
   across tickers and timeframes.
4. Three additional `useCandles` calls fetch fixed-range candle series for 1D/4H/1H.
   These always load in the background regardless of which main-chart timeframe is active.
   They feed the multi-timeframe confluence panel.
5. `computeTrend` (imported from MiniChart) evaluates each series and returns 'up', 'down',
   or 'neutral'. `confluenceScore` combines the three trend signals: each 'up' = +1,
   'down' = -1, neutral = 0. Raw sum range is -3 to +3; normalized to 0-100 with
   `(raw + 3) / 6 * 100`. The result drives the confluence badge label and color.
6. `CandlestickChart` receives a `ref` typed as `CandlestickChartHandle`. This is an
   imperative ref pattern — the chart component uses `useImperativeHandle` to expose methods
   (e.g. scrollToBar) that the parent can call directly without causing a re-render.
7. When the user picks a different timeframe, `handleTimeframeChange` updates `activeTimeframe`
   state. The `mainChartRange` function recomputes the date window, which changes the
   `useCandles` query key, triggering a fresh fetch for that timeframe.

KEY CONCEPTS USED:
- **TanStack Query (`useQuery`)**: Declarative data fetching with automatic caching and
  deduplication. Multiple `useCandles` calls with the same key share a single fetch.
- **`useRef` + `CandlestickChartHandle`**: React's imperative escape hatch. The chart's
  internal methods are exposed via a ref so the parent can call them without prop drilling
  or state changes.
- **`useState` as a one-time mount effect**: `useState(() => { setActiveTicker(symbol) })`
  exploits the lazy initializer to run a side effect exactly once on mount. This is
  intentionally not `useEffect` — using `useEffect` with an empty dep array would work too,
  but the `useState` pattern communicates "this runs once and has no cleanup".
- **Multi-timeframe confluence scoring**: A simple -3 to +3 raw score is normalized to 0-100
  to give the UI a single number that represents overall directional alignment across timeframes.
- **`useCallback` memoization**: `handleTimeframeChange` is wrapped in `useCallback` with an
  empty dependency array so the function reference is stable across renders. This prevents
  `CandlestickChart` from unnecessarily re-rendering when the parent re-renders for other reasons.

INPUTS AND OUTPUTS:
- Props: `{ symbol: string }` — the ticker symbol from the URL
- Output: Full page layout with candlestick chart, confluence panel, and placeholder cards
- Side effects: writes `activeTicker` to Zustand store on mount

WHAT TO CHECK IF SOMETHING BREAKS:
- Chart not rendering: check `useCandles` is returning data. Open network tab and look for
  the `/api/market/candles` response. If empty, verify the symbol and date range are valid.
- Confluence score always shows "Neutral": check that all three `useCandles` calls for 1D/4H/1H
  are returning candles. An empty array causes `computeTrend` to return 'neutral'.
- BULL-E doesn't know which ticker the user is viewing: check that `setActiveTicker` is
  being called and that `useAppStore` is wired up in the BULL-E context assembly.
- Timeframe change not re-fetching: verify that `mainChartRange` returns a different `from`
  date for the new timeframe — TanStack Query only re-fetches when the query key changes.

DEPENDENCIES:
- `react` (useRef, useState, useCallback): React hooks for refs, state, and memoization.
- `@/hooks/useMarketData` (useQuote, useTickerDetails, useCandles): TanStack Query wrappers
  for market data API routes.
- `@/lib/store` (useAppStore): Zustand store for global UI state including active ticker.
- `@/components/features/CandlestickChart` (CandlestickChart, CandlestickChartHandle):
  The main interactive OHLC chart with imperative ref API.
- `@/components/features/MiniChart` (MiniChart, computeTrend): Sparkline chart plus the
  shared trend-direction utility function.
- `lucide-react`: Icon library for ArrowUp/ArrowDown price change indicators.
