# EDGE — Technical Architecture

---

## 1. Market Data Flow

```
Browser (TanStack Query hook)
  │
  │  HTTP GET /api/market/candles?symbol=NVDA&timeframe=1D
  ▼
Next.js API Route (/api/market/*)
  │
  ├─► Upstash Redis (check cache)
  │     HIT  ──────────────────────────────────────► return cached data
  │     MISS ──┐
  │            ▼
  │       Polygon.io REST API
  │            │ success ───────────────────────────► store in Redis → return
  │            │ error (rate limit / outage)
  │            ▼
  │       Twelve Data REST API (fallback)
  │            │ success ───────────────────────────► store in Redis → return
  │            │ error
  │            ▼
  │       throw MarketDataError (UI handles gracefully)
  │
  ▼
TanStack Query (client cache + deduplication)
  │
  ▼
React Component (renders data, loading skeleton, or error state)
```

### Cache TTLs

| Data type          | TTL   | Key pattern                           |
| ------------------ | ----- | ------------------------------------- |
| Quote (price/vol)  | 60s   | `quote:{symbol}`                      |
| Intraday candles   | 5min  | `candles:{symbol}:{timeframe}:{date}` |
| Daily candles      | 24h   | `candles:{symbol}:1D:{date}`          |
| Ticker search      | 24h   | `search:{query}`                      |
| Institutional data | 15min | `institutional:{symbol}`              |
| Daily brief        | 24h   | `brief:{YYYY-MM-DD}`                  |
| Coaching report    | 24h   | `coaching:{userId}:{YYYY-MM-DD}`      |

### API Route → Service Map

| Route                         | Calls                               | Cache |
| ----------------------------- | ----------------------------------- | ----- |
| `/api/market/candles`         | Polygon → Twelve Data               | yes   |
| `/api/market/quote`           | Polygon → Twelve Data               | yes   |
| `/api/market/search`          | Polygon → Twelve Data               | yes   |
| `/api/institutional/[symbol]` | Unusual Whales → Tradier (fallback) | yes   |
| `/api/signals/[symbol]`       | Python `/indicators` → score        | no    |
| `/api/backtest`               | Python `/backtest`                  | no    |
| `/api/chat`                   | Anthropic (streaming)               | no    |
| `/api/coaching-report`        | Anthropic (non-streaming)           | yes   |

---

## 2. Rate Limiting

All AI and signal routes are rate-limited per authenticated user via `lib/rateLimit.ts` using `@upstash/ratelimit` with a sliding window algorithm backed by Upstash Redis.

| Route                   | Limit             | Redis prefix | 429 message                                                                                               |
| ----------------------- | ----------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `/api/chat`             | 20 req / user / h | `rl:chat`    | "You've reached your limit of 20 AI requests per hour. BULL-E needs a breather — try again in X minutes." |
| `/api/signals/[symbol]` | 60 req / user / h | `rl:signals` | "You've reached your limit of 60 signal requests per hour. Try again in X minutes."                       |

### Implementation pattern

Every rate-limited route follows this pattern before doing any work:

```ts
const { userId } = await getAuthenticatedUser(request); // throws 401 if no session

const limit = await checkChatRateLimit(userId); // or checkSignalsRateLimit
if (!limit.allowed) {
  return Response.json({ error: limit.message }, { status: 429 });
}

// ... proceed with actual route logic
```

### UI behaviour on 429

`BullEChat.tsx` — when `useChat`'s `onError` receives a 429, the input area is replaced with a "BULL-E needs a breather 🐂" state showing the retry-after countdown. The input re-enables automatically when the timer reaches zero. No toast — the state change is in-place and obvious.

Signal pages — a 429 from `/api/signals/[symbol]` surfaces as an inline error card in place of the signal card, with the retry time displayed. No full-page error.

---

## 3. Institutional Data Service

`services/institutionalData.ts` — consumed by `/api/institutional/[symbol]` and the catalyst strip component.

### Provider chain

