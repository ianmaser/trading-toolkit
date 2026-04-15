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

"Build the Backtest Lab at app/dashboard/backtest/page.tsx. It has two states: INPUT and RESULTS. Input state: the <StrategyBuilder> component with the prompt input and visual builder side by side, a ticker input, date range picker, and a 'Run Backtest' button. On submit it calls /api/backtest which proxies to the Python service, shows a progress animation. Results state: equity curve (recharts LineChart), a stats grid (win rate, expectancy, profit factor, max drawdown, total trades), a regime breakdown table, a trade log table with each trade's details. A 'Save as Playbook' button opens a modal to name it and save to Supabase. A 'Run on More Tickers' button that batch-runs the same strategy across a list of symbols. Below results, show an AI analysis from BULL-E: 'Here's what these results mean and whether this edge looks real or overfitted' — streamed inline."

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

Prompt 14 — Pattern detector:

"Create services/patternDetector.ts. Implement detection for: head and shoulders (and inverse), double top and bottom, bull and bear flags, rising and falling wedges. Each detector takes a Candle[] array and returns PatternMatch[] with: patternType, confidence 0-1, keyPoints (candle indices of the key structural points), zone (priceMin, priceMax, timeStart, timeEnd), plainEnglishDescription, technicalDescription. Only return matches above 0.65 confidence. Connect this to the ticker page — pass the matches as annotations to the CandlestickChart and populate the pattern sidebar. Add click handlers that call scrollToTime on the chart ref."

Phase 6 — BULL-E (Days 10–11)
Prompt 15 — BULL-E chat:

"Build the BULL-E chat drawer at components/features/BullEChat.tsx. It's a sliding panel that opens from the bottom right. Use the Vercel AI SDK useChat hook connected to /api/chat. Build the /api/chat route using the Anthropic provider with claude-sonnet-4-20250514, streaming enabled, web search tool enabled. The /api/chat route must call checkChatRateLimit(userId) from lib/rateLimit.ts before streaming — if the limit is exceeded, return a 429 JSON response with the message from the result. Limit: 20 AI requests per user per hour. The system prompt should: position BULL-E as a professional trading analyst and coach, inject the user's current context on every request (currently viewed ticker, its latest signal, detected patterns, user's language_mode preference, their account_size, their last 5 journal trades, their best performing playbook stats). The system prompt should adapt language based on language_mode — plain English or technical. Show a typing indicator during streaming. Persist chat history in localStorage per ticker session. Add a 'Clear chat' button. In BullEChat.tsx, handle the 429 response from useChat's onError callback: when the error message contains the rate limit text, replace the chat input area with a friendly 'BULL-E needs a breather 🐂' state showing the retry-after time and a disabled input. Dismiss automatically when the time elapses."

Prompt 16 — Inline AI commentary:

"Add BULL-E commentary throughout the app. On the ticker page: a 'Summarize Setup' button in the signal card that streams a BULL-E analysis of the current signal and patterns into an expandable panel below. On the backtest results page: an 'Explain Results' button that gives a plain-English or technical interpretation of the backtest stats. On each pattern in the pattern sidebar: a 'What does this mean?' tooltip that generates a short explanation on hover with a single non-streaming API call. All of these inject the relevant data as context to Claude. Reuse a shared <BullEInlineResponse> streaming component."

Phase 7 — Trade Journal (Days 12–13)
Prompt 17 — Journal entry:

"Build the trade journal at app/dashboard/journal/page.tsx. It should: show a list of past journal entries sorted by date, each showing symbol, direction, outcome badge (win/loss/breakeven), R-multiple achieved, and which playbook was used. A 'Log Trade' button opens a modal with: symbol input, direction toggle, entry/exit price inputs (R-multiple auto-calculated), size input, playbook selector (from user's saved playbooks), emotion/confidence slider 1-5 with emoji labels (😰 to 😎), and a notes textarea. On save, insert to journal_trades table. Add a paper trading toggle — when active, trades are flagged as simulated and shown with a 'Paper' badge."

