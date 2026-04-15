# Revisit Later — Precautionary Notes

## 1. ~~yfinance Fallback~~ — RESOLVED
Replaced yfinance with Twelve Data as the secondary provider.
Data stack: Polygon.io (primary) → Twelve Data (fallback).
Updated in: PLAN.MD (Prompts 5 and 10), .env.local (TWELVE_DATA_API_KEY added).

## 2. ~~Python Microservice Deployment~~ — RESOLVED
Python service deploys on Railway. railway.toml added to python-service/.
All Next.js API routes read the base URL from process.env.PYTHON_SERVICE_URL (localhost:8000 in dev, Railway URL in production).
Updated in: .env.local (PYTHON_SERVICE_URL), PLAN.MD (Prompt 10), python-service/railway.toml created.

## 3. ~~Dual Indicator Libraries~~ — RESOLVED
All indicator math is now centralized in the Python service (pandas-ta only).
The Python /indicators endpoint accepts candle data + a list of indicators and returns calculated values.
signalEngine.ts calls /indicators for live signals. The /backtest endpoint uses the same internal pandas-ta functions.
No JavaScript indicator library is used anywhere. Live signals and backtests are mathematically identical by design.
Updated in: PLAN.MD (Prompts 10 and 13).

## 4. ~~No Architecture Document~~ — RESOLVED
ARCHITECTURE.md now contains full technical architecture:
market data flow + cache TTLs, Python service API contract (all endpoints + request/response shapes),
Supabase RLS policy table, auth flow diagram, BULL-E context injection pipeline.

## 5. ~~Unusual Whales API Not in Build Plan~~ — RESOLVED
Added as Prompt 8b (new prompt before Prompt 9) in Phase 3.
services/institutionalData.ts: Unusual Whales (primary) → Tradier (fallback, options only).
Catalyst strip in Prompt 9 now explicitly consumes this service.
Types defined in types/institutional.ts. Route: /api/institutional/[symbol] (15min Redis cache).
Updated in: PLAN.MD (Prompt 8b + Prompt 9), .env.local (TRADIER_API_KEY added), ARCHITECTURE.md (Section 2).
