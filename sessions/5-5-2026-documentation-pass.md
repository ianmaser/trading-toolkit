# Session Notes — 5-5-2026 — Documentation Pass

## Goal

Retroactively apply the new Code Documentation Standards (added to CLAUDE.md) across all
existing source files in the app. Every file needs:

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

### components/features/ (9 files)
- [ ] `Sidebar.tsx` + `Sidebar.md`
- [ ] `TopBar.tsx` + `TopBar.md`
- [ ] `BullEChat.tsx` + `BullEChat.md`
- [ ] `TickerCard.tsx` + `TickerCard.md`
- [ ] `WatchlistSearch.tsx` + `WatchlistSearch.md`
- [ ] `CandlestickChart.tsx` + `CandlestickChart.md`
- [ ] `CatalystStrip.tsx` + `CatalystStrip.md`
- [ ] `MiniChart.tsx` + `MiniChart.md`
- [ ] `StrategyBuilder.tsx` + `StrategyBuilder.md`

### hooks/ (5 files)
- [ ] `useUser.ts` + `useUser.md`
- [ ] `useMarketData.ts` + `useMarketData.md`
- [ ] `useWatchlist.ts` + `useWatchlist.md`
- [ ] `useInstitutionalData.ts` + `useInstitutionalData.md`
- [ ] `useBacktest.ts` + `useBacktest.md`

### services/ (3 files)
- [ ] `marketData.ts` + `marketData.md`
- [ ] `institutionalData.ts` + `institutionalData.md`
- [ ] `strategyParser.ts` + `strategyParser.md`

### app/api/ routes (8 files)
- [ ] `app/api/market/candles/route.ts` + `candles.md`
- [ ] `app/api/market/quote/route.ts` + `quote.md`
- [ ] `app/api/market/search/route.ts` + `search.md`
- [ ] `app/api/market/details/route.ts` + `details.md`
- [ ] `app/api/institutional/[symbol]/route.ts` + `institutional.md`
- [ ] `app/api/backtest/route.ts` + `backtest-route.md`
- [ ] `app/api/backtest/analyze/route.ts` + `analyze.md`
- [ ] `app/api/strategy/parse/route.ts` + `parse.md`

### app/ pages (7 files)
- [ ] `app/layout.tsx` + `layout.md`
- [ ] `app/providers.tsx` + `providers.md`
- [ ] `app/login/page.tsx` + `login.md`
- [ ] `app/signup/page.tsx` + `signup.md`
- [ ] `app/dashboard/layout.tsx` + `dashboard-layout.md`
- [ ] `app/dashboard/watchlist/page.tsx` + `watchlist-page.md`
- [ ] `app/dashboard/ticker/[symbol]/page.tsx` + `ticker-page.md`
- [ ] `app/dashboard/ticker/[symbol]/TickerPageClient.tsx` + `TickerPageClient.md`
- [ ] `app/dashboard/backtest/page.tsx` + `backtest-page.md`
- [ ] `app/auth/callback/route.ts` + `auth-callback.md`

### lib/ (5 files)
- [ ] `lib/utils.ts` + `utils.md`
- [ ] `lib/store.ts` + `store.md`
- [ ] `lib/rateLimit.ts` + `rateLimit.md`
- [ ] `lib/supabase/client.ts` + `client.md`
- [ ] `lib/supabase/server.ts` + `server.md`

### types/ (4 files)
- [ ] `types/market.ts` + `market.md`
- [ ] `types/watchlist.ts` + `watchlist.md`
- [ ] `types/institutional.ts` + `institutional.md`
- [ ] `types/backtest.ts` + `backtest.md`

### python-service/ (1 file)
- [ ] `python-service/main.py` + `main.md`

---

## Do NOT document
- `components/ui/*` — auto-generated shadcn/ui library components, not our code
- `app/page.tsx` — single-line redirect, self-explanatory

---

## Notes
- Total: ~46 source files, ~46 companion .md files
- Work top-to-bottom through the list — read each file, add inline comments, write .md
- Use TaskCreate at session start to track progress through the checklist