Prompt 18 — AI coaching analysis:

"Create a weekly coaching analysis feature. Build /api/coaching-report that: fetches the user's last 30 journal trades from Supabase, fetches their playbook stats, calls the Claude API (non-streaming, full analysis) with all the data and a system prompt that instructs Claude to act as a trading coach and find behavioral patterns — specifically look for: early exits on winners, late exits on losers, day-of-week performance patterns, emotion score correlation with outcome, system adherence rate (trades that matched a playbook vs impulsive trades), regime mismatches. Return structured JSON with findings and recommendations. Build a <CoachingReport> component on the Performance page that displays this as a readable report with BULL-E's name on it. Cache the report for 24 hours."

Phase 8 — Performance Dashboard (Day 14)
Prompt 19 — Performance page:

"Build the Performance dashboard at app/dashboard/performance/page.tsx. Sections: (1) Header stats row — total trades, overall win rate, average R-multiple, system adherence %. (2) Equity curve — recharts LineChart of cumulative R over time, with a benchmark line showing what the backtest predicted. (3) Playbook breakdown table — for each saved playbook: trades taken, win rate, avg R, vs backtest expectation, trend arrow. (4) Behavioral insights panel — render the <CoachingReport> component with BULL-E's weekly analysis. (5) Calendar heatmap — show P&L by day of week and time of day as a grid heatmap using recharts. All data from Supabase, filtered by date range selector (1W / 1M / 3M / All)."

Phase 9 — Daily Brief (Day 15)
Prompt 20 — Daily brief:

"Build the home page at app/dashboard/page.tsx — the Daily Brief. It should: (1) Generate once per day (cached in Redis with a date key) by calling Claude with web search enabled, instructed to: assess the current market regime based on SPY/QQQ/VIX data, identify which strategy types have edge in the current regime, and write a 3-paragraph analyst-style morning note. Display this with BULL-E's avatar and name. (2) Below the brief, show the user's watchlist ranked by edge score — highest edge signals at the top with their direction and confidence. (3) Show a 'Your system is a match for today's regime' or 'Caution: today's regime conflicts with your primary playbook' banner based on comparing the detected regime against the user's top playbook. (4) Show the user's 3 most recent journal entries and the coaching insight of the week."

Phase 10 — Polish + Settings (Day 16)
Prompt 21 — Settings:

"Build the settings page at app/dashboard/settings/page.tsx. Sections: Account (display name, email, change password), Trading Preferences (account size input that updates profile, language mode toggle plain/technical that updates profile and immediately affects all BULL-E responses and signal cards), Appearance (light/dark mode toggle). All form saves with optimistic updates and toast confirmations using shadcn/ui Toast."

Prompt 22 — Final polish:

"Audit every page in the app. For each page and major component: add a loading skeleton using shadcn/ui Skeleton that matches the layout of the loaded state, add an error boundary with a retry button, add empty states with helpful context-aware prompts (e.g. empty watchlist says 'Add your first ticker to get signals and start tracking your edge'), ensure every interactive element has an aria-label, test and fix all mobile layouts at 375px width. Run through the full user journey: signup → add ticker → run backtest → save playbook → log a trade → view performance → read daily brief. Fix any broken handoffs."

The Order of Operations Summary
The sequence in one line each:

Foundation + auth + DB schema — nothing works without this
Market data service + hooks — feeds every feature
Watchlist — first real UI, establishes component patterns
Ticker page shell + chart — the app's center of gravity
Python backtest service — isolated, testable, no UI dependencies
Strategy parser + Backtest Lab UI — connects Python service to frontend
Signal engine + pattern detector — connects to ticker page
BULL-E chat + inline commentary — wraps all features with AI layer
Trade journal — needs signals and playbooks to exist first
Performance dashboard — needs journal data to exist first
Daily brief — needs everything to exist first
Settings + polish — last, always last

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
