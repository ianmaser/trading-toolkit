Phase 0 — Foundation (Day 1)
This is the only phase where you do multiple things at once because they're all infrastructure.
Prompt 1 — Scaffold:

"Read PROJECT.md. Scaffold a Next.js 14 app with the App Router, TypeScript strict mode, Tailwind CSS, and shadcn/ui. Install and configure: @supabase/supabase-js, @supabase/ssr, @tanstack/react-query, ai (Vercel AI SDK), @anthropic-ai/sdk, zod, lightweight-charts, recharts, zustand. Create this folder structure: app/, components/ui/, components/features/, lib/, services/, hooks/, types/, python-service/. Create .env.local with placeholder keys for all services."

Prompt 2 — Database schema:

"Create the full Supabase database schema as a SQL migration file at supabase/migrations/001_initial.sql. Tables needed: profiles (extends auth.users, stores display_name, account_size, language_mode enum plain/technical, created_at), watchlist (id, user_id FK, symbol, added_at), playbooks (id, user_id FK, name, strategy_prompt, strategy_config jsonb, backtest_results jsonb, created_at), backtests (id, user_id FK, playbook_id nullable FK, symbol, timeframe, date_from, date_to, results jsonb, created_at), signals (id, user_id FK, symbol, edge_score, direction, stop_level, target_level, confidence, reasoning jsonb, regime, created_at), journal_trades (id, user_id FK, symbol, playbook_id nullable FK, entry_price, exit_price, size, direction, entry_emotion int 1-5, notes text, outcome enum win/loss/breakeven, created_at), ticker_notes (id, user_id FK, symbol, content text, updated_at). Enable RLS on every table with policies that restrict all operations to the authenticated user's own rows."

Prompt 3 — Auth:

"Set up Supabase authentication. Build: a /login page with email/password and Google OAuth button using shadcn/ui Card and Form components, a /signup page, a middleware.ts at the root that protects all /dashboard routes and redirects unauthenticated users to /login, a useUser hook that returns the current session and profile, and an onAuthStateChange handler that creates a profile row when a new user signs up."

Prompt 4 — App shell:

"Build the main dashboard layout at app/dashboard/layout.tsx. It should have: a fixed left sidebar (64px collapsed, 240px expanded on hover) with navigation icons for: Home/Brief, Watchlist, Backtest Lab, Journal, Performance, Settings. A top bar with the EDGE logo, a global ticker search input, and the user avatar. A main content area. A BULL-E chat button fixed at the bottom right that opens a sliding chat drawer. The sidebar, top bar, and chat drawer should be their own components in components/features/. Use Zustand for the sidebar collapsed/expanded state."

Phase 1 — Market Data Service (Day 2)
Everything depends on this. Get it right before building any UI that needs data.
Prompt 5 — Data service:

"Create services/marketData.ts. It must export these functions: getCandles(symbol, timeframe, from, to) — fetches OHLCV data from Polygon.io, returns typed Candle[]. getQuote(symbol) — fetches latest price, change%, volume. getMultipleQuotes(symbols: string[]) — batch quote fetch for the watchlist. searchTickers(query) — searches for tickers by name or symbol. All functions should: check Upstash Redis cache first (TTL: 60s for quotes, 24h for daily candles, 5min for intraday), fall back to Twelve Data API if Polygon returns an error, throw typed errors that the UI can handle gracefully. Create types/market.ts with interfaces for Candle, Quote, TickerInfo, Timeframe."

Prompt 6 — Data hooks:

"Create TanStack Query hooks for the market data service in hooks/useMarketData.ts. Export: useCandles(symbol, timeframe, from, to), useQuote(symbol), useWatchlistQuotes(symbols), useTickerSearch(query). Each hook should handle loading, error, and refetch-on-window-focus. useWatchlistQuotes should poll every 60 seconds. Add proper TypeScript return types."

Phase 2 — Watchlist (Day 3)
First real user-facing feature. Establishes the component patterns everything else will follow.
Prompt 7 — Watchlist page:

