@AGENTS.md

# EDGE — Claude Code Context

## What this app is

EDGE is an AI-powered trading toolkit. It gives traders self-knowledge through a
playbook + journal + AI coach feedback loop that gets more personalised the longer
they use it. The AI assistant is called BULL-E (powered by Claude Sonnet).

Full product spec: `ARCHITECTURE.md` (technical) · `PLAN.MD` (22-prompt build plan) · `PROJECT.md` (rules + stack)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react |
| State | Zustand (`lib/store.ts`) |
| Data fetching | TanStack Query (all client-side fetching) |
| Database + auth | Supabase (Postgres + RLS + Auth + SSR cookies) |
| Caching | Upstash Redis (`@upstash/redis`) |
| Rate limiting | Upstash Ratelimit (`@upstash/ratelimit`, see `lib/rateLimit.ts`) |
| AI / streaming | Vercel AI SDK (`ai`) + Anthropic SDK (`@anthropic-ai/sdk`) |
| Charts | lightweight-charts (candlestick), recharts (analytics) |
| Validation | Zod (all API inputs) |
| Market data | Polygon.io (primary) → Twelve Data (fallback) |
| Institutional data | Unusual Whales (primary) → Tradier (fallback, options only) |
| Backtest / indicators | Python FastAPI service on Railway (`python-service/`) |

---

## Hard rules — never break these

### TypeScript
- Always TypeScript, never JavaScript
- No `any` types — use proper interfaces from `types/`

### Database
- Every Supabase query must respect RLS — users only see their own data
- Server-side elevated queries use `SUPABASE_SERVICE_ROLE_KEY` but still filter by `userId`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser

### API inputs
- All API route inputs validated with Zod before any logic runs

### Data fetching
- All client-side data fetching via TanStack Query hooks in `hooks/`
- Never fetch directly in a component body

### AI responses
- All streaming AI responses via Vercel AI SDK only
- BULL-E context is assembled server-side before every Claude API call (see `ARCHITECTURE.md` §5)

### Environment variables
- Never hardcode API keys, URLs, or secrets — always use env vars
- The Python service URL is always `process.env.PYTHON_SERVICE_URL` — never hardcode `localhost:8000` or any Railway URL

### Indicator math
- All technical indicator calculations (RSI, MACD, EMA, ATR, etc.) happen exclusively
  in the Python service via `POST /indicators` using pandas-ta
- Never install or import a JavaScript indicator library — this is a firm architectural decision
  to ensure live signals and backtests use identical math

### Rate limiting
- `/api/chat` must call `checkChatRateLimit(userId)` from `lib/rateLimit.ts` before any work — limit: 20 req/user/hr
- `/api/signals/[symbol]` must call `checkSignalsRateLimit(userId)` before any work — limit: 60 req/user/hr
- Return 429 with the message from the rate limit result — never swallow it

### UI
- Every component needs a loading skeleton and an error state
- Mobile responsive at 375px on every component
- Every interactive element needs an `aria-label`

---

## Key files to read before starting a feature

| File | What's in it |
|---|---|
| `ARCHITECTURE.md` | Data flow, rate limiting, institutional data, Python API contract, RLS design, auth flow, BULL-E context pipeline |
| `PLAN.MD` | All 22 build prompts in phase order — read the relevant prompt before building |
| `supabase/migrations/001_initial.sql` | Full DB schema — check before writing any query |
| `lib/rateLimit.ts` | Rate limiter — import this in any AI or signal route |
| `lib/store.ts` | Zustand store — sidebar, BULL-E open state, active ticker |
| `lib/supabase/server.ts` | Server-side Supabase client (API routes, Server Components) |
| `lib/supabase/client.ts` | Browser Supabase client (Client Components only) |
| `types/` | Shared TypeScript interfaces — add new ones here, never inline |

---

## Working methodology

- **One feature at a time.** Never build two systems in one prompt.
- **Always read `PLAN.MD` and `ARCHITECTURE.md` before starting a feature.**
- **Test before moving on.** After each phase: write tests for happy path, empty states, error conditions.
- **When something breaks:** paste the full error + full file. Fix only the specific problem — do not rewrite the whole file.
- **Weekly audit (every Friday):** check for hardcoded values, missing error handling, missing loading states, missing RLS, `any` types.

---

## Feature map (phases)

| Phase | Feature | Status |
|---|---|---|
| 0 | Foundation — scaffold, DB schema, auth, app shell | ✅ Done |
| 1 | Market data service + TanStack Query hooks | ⬜ Next |
| 2 | Watchlist page | ⬜ |
| 3 | Institutional data service, candlestick chart, ticker page | ⬜ |
| 4 | Python backtest service (Railway) | ⬜ |
| 5 | Strategy parser + Backtest Lab UI | ⬜ |
| 6 | Signal engine + pattern detector | ⬜ |
| 7 | BULL-E chat + inline commentary | ⬜ |
| 8 | Trade journal | ⬜ |
| 9 | Performance dashboard | ⬜ |
| 10 | Daily brief | ⬜ |
| 11 | Settings + polish | ⬜ |