```
getInstitutionalData(symbol)
  │
  ├─► Redis cache (TTL 15min) — HIT → return
  │
  └─► Unusual Whales API (UNUSUAL_WHALES_API_KEY)
        │  success → cache → return InstitutionalData
        │  error / key not set
        └─► Tradier API (TRADIER_API_KEY) — options flow only
              │  success → cache → return InstitutionalData (shortInterest: null, darkPool: null)
              │  error
              └─► return InstitutionalData with all fields null (UI shows '—')
```

### Return shape (`types/institutional.ts`)

```ts
interface UnusualOptionsFlow {
  symbol: string;
  expiry: string; // 'YYYY-MM-DD'
  strike: number;
  type: "call" | "put";
  volume: number;
  openInterest: number;
  volumeRatio: number; // volume / openInterest
  premiumUsd: number; // total premium in dollars
  timestamp: string; // ISO 8601
}

interface ShortInterest {
  symbol: string;
  shortFloat: number; // e.g. 0.042 = 4.2%
  shortFloatPrevWeek: number;
  changeVsPrevWeek: number; // signed delta
  updatedAt: string;
}

interface DarkPoolPrint {
  symbol: string;
  price: number;
  size: number; // shares
  notionalUsd: number;
  timestamp: string;
  exchange: string;
}

interface InstitutionalData {
  unusualOptions: UnusualOptionsFlow[] | null;
  shortInterest: ShortInterest | null;
  darkPool: DarkPoolPrint[] | null;
}
```

### Catalyst strip rendering rules

| Field             | Data present                                                           | Data null / empty |
| ----------------- | ---------------------------------------------------------------------- | ----------------- |
| Options flow      | Bullish/bearish badges with premium $                                  | Muted `—`         |
| Short interest    | % float + △ vs last week arrow                                         | Muted `—`         |
| Dark pool         | Print count + total notional                                           | Muted `—`         |
| Earnings date     | Date chip (from Polygon)                                               | Hidden            |
| Deep Analysis btn | Always shown — opens BULL-E with full institutional context pre-loaded |

---

## 3. Python Service API Contract

Base URL: `process.env.PYTHON_SERVICE_URL` (Railway in prod, `http://localhost:8000` in dev).

All requests/responses are `application/json`. All errors return `{ detail: string }`.

---

### GET /health

**Response**

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

### POST /indicators

Single source of truth for all indicator math. Used by the live signal engine.
Both this endpoint and `/backtest` share the same internal pandas-ta calculation function — no indicator is ever computed twice in different ways.

**Request**

```json
{
  "candles": [
    {
      "timestamp": 1700000000,
      "open": 184.5,
      "high": 186.2,
      "low": 183.1,
      "close": 185.8,
      "volume": 42000000
    }
  ],
  "indicators": [
    "RSI",
    "MACD",
    "EMA_20",
    "EMA_50",
    "EMA_200",
    "BB_WIDTH",
    "ATR",
    "VOLUME_RATIO"
  ]
}
```

**Response**

```json
{
  "rsi": 42.1,
  "macd": 0.34,
  "macd_signal": 0.21,
  "macd_hist": 0.13,
  "ema_20": 185.4,
  "ema_50": 182.1,
  "ema_200": 175.6,
  "bb_width": 0.048,
  "atr": 3.82,
  "volume_ratio": 1.34
}
```

**Supported indicator names**

| Name           | pandas-ta call        | Returns                               |
| -------------- | --------------------- | ------------------------------------- |
| `RSI`          | `ta.rsi(close, 14)`   | `rsi`                                 |
| `MACD`         | `ta.macd(close)`      | `macd`, `macd_signal`, `macd_hist`    |
| `EMA_20`       | `ta.ema(close, 20)`   | `ema_20`                              |
| `EMA_50`       | `ta.ema(close, 50)`   | `ema_50`                              |
| `EMA_200`      | `ta.ema(close, 200)`  | `ema_200`                             |
| `BB_WIDTH`     | `ta.bbands(close)`    | `bb_width` (upper-lower / middle)     |
| `ATR`          | `ta.atr(h, l, c, 14)` | `atr`                                 |
| `VOLUME_RATIO` | computed              | `volume_ratio` (vol / 20-day avg vol) |
| `ADX`          | `ta.adx(h, l, c, 14)` | `adx`, `dmp`, `dmn`                   |