"Build the watchlist page at app/dashboard/watchlist/page.tsx. It should: fetch the user's watchlist from Supabase, use useWatchlistQuotes to get live prices for all tickers, render a responsive grid of <TickerCard> components showing symbol, company name, price, change% (green/red), and volume. Add a search bar at the top that uses useTickerSearch and shows a dropdown of results — clicking one adds the ticker to the watchlist via a Supabase insert. Each card has a remove button and is clickable to navigate to /dashboard/ticker/[symbol]. Add a loading skeleton grid and an empty state with a prompt to add your first ticker."

Phase 3 — Ticker View (Days 4–5)
The core of the app. Build this in three prompts — institutional data service first, then chart, then everything around it.
Prompt 8 — Candlestick chart:

"Build a <CandlestickChart> component at components/features/CandlestickChart.tsx using the lightweight-charts library. It should: render OHLCV candles from a Candle[] prop, support timeframe switching (1D, 4H, 1H, 15M, 5M) via a button group above the chart, auto-resize with a ResizeObserver, accept an annotations prop (array of {type: 'zone'|'line', priceMin, priceMax, timeStart, timeEnd, color, label}) and draw them as price zones or horizontal lines on the chart, expose a scrollToTime(timestamp) method via useImperativeHandle. Dark mode compatible. Loading skeleton while data fetches."

Prompt 8b — Institutional data service:

"Create services/institutionalData.ts. It must export a single function: getInstitutionalData(symbol: string) which returns a typed InstitutionalData object. The function should:

Fetch from the Unusual Whales API (base URL from process.env.UNUSUAL_WHALES_API_KEY) to retrieve: (1) unusual options activity — large block trades and strikes with volume > 3x open interest, filtered to the last 5 trading days, returned as UnusualOptionsFlow[]. (2) short interest — current short interest as % of float and change vs the previous week, returned as ShortInterest. (3) dark pool prints — notable dark pool transactions above $1M notional in the last 5 trading days, returned as DarkPoolPrint[].

If the Unusual Whales API returns an error or the key is not set, fall back to Tradier (process.env.TRADIER_API_KEY) for options flow only — short interest and dark pool fields should return null in this case and the UI should handle gracefully.

Create types/institutional.ts with interfaces for: UnusualOptionsFlow (symbol, expiry, strike, type call/put, volume, openInterest, volumeRatio, premiumUsd, timestamp), ShortInterest (symbol, shortFloat, shortFloatPrevWeek, changeVsPrevWeek, updatedAt), DarkPoolPrint (symbol, price, size, notionalUsd, timestamp, exchange), InstitutionalData (unusualOptions, shortInterest, darkPool).

Add a /api/institutional/[symbol] Next.js route that calls this service, checks Upstash Redis (TTL 15min), and returns the data. Read PYTHON_SERVICE_URL from env — do not hardcode."

Prompt 9 — Full ticker page:

"Build the ticker detail page at app/dashboard/ticker/[symbol]/page.tsx. Compose it from these sections: (1) Top bar — symbol, company name, price, change%, upcoming earnings date if available. (2) <CandlestickChart> taking up ~55% of the page width. (3) Multi-timeframe confluence panel to the right of the chart — show the same ticker on Daily, 4H, and 1H as three small <MiniChart> components, each with a trend indicator (up/down/neutral arrow) and a composite confluence score badge. (4) Signal card below the chart — direction badge, edge score progress bar, stop/target levels, expected move %, confidence %, and reasoning bullets that switch between plain-English and technical language based on the user's language_mode preference. (5) Risk calculator panel — input for shares or dollar risk, auto-calculates the other based on account_size from user profile and the signal's stop level. (6) Pattern sidebar on the right — list of detected patterns with confidence scores, click to scroll chart to that zone. (7) Catalyst strip at the very top — a thin bar consuming data from services/institutionalData.ts via /api/institutional/[symbol]. It should show: unusual options flow badges (bullish/bearish call/put blocks with premium size), short interest % and week-over-week change arrow, dark pool print count and total notional, upcoming earnings date, and a 'Deep Analysis' button that opens BULL-E with the full institutional context pre-loaded. Show a compact skeleton while loading. If institutionalData returns null for a field, show a muted '—' rather than an error. Build the layout and wire up the chart and institutional data. We'll connect signals and patterns in the next phases."

