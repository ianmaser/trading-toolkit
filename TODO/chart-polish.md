# Chart Polish — Phase 10

## CandlestickChart.tsx — missing features

### 1. OHLC legend overlay
A React div overlaid on the chart that shows O / H / L / C / Volume for the hovered candle.
Subscribe to `chart.subscribeCrosshairMove(handler)` on mount, unsubscribe on unmount.
Update state with the hovered bar's values and render above the chart.

### 2. Last-price label
Show a persistent label on the right price axis for the last close.
Use `series.applyOptions({ lastValueVisible: true })` — currently set implicitly.
May need `priceLineVisible: true` and a custom `PriceLine` to style it distinctly.

### 3. CrosshairMode clarification
Currently using `CrosshairMode.Magnet` which snaps to OHLC points.
This causes the price axis label to snap to Open rather than tracking the cursor smoothly.
Consider switching to `CrosshairMode.Normal` once the OHLC legend is in place
(so the user sees exact cursor price in the legend, not just the snapped axis label).

### 4. Zoom / scroll UX
No visible hint that the chart is scrollable/zoomable.
Consider a subtle "scroll to zoom" tooltip on first visit or a reset-zoom button.

### 5. MiniChart — no crosshair at all
Currently `crosshair: { horzLine: { visible: false }, vertLine: { visible: false } }`.
Fine for the confluence panel, no changes needed here.