---

### POST /backtest

**Request**

```json
{
  "symbol": "NVDA",
  "timeframe": "1D",
  "date_from": "2023-01-01",
  "date_to": "2024-01-01",
  "strategy_config": {
    "conditions": [
      { "indicator": "RSI", "operator": "<", "value": 35 },
      { "indicator": "MACD", "operator": "crossover", "value": "signal" }
    ],
    "take_profit_r": 2.0,
    "stop_loss_r": 1.0,
    "entry_type": "pullback"
  }
}
```

**Response**

```json
{
  "total_trades": 24,
  "win_rate": 0.625,
  "expectancy": 0.87,
  "profit_factor": 2.14,
  "max_drawdown": -0.12,
  "avg_rr": 1.74,
  "equity_curve": [0, 0.5, 1.2, 0.8, 2.1],
  "trades": [
    {
      "entry_index": 42,
      "entry_price": 184.5,
      "exit_price": 192.1,
      "outcome": "win",
      "r_multiple": 2.0
    }
  ],
  "regime_breakdown": {
    "trending": { "trades": 14, "win_rate": 0.71, "expectancy": 1.12 },
    "ranging": { "trades": 7, "win_rate": 0.57, "expectancy": 0.54 },
    "volatile": { "trades": 3, "win_rate": 0.33, "expectancy": -0.21 }
  }
}
```

---

## 3. Supabase RLS Policy Design

RLS is enabled on every table. The single governing principle:
**A user can only read and write their own rows.** No exceptions, no shared data, no admin bypass in client-facing queries.

### Policy summary

| Table            | SELECT | INSERT | UPDATE | DELETE | Policy condition       |
| ---------------- | ------ | ------ | ------ | ------ | ---------------------- |
| `profiles`       | ✓      | ✓      | ✓      | —      | `auth.uid() = id`      |
| `watchlist`      | ✓      | ✓      | —      | ✓      | `auth.uid() = user_id` |
| `playbooks`      | ✓      | ✓      | ✓      | ✓      | `auth.uid() = user_id` |
| `backtests`      | ✓      | ✓      | —      | ✓      | `auth.uid() = user_id` |
| `signals`        | ✓      | ✓      | —      | —      | `auth.uid() = user_id` |
| `journal_trades` | ✓      | ✓      | ✓      | ✓      | `auth.uid() = user_id` |
| `ticker_notes`   | ✓      | ✓      | ✓      | ✓      | `auth.uid() = user_id` |

### Server-side queries (API routes)