Phase 4 — Python Backtest Service (Days 6–7)
Separate service. Do this entirely in the python-service/ folder.
Prompt 10 — Python service:

"Set up a Python FastAPI service in the python-service/ directory. Create: main.py with a FastAPI app, requirements.txt with: fastapi, uvicorn, pandas, pandas-ta, numpy, twelvedata, pydantic.

Create a POST endpoint at /indicators that accepts: candles (array of OHLCV objects with timestamp, open, high, low, close, volume) and indicators (array of indicator names to calculate, e.g. ['RSI', 'MACD', 'EMA_20', 'EMA_50', 'EMA_200', 'BB_WIDTH', 'ATR', 'VOLUME_RATIO']). The endpoint should: load the candles into a pandas DataFrame, run each requested indicator through pandas-ta, return the most recent calculated values as a flat JSON object (e.g. {rsi: 42.1, macd: 0.34, macd_signal: 0.21, ema_20: 185.4, ...}). This is the single source of truth for all indicator math — both live signals and backtests use this endpoint.

Create a POST endpoint at /backtest that accepts: symbol, timeframe, date_from, date_to, strategy_config (a JSON object with: conditions array, take_profit_r float, stop_loss_r float). The endpoint should: fetch OHLCV data using Twelve Data (primary) with Polygon.io as fallback, calculate all required indicators via the same pandas-ta logic used in /indicators (shared internal function, not a self-call), walk forward through the candles and simulate trades based on the conditions, track each trade (entry candle index, entry price, exit price, outcome, R-multiple), return a JSON result with: total_trades, win_rate, expectancy, profit_factor, max_drawdown, avg_rr, equity_curve (array of cumulative R values), trades (array of individual trade details), regime_breakdown (same stats split by trending/ranging/volatile regime detected via ADX).

Add a GET /health endpoint. Add CORS for localhost and the Vercel domain. Add a railway.toml to python-service/ so it deploys on Railway (start command: uvicorn main:app --host 0.0.0.0 --port $PORT). All Next.js API routes that proxy to this service must read the base URL from process.env.PYTHON_SERVICE_URL — never hardcode it."

Prompt 11 — Strategy parser:

"Create services/strategyParser.ts in the Next.js app. It calls the Claude API with the user's plain-English strategy prompt and returns a structured StrategyConfig JSON object matching the Python service's expected input format. The Claude prompt should extract: conditions (indicator name, comparison operator, value or crossover), take_profit_r, stop_loss_r, entry_type (breakout/pullback/crossover). Also create a StrategyBuilder React component at components/features/StrategyBuilder.tsx — a visual form with dropdowns for indicator, operator, value that produces the same StrategyConfig and syncs bidirectionally with the prompt input. Both inputs should update each other."

Prompt 12 — Backtest Lab page:

"Build the Backtest Lab at app/dashboard/backtest/page.tsx. It has two states: INPUT and RESULTS. Input state: the <StrategyBuilder> component with the prompt input and visual builder side by side, a ticker input, date range picker, and a 'Run Backtest' button. On submit it calls /api/backtest which proxies to the Python service, shows a progress animation. Results state: equity curve (recharts LineChart), a stats grid (win rate, expectancy, profit factor, max drawdown, total trades), a regime breakdown table, a trade log table with each trade's details. A 'Save as Playbook' button opens a modal to name it and save to Supabase. A 'Run on More Tickers' button that batch-runs the same strategy across a list of symbols. Below results, show an AI analysis from BULL-E: 'Here's what these results mean and whether this edge looks real or overfitted' — streamed inline.

"

Phase 5 — Signal Engine (Days 8–9)
Prompt 13 — Signal engine:

"Create services/signalEngine.ts. It should export generateSignal(symbol, candles, userLanguageMode) which:

1. Posts the candle array to the Python service's /indicators endpoint (via process.env.PYTHON_SERVICE_URL) requesting: RSI, MACD, EMA_20, EMA_50, EMA_200, BB_WIDTH, ATR, VOLUME_RATIO. This is the only place indicator math happens — do not calculate indicators in TypeScript.

