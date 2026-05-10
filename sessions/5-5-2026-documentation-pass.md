# Session Notes — 5-5-2026 — Documentation Pass

## Goal

Retroactively apply the new Code Documentation Standards (added to CLAUDE.md) across all
source files with non-obvious logic. Excluded: self-explanatory UI forms, simple layout
wrappers, and auto-generated shadcn/ui components.

Every file in the list below needs:

1. **Inline comments** — on every function/hook, non-obvious line, TypeScript type,
   and library-specific API call. Tone: explain to a JS-competent developer who has
   never seen Next.js, Supabase, TanStack Query, Zustand, or Vercel AI SDK before.

2. **Companion `.md` file** — same directory, same base name. Required sections:
   FILE, LAST UPDATED, WHAT THIS FILE DOES, HOW IT WORKS (step by step), KEY CONCEPTS
   USED, INPUTS AND OUTPUTS, WHAT TO CHECK IF SOMETHING BREAKS, DEPENDENCIES.

See CLAUDE.md §"Code Documentation Standards" for the full spec.

---

## Files to Document

Work through these groups in order. Mark each file ✅ when both inline comments
and the companion .md are complete.

### components/features/ (4 files)
Complex logic only — streaming AI, charting library internals, strategy serialization.
- [x] `BullEChat.tsx` + `BullEChat.md`
- [x] `CandlestickChart.tsx` + `CandlestickChart.md`
- [x] `MiniChart.tsx` + `MiniChart.md`
- [x] `StrategyBuilder.tsx` + `StrategyBuilder.md`

### hooks/ (4 files)
TanStack Query patterns, Supabase mutations, backtest orchestration.
- [x] `useMarketData.ts` + `useMarketData.md`
- [x] `useWatchlist.ts` + `useWatchlist.md`
- [x] `useInstitutionalData.ts` + `useInstitutionalData.md`
- [x] `useBacktest.ts` + `useBacktest.md`

### services/ (3 files)
Provider fallback logic, Claude AI parsing.
- [x] `marketData.ts` + `marketData.md`
- [x] `institutionalData.ts` + `institutionalData.md`
- [x] `strategyParser.ts` + `strategyParser.md`

### app/api/ routes (8 files)
Rate limiting, RLS, data pipeline assembly.
- [x] `app/api/market/candles/route.ts` + `candles.md`
- [x] `app/api/market/quote/route.ts` + `quote.md`
- [x] `app/api/market/search/route.ts` + `search.md`
- [x] `app/api/market/details/route.ts` + `details.md`
- [x] `app/api/institutional/[symbol]/route.ts` + `institutional.md`
- [x] `app/api/backtest/route.ts` + `backtest-route.md`
- [x] `app/api/backtest/analyze/route.ts` + `analyze.md`
- [x] `app/api/strategy/parse/route.ts` + `parse.md`

### app/ pages (4 files)
Non-obvious wiring: Query client bootstrap, auth callback flow, multi-source orchestration.
- [x] `app/providers.tsx` + `providers.md`
- [x] `app/auth/callback/route.ts` + `auth-callback.md`
- [x] `app/dashboard/ticker/[symbol]/TickerPageClient.tsx` + `TickerPageClient.md`
- [x] `app/dashboard/backtest/page.tsx` + `backtest-page.md`

### lib/ (3 files)
Zustand store, rate limiter, SSR Supabase client with cookie handling.
- [x] `lib/store.ts` + `store.md`
- [x] `lib/rateLimit.ts` + `rateLimit.md`
- [x] `lib/supabase/server.ts` + `server.md`

### types/ — SKIPPED
Self-explanatory for a TypeScript-familiar developer.

### python-service/ (1 file)
All indicator math, backtest engine, pattern detection, swing/trendline/S&R logic.
- [x] `python-service/main.py` + `main.md`

---

## Do NOT document
- `components/ui/*` — auto-generated shadcn/ui library components
- `app/page.tsx` — single-line redirect
- `Sidebar.tsx`, `TopBar.tsx`, `TickerCard.tsx`, `WatchlistSearch.tsx`, `CatalystStrip.tsx` — self-explanatory UI
- `useUser.ts`, `lib/utils.ts`, `lib/supabase/client.ts` — trivial wrappers
- `app/layout.tsx`, `app/login/page.tsx`, `app/signup/page.tsx` — standard forms/layouts
- `app/dashboard/layout.tsx`, `app/dashboard/watchlist/page.tsx` — layout boilerplate
- `app/dashboard/ticker/[symbol]/page.tsx` — thin server component wrapper

---

## Notes
- Total: ~28 files (down from 46), each needs inline comments + companion .md
- Work top-to-bottom through the list — read each file, add inline comments, write .md
- Use TaskCreate at session start to track progress through the checklist