API routes that need elevated access (e.g. the coaching report aggregating a user's data server-side) use the `SUPABASE_SERVICE_ROLE_KEY` via a server-only Supabase client. This key is never exposed to the browser. All such routes still filter by the authenticated user's ID derived from their session — service role bypasses RLS but the code enforces the same restriction manually.

---

## 4. Auth Flow

```
User visits /dashboard/*
      │
      ▼
middleware.ts intercepts request
      │
      ├─► createServerClient (reads session from cookies)
      │         │
      │         ▼
      │   supabase.auth.getUser()
      │         │
      │    no session ──────────────────────► redirect to /login
      │    valid session ───────────────────► NextResponse.next()
      │
      ▼
/login page (email/password or Google OAuth)
      │
      ├─► supabase.auth.signInWithPassword()
      │         │ success
      │         ▼
      │   Supabase sets session cookies (@supabase/ssr)
      │         │
      │         ▼
      │   redirect to /dashboard
      │
      └─► supabase.auth.signInWithOAuth({ provider: 'google' })
                │
                ▼
          Google consent screen → callback to /auth/callback
                │
                ▼
          /app/auth/callback/route.ts exchanges code for session
                │
                ▼
          redirect to /dashboard

New user signup flow:
      │
      ▼
supabase.auth.signUp()
      │
      ▼
Supabase Auth creates auth.users row
      │
      ▼
DB trigger: on_auth_user_created fires
      │
      ▼
profiles row auto-created (display_name from email prefix or OAuth full_name)
      │
      ▼
redirect to /dashboard (profile exists, app is ready)
```

### Session handling rules

- **Server Components / API routes** — always use `lib/supabase/server.ts` (`createServerClient` with cookie store). Never use the browser client on the server.
- **Client Components** — use `lib/supabase/client.ts` (`createBrowserClient`). Session is automatically refreshed by `@supabase/ssr`.
- **useUser hook** — wraps `supabase.auth.getUser()` on the client, returns `{ user, profile, isLoading }`. Profile is fetched from the `profiles` table after user resolves.

---

## 5. BULL-E Context Injection Pipeline

Every Claude API call is preceded by a context assembly step. The system prompt is built dynamically on each request — BULL-E always has a current, accurate picture of the user's situation.

```
/api/chat  (POST — streaming via Vercel AI SDK)
      │
      ▼
assembleContext(userId, symbol?)
      │
      ├─ Supabase: profiles WHERE id = userId
      │     → language_mode, account_size
      │
      ├─ Supabase: signals WHERE user_id = userId AND symbol = symbol
      │   ORDER BY created_at DESC LIMIT 1
      │     → edge_score, direction, stop_level, target_level, reasoning
      │
      ├─ in-memory / request: patternDetector output (passed from client)
      │     → detected patterns with confidence scores
      │
      ├─ Supabase: journal_trades WHERE user_id = userId
      │   ORDER BY created_at DESC LIMIT 5
      │     → symbol, outcome, r_multiple, playbook_id, entry_emotion
      │
      ├─ Supabase: playbooks WHERE user_id = userId
      │   ORDER BY win_rate DESC LIMIT 1  (best performing)
      │     → name, strategy_config, backtest win_rate, expectancy
      │
      └─ Redis: brief:{today}  (current market regime from daily brief)
            → regime (trending/ranging/volatile), regime summary
```

**Assembled system prompt structure**

```
You are BULL-E, a professional trading analyst and coach built into the EDGE platform.

## User context
- Language mode: {plain | technical}
- Account size: ${account_size}
- Current ticker: {symbol} ({company_name})

## Current signal ({symbol})
- Direction: {long | short | neutral}
- Edge score: {0–100}
- Stop: ${stop_level} | Target: ${target_level}
- Reasoning: {reasoning bullets}

## Detected patterns
{pattern list with confidence scores}

## Market regime (today)
{regime} — {regime_summary}

## Recent journal (last 5 trades)
{trade list: symbol, outcome, R-multiple, emotion score}

## Best performing playbook
"{playbook_name}" — {win_rate}% win rate, {expectancy}R expectancy

## Instructions
Respond in {plain English | technical} language.
Use web search when asked about news, earnings, or analyst sentiment.
Be direct. Never pad responses. Prioritize actionable insight.
```

### Inline commentary calls (non-chat)

Non-streaming one-shot calls (pattern tooltips, signal summaries, backtest explanations) use a slimmer context — only the data directly relevant to that component is injected. They share the same `/api/chat` route but pass `stream: false` and a scoped `contextScope` parameter that limits which context buckets are assembled.

| Call site                       | Context injected                                  |
| ------------------------------- | ------------------------------------------------- |
| Signal card "Summarize Setup"   | signal + patterns + regime                        |
| Backtest "Explain Results"      | backtest results + playbook config                |
| Pattern tooltip "What is this?" | single pattern object only                        |
| Coaching report                 | last 30 trades + all playbook stats (no ticker)   |
| Daily brief                     | SPY/QQQ/VIX data + user's top playbook regime fit |