2. Takes the returned indicator values and scores each factor on a -1 to +1 scale: RSI (<30 = +1, >70 = -1, else scaled), MACD (signal cross direction and magnitude), EMA stack (price vs 20/50/200 alignment), BB width (contraction = ranging, expansion = breakout), ATR (volatility regime), volume ratio (>1.5 = confirmation, <0.8 = weak).

3. Combines scores into a weighted composite edge score 0–100, determines direction (long/short/neutral) and regime (trending/ranging/volatile).

4. Generates stop level (ATR-based below/above recent swing low/high from the candles array), target level (2R from entry by default), expected move % (ATR / current price \* 100).

5. Generates reasoning as two arrays: plainEnglish (e.g. 'RSI is oversold at 28, suggesting buyers may step in') and technical (e.g. 'RSI(14) = 28.3, below oversold threshold').

6. Returns a typed Signal object matching types/market.ts.

Do not install or import any JavaScript indicator library — all indicator math lives in the Python service. Add a /api/signals/[symbol] route that calls generateSignal and saves the result to the Supabase signals table. The route must call checkSignalsRateLimit(userId) from lib/rateLimit.ts before doing any work — if the limit is exceeded, return a 429 with the message from the result. Limit: 60 signal requests per user per hour."

Prompt 14 — Pattern detector: POST-MVP — see TODO/post-mvp.md

Phase 6 — BULL-E (Days 10–11)
Prompt 15 — BULL-E chat:

"Build the BULL-E chat drawer at components/features/BullEChat.tsx. It's a sliding panel that opens from the bottom right. Use the Vercel AI SDK useChat hook connected to /api/chat. Build the /api/chat route using the Anthropic provider with claude-sonnet-4-20250514, streaming enabled, web search tool enabled.

Rate limiting (plan-aware): The /api/chat route must check the user's plan_tier from the profiles table. Call checkChatRateLimit(userId, planTier) from lib/rateLimit.ts before streaming — Starter tier: 5 messages per day; Pro tier: 300 per day (effectively unlimited); Advisor tier: 300 per day with priority queue. If the limit is exceeded, return a 429 JSON response with the message from the result. In BullEChat.tsx, handle the 429 response from useChat's onError callback: when the error message contains the rate limit text, replace the chat input area with a friendly 'BULL-E needs a breather 🐂' state showing the retry-after time and a disabled input. Dismiss automatically when the time elapses.

BULL-E context (MVP): The system prompt assembled server-side before every Claude API call must include: (1) currently viewed ticker, its latest signal; (2) user's language_mode preference, account_size, and trader_assessment responses from onboarding; (3) last 5 journal trades with outcomes, emotion scores, and mistake types; (4) best performing playbook stats and active playbook rules; (5) user's last post-session reflection and key lesson. This gives BULL-E enough context to coach specifically — not generically. Thesis-aware context (macro/sector/position theses) is a post-MVP addition that activates when the Living Macro Thesis UI ships.

Language adaptation: The system prompt adapts based on language_mode — plain English or technical. Show a typing indicator during streaming. Persist chat history in localStorage per ticker session. Add a 'Clear chat' button.

BULL-E coaching style: The system prompt must instruct BULL-E to lead with a focused question before dispensing observations. When a user mentions a trade, a bad session, or an emotional state, BULL-E's first response must be a reflective follow-up question ('What was the first trade that felt off today?' / 'What were you thinking when you sized up on that position?' / 'Was this in your playbook or a deviation?') before offering analysis. This 'mirror and mentor' approach — reflecting the trader's own patterns back through questions — builds a coaching relationship rather than a one-way advice engine. The system prompt should include explicit non-judgmental framing: BULL-E never criticises, only asks and observes. Add a visible tag line in the chat drawer UI directly below the BULL-E header in muted caption style: 'Remembers your last 30 trades, your playbook rules, and your onboarding profile' — making the personalization advantage explicit to the user."

Prompt 16 — Inline AI commentary: POST-MVP — see TODO/post-mvp.md

