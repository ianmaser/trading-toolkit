# Session — 04-15-2026 — Initial Setup & Phase 0

## Who worked on this
Ian

## What was built

### Architecture & Planning
- `ARCHITECTURE.md` — full technical architecture document covering: market data flow +
  cache TTLs, rate limiting design, institutional data service (Unusual Whales / Tradier),
  Python service API contract (all endpoints + request/response shapes), Supabase RLS policy
  table, auth flow diagram, BULL-E context injection pipeline
- `PLAN.MD` — updated throughout the session with all architectural decisions locked in:
  Twelve Data as fallback (replacing yfinance), Railway deployment for Python service,
  /indicators endpoint architecture, revised signal engine (Python-only indicator math),
  Prompt 8b added (institutionalData service), rate limiting spec added to Prompts 13 + 15
- `TODO/revisit-later.md` — all 5 pre-build concerns raised and resolved:
  1. yfinance → Twelve Data ✅
  2. Python service → Railway ✅
  3. Dual indicator libraries → Python-only (pandas-ta) ✅
  4. No architecture doc → ARCHITECTURE.md written ✅
  5. Unusual Whales not in plan → Prompt 8b added ✅
- `CLAUDE.md` — fully rewritten with correct Next.js version (16), full stack table,
  all hard rules, key file reference table, working methodology, phase status map
- `standard-developer-procedures.md` — beginner-friendly developer onboarding guide
  covering Git setup, session start/end rituals, how to use Claude Code, commit procedures,
  code quality checklist, weekly audit, troubleshooting
- `sessions/` folder created for session handoff notes

### Phase 0 — Foundation (all 4 prompts complete ✅)

**Prompt 1 — Scaffold**
- Next.js 16 App Router, TypeScript strict, Tailwind v4, ESLint
- All packages installed: `@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query`,
  `ai`, `@anthropic-ai/sdk`, `zod`, `lightweight-charts`, `recharts`, `zustand`,
  `@upstash/ratelimit`, `@upstash/redis`, `lucide-react`, `react-hook-form`,
  `@hookform/resolvers`
- shadcn/ui initialised with 15 components: button, card, form, input, label, sonner,
  skeleton, badge, progress, tabs, dialog, drawer, avatar, separator, select, textarea, table
- Folder structure created: `app/`, `components/ui/`, `components/features/`, `lib/`,
  `services/`, `hooks/`, `types/`, `python-service/`, `supabase/migrations/`
- `.env.local` created with all placeholder keys

**Prompt 2 — Database schema**
- `supabase/migrations/001_initial.sql` — 7 tables with full RLS:
  `profiles`, `watchlist`, `playbooks`, `backtests`, `signals`, `journal_trades`, `ticker_notes`
- All tables have RLS enabled, indexes created, auto-create profile trigger on signup

**Prompt 3 — Auth**
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server-side Supabase client (API routes + Server Components)
- `middleware.ts` — protects all `/dashboard` routes, redirects auth users away from login/signup
- `app/auth/callback/route.ts` — OAuth code exchange handler
- `hooks/useUser.ts` — returns `{ user, profile, isLoading }`, syncs on auth state changes
- `app/login/page.tsx` — email/password + Google OAuth, error states
- `app/signup/page.tsx` — registration + Google, email confirmation state

**Prompt 4 — App shell**
- `lib/store.ts` — Zustand store: `sidebarExpanded`, `bullEOpen`, `activeTicker`
- `components/features/Sidebar.tsx` — fixed left sidebar, 64px collapsed / 240px on hover,
  active route highlighting, all 6 nav items with icons
- `components/features/TopBar.tsx` — fixed top bar, global ticker search, user avatar
- `components/features/BullEChat.tsx` — FAB button + sliding drawer shell (stubbed for Phase 6)
- `app/dashboard/layout.tsx` — composes sidebar, top bar, main content, BULL-E chat
- `app/dashboard/page.tsx` — placeholder for Daily Brief (Phase 9)

### Cross-cutting utilities
- `lib/rateLimit.ts` — Upstash sliding window rate limiter:
  `checkChatRateLimit()` (20/hr), `checkSignalsRateLimit()` (60/hr)
- `python-service/railway.toml` — Railway deployment config stub for Phase 4

## What is NOT finished yet
- Nothing from today is incomplete — Phase 0 is fully done
- The Next.js version question (14 vs 16) was noted but not formally resolved — we are
  running 16.2.3 (installed by create-next-app) and have proceeded with it

## Left off at
- Phase 0 complete ✅
- **Next session starts at Phase 1, Prompt 5 — Market Data Service**
- Read `PLAN.MD` Prompt 5 before starting
- Task: create `services/marketData.ts` with `getCandles`, `getQuote`, `getMultipleQuotes`,
  `searchTickers` — Polygon primary, Twelve Data fallback, Upstash Redis caching

## Decisions made
- **Twelve Data** replaces yfinance as the market data fallback provider
- **Railway** is the deployment target for the Python FastAPI service
- **All indicator math lives in Python** (pandas-ta via `/indicators` endpoint) —
  no JS indicator library will ever be used
- **`PYTHON_SERVICE_URL` env var** is the only way to reference the Python service URL
- **Unusual Whales → Tradier fallback** for institutional data (options flow, dark pool, short interest)
- **Rate limits**: 20 AI requests/user/hr, 60 signal requests/user/hr via Upstash
- **Next.js 16.2.3** — proceeded with latest version from create-next-app rather than pinning to 14

## Open questions
- Next.js version: the plan specified 14 but we got 16. The hook validator flagged that
  `middleware.ts` may need to be renamed to `proxy.ts` in Next.js 16. This has not been
  investigated or resolved yet — worth confirming before Phase 3 when middleware gets heavier use.
