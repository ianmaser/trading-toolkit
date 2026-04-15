# Revisit Later — Precautionary Notes

## 1. yfinance Fallback
yfinance scrapes Yahoo Finance and breaks without warning — it is not production-safe.
Current plan: Polygon.io → yfinance fallback.
Better plan: Polygon.io → a second paid provider (Alpaca, Tiingo, or Twelve Data).
Fine to leave as yfinance during early prototyping, but swap before any real users touch it.

## 2. Python Microservice Deployment
The backtest service lives in python-service/ but the plan doesn't define where it runs.
Vercel does not natively run long-lived Python processes with heavy pandas/numpy workloads (cold starts are brutal).
Options: Railway, Fly.io, or Render as a persistent service.
Alternative: Rewrite as a Vercel serverless Python function if the workload stays light.
Decide before building the Backtest Lab UI (Phase 4) so the API base URL is configured correctly from the start.

## 3. Dual Indicator Libraries — Signal Drift Risk
The signal engine (Phase 5) uses the `technicalindicators` npm package (JavaScript).
The backtest service (Phase 4) uses `pandas-ta` (Python).
If their RSI, MACD, EMA, etc. calculations differ even slightly, live signals won't match backtest results — which breaks the core value proposition of the playbook system.
Revisit: after both are built, run the same candle data through both and compare outputs. Fix any divergence before shipping.

## 4. No Architecture Document
ARCHITECTURE.md currently contains the product vision, not a technical architecture.
Missing: data flow diagram, API boundary definitions, caching layer map, auth flow, Python↔Next.js proxy design.
Not urgent now, but sketch it out before Phase 4 (Python service) and Phase 6 (BULL-E) when cross-service communication gets complex.

## 5. Unusual Whales API Not in Build Plan
The product vision (PROJECT.md) calls for options flow, short interest, and dark pool volume via Unusual Whales in the catalyst strip.
None of the 22 build prompts mention it.
Revisit: add it to Phase 3, Prompt 9 (Full ticker page) before building the catalyst strip component, or it will need to be retrofitted later.