Phase 7 — Trade Journal (Days 12–13)
Prompt 17 — Journal entry:

"Build the trade journal at app/dashboard/journal/page.tsx. It should: show a list of past journal entries sorted by date, each showing symbol, direction, outcome badge (win/loss/breakeven), R-multiple achieved, and which playbook was used. A 'Log Trade' button opens a modal with: symbol input, direction toggle, entry/exit price inputs (R-multiple auto-calculated), size input, playbook selector (from user's saved playbooks), emotion/confidence slider 1-5 with emoji labels (😰 to 😎), and a notes textarea. On save, insert to journal_trades table. Add a paper trading toggle — when active, trades are flagged as simulated and shown with a 'Paper' badge.

Competitive additions (MVP):

(1) Pre-trade checklist — each playbook can define a checklist of entry conditions (e.g. 'Price above VWAP', 'Volume confirming', 'Setup matches daily bias'). When logging a trade linked to a playbook, show those checklist items as checkboxes. Store adherence_score (checked / total) on the journal_trades row. This feeds BULL-E's coaching report to identify rule-breaking patterns.

(2) Mistake type — an optional dropdown in the modal: 'No mistake', 'Entry too early', 'Entry too late', 'Exited too early', 'Exited too late', 'Wrong position size', 'No edge — broke playbook'. Store as mistake_type text on journal_trades.

Add these columns to journal_trades via a new migration (supabase/migrations/002_journal_additions.sql): adherence_score numeric, mistake_type text. Also create in this migration: daily_journal table (id, user_id, date date, morning_plan_id uuid nullable FK to daily_plans, reflection text, key_lesson text, created_at, updated_at) with RLS; daily_plans table (user_id, date date, max_loss numeric, max_trades integer, setups_text text, rules_json jsonb, created_at) with RLS. Note: MAE/MFE fields and PropFirm Sync are post-MVP — see TODO/post-mvp.md.

Post-Session Journal: Add an 'End of Day' section to the journal page below the trade log. Two fields: (1) 'What happened today' — free-form reflection textarea; (2) 'Key lesson' — constrained to 140 characters (forces distillation: 'I need to stop averaging into losing positions'). Link to the day's morning game plan so the user sees what they planned vs what they did. Show a 'Reflection not written yet' empty state with a prompt. BULL-E's coaching report reads both the morning plan and evening reflection, completing the full loop: game plan → trade → reflection → coaching."

Prompt 17b — Trade Replay: POST-MVP — see TODO/post-mvp.md

Prompt 18 — AI coaching analysis:

"Create a weekly coaching analysis feature. Build /api/coaching-report that: fetches the user's last 30 journal trades from Supabase (including adherence_score and mistake_type fields), fetches their playbook stats, fetches the last 7 daily_plans rows, fetches the last 7 daily_journal rows (post-session reflections and key lessons), calls the Claude API (non-streaming, full analysis) with all the data and a system prompt that instructs Claude to act as a trading coach and find behavioral patterns — specifically look for: day-of-week performance patterns, emotion score correlation with outcome, system adherence rate (trades that matched a playbook vs impulsive trades), most common mistake types and their R cost, game plan adherence (did actual trades match the pre-session plan), patterns between evening reflections and next-day performance. Return structured JSON with findings and actionable recommendations. Build a <CoachingReport> component on the Performance page that displays this as a readable report with BULL-E's name on it. Cache the report for 24 hours."

Phase 8 — Performance Dashboard (Day 14)
Prompt 19 — Performance page:

"Build the Performance dashboard at app/dashboard/performance/page.tsx. Sections: (1) Header stats row — total trades, overall win rate, average R-multiple, system adherence %. (2) Equity curve — recharts LineChart of cumulative R over time, with a benchmark line showing what the backtest predicted. (3) Playbook breakdown table — for each saved playbook: trades taken, win rate, avg R, vs backtest expectation, trend arrow. (4) Behavioral insights panel — render the <CoachingReport> component with BULL-E's weekly analysis. (5) Calendar heatmap — show P&L by day of week and time of day as a grid heatmap using recharts. All data from Supabase, filtered by date range selector (1W / 1M / 3M / All).

