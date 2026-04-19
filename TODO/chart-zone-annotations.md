# Chart Zone Annotations — Full Shaded Fill

## What's missing
`CandlestickChart` renders `type: 'zone'` annotations as two dotted boundary lines (top + bottom).
They are not filled rectangles — there is no shaded area between the price levels.

## Why
`lightweight-charts` v5 has no native fill-between-prices primitive.
`createPriceLine` only draws a single horizontal line.

## How to fix
Implement a custom series plugin using the lightweight-charts v5 plugin API:
- Create a `PriceZonePlugin` that implements `ISeriesPrimitive`
- Override `paneViews()` to return a renderer that draws filled rectangles between `priceMin` and `priceMax` on the canvas
- Attach it to the candlestick series via `series.attachPrimitive(plugin)`

Reference: https://tradingview.github.io/lightweight-charts/docs/plugins/series-primitives

## Where to apply
`components/features/CandlestickChart.tsx` — the `annotations` effect block.
Replace the double-`createPriceLine` zone logic with the plugin renderer.