Note: P&L calendar, mistake breakdown panel, MAE/MFE exit quality panel, and Trader Health Score are POST-MVP — see TODO/post-mvp.md."

Phase 9 — Daily Brief (Day 15)
Prompt 20 — Daily brief:

"Build the home page at app/dashboard/page.tsx — the Daily Brief. It should: (1) Generate once per day (cached in Redis with a date key) by calling Claude with web search enabled, instructed to: assess the current market regime based on SPY/QQQ/VIX data, identify which strategy types have edge in the current regime, and write a 3-paragraph analyst-style morning note. Display this with BULL-E's avatar and name. (2) Below the brief, show the user's watchlist ranked by edge score — highest edge signals at the top with their direction and confidence. (3) Show a 'Your system is a match for today's regime' or 'Caution: today's regime conflicts with your primary playbook' banner based on comparing the detected regime against the user's top playbook. (4) Show the user's 3 most recent journal entries and the coaching insight of the week.

Competitive addition (informed by TraderSync gap analysis):

(5) Pre-session game plan — below the daily brief, show a collapsible 'Today's Game Plan' section. It has: a max loss input (pre-filled from user profile if set), a max trades input, a 'Setups I'm watching' free-text area, and a 'Rules I'm committing to today' checklist (pre-populated from the user's active playbook's entry checklist). On save, store the game plan in a daily_plans table (user_id, date, max_loss, max_trades, setups_text, rules_json). The coaching report will later compare actual trades against the game plan to detect discipline patterns. This differentiates EDGE from every competitor — no trading journal currently offers pre-session structured planning tied directly to your playbook rules."

Phase 10 — Living Macro Thesis DB Schema (Day 16)
The Living Macro Thesis is the most defensible long-term differentiator. The UI is post-MVP (see TODO/post-mvp.md), but the DB tables ship at MVP launch so thesis data starts compounding from day one. BULL-E thesis-aware context activates when the UI ships.

Prompt 23 — Living Macro Thesis DB migration only:

"Create supabase/migrations/002_living_thesis.sql. This migration creates the thesis schema and adds plan_tier support — no UI is built in this phase.

CREATE TABLE macro_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  regime text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE sector_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  macro_thesis_id uuid REFERENCES macro_theses NOT NULL,
  sector text NOT NULL,
  direction text,
  content text NOT NULL,
  flagged_for_review boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE position_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  sector_thesis_id uuid REFERENCES sector_theses,
  journal_trade_id uuid REFERENCES journal_trades,
  symbol text NOT NULL,
  content text NOT NULL,
  flagged_for_review boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

Enable RLS on all three tables restricting all operations to auth.uid() = user_id.

Also add via this migration:
- thesis_context text column to journal_trades (free-text note linking a trade to the macro thesis at log time — shown as an optional field in the journal modal)
- plan_tier text column to profiles with check constraint ('starter', 'pro', 'advisor'), default 'starter'

Apply the migration. Confirm all 3 tables appear in Supabase Table Editor with RLS enabled. No page, no hooks, no UI — data layer only."

Phase 11 — Polish + Settings (Day 17)
Prompt 21 — Settings:


"Build the settings page at app/dashboard/settings/page.tsx. Sections:

(1) Account — display name, email, change password.
(2) Trading Preferences — account size input that updates profile, language mode toggle plain/technical that updates profile and immediately affects all BULL-E responses and signal cards.
(3) Appearance — light/dark mode toggle.
(4) Plan & Billing — show the user's current plan_tier from profiles (Starter / Pro / Advisor) with a tier badge. Below the badge show the key limits for their tier in a clear table: journal trades per month (30 for Starter, unlimited for Pro/Advisor), BULL-E messages per day (5 for Starter, 300 for Pro/Advisor), watchlist size (5 tickers for Starter, unlimited for Pro/Advisor), Living Thesis access (locked for Starter, full for Pro/Advisor), Backtest Lab access (locked for Starter, full for Pro/Advisor). If the user is on Starter, show a prominent 'Upgrade to Pro — $39/mo' button that links to process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL (never hardcode). If on Pro, show 'Upgrade to Advisor — $99/mo' with process.env.NEXT_PUBLIC_STRIPE_ADVISOR_URL. Note: plan_tier can be set manually in Supabase for development and testing; Stripe webhook integration is a post-launch task.

All form saves with optimistic updates and toast confirmations using shadcn/ui Toast."

Prompt 22 — Final polish:

"Audit every page in the app. For each page and major component: add a loading skeleton using shadcn/ui Skeleton that matches the layout of the loaded state, add an error boundary with a retry button, add empty states with helpful context-aware prompts (e.g. empty watchlist says 'Add your first ticker to get signals and start tracking your edge'), ensure every interactive element has an aria-label, test and fix all mobile layouts at 375px width. Run through the full user journey: signup → add ticker → run backtest → save playbook → log a trade → view performance → read daily brief. Fix any broken handoffs.

Competitive addition (informed by AITradingCoach analysis — ships before their planned v2 Trader Assessment Module):

Trader Assessment onboarding: On first login after account creation, check profiles.has_completed_onboarding (boolean, default false). If false, intercept the dashboard and render a full-screen onboarding assessment before the main UI loads. Five steps with large visual card-style answer selections (not dropdowns — one choice per step, full-screen focus):

Step 1 — Trading style: Day trader / Swing trader / Position trader / Still figuring it out
Step 2 — Primary asset class: Stocks / Options / Futures / Forex / Crypto
Step 3 — Experience level: New (under 1 year) / Learning (1–3 years) / Experienced (3+ years) / Professional
Step 4 — Biggest self-identified weakness: FOMO entries / Exiting too early / Revenge trading / Position sizing / Sticking to my plan / No clear edge yet
Step 5 — Primary goal: Build consistency / Pass a prop firm challenge / Grow a live account / Deeply understand my edge

On completion: save all responses as a trader_assessment jsonb column on profiles, set has_completed_onboarding=true, then load the dashboard. The first thing shown on the dashboard is a personalized BULL-E welcome: 'Hey — based on what you told me, your biggest focus should be [weakness]. Here's where we'll start.' BULL-E's system prompt always includes the trader_assessment object so every coaching session is personalized from day one, even before any trades are logged.

Add has_completed_onboarding boolean (default false) and trader_assessment jsonb (nullable) to the profiles table via a migration in this phase."

The Order of Operations Summary
The sequence in one line each (MVP scope):

Foundation + auth + DB schema — nothing works without this
Market data service + hooks — feeds every feature
Watchlist — first real UI, establishes component patterns
Ticker page shell + chart — the app's center of gravity
Python backtest service — isolated, testable, no UI dependencies
Strategy parser + Backtest Lab UI — connects Python service to frontend
Signal engine — connects to ticker page (pattern detector is post-MVP)
BULL-E chat — wraps all features with AI layer (inline commentary is post-MVP)
Trade journal + post-session journal — needs signals and playbooks to exist first (trade replay is post-MVP)
Performance dashboard — needs journal data to exist first
Daily brief — needs everything to exist first
Living Macro Thesis DB migration — tables deploy now so data compounds; UI is post-MVP
Settings + polish + Trader Assessment onboarding — last, always last

One Final Rule
Every Friday, before you stop for the week, give Claude Code this prompt:

"Review all the files we've built this week. Look for: any hardcoded values that should be env vars, any missing error handling, any component that's missing a loading state, any Supabase query missing RLS, any TypeScript any types. List everything you find and fix them one by one."

That weekly audit keeps the codebase clean as it grows and prevents the kind of technical debt that kills projects in month two.

---

Stack: Next.js 14 App Router, TypeScript strict mode, Tailwind,
shadcn/ui, Supabase, Upstash Redis, lightweight-charts, Vercel AI SDK

Rules:

- Always use TypeScript, never JavaScript
- All DB queries must use Supabase with RLS — users only see their own data
- All API inputs validated with Zod
- All data fetching with TanStack Query
- Streaming AI responses via Vercel AI SDK only
- Never hardcode API keys, always use env vars
- Mobile responsive on every component
- Every component gets a loading skeleton and error state
