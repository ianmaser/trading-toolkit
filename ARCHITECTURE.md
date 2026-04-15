The App: The Trader's Toolkit (name subject to change)

1. Home: The Daily Brief
   Not a dashboard full of widgets. One clean page that loads every morning and answers three questions:

What is the market doing right now? — Regime detection front and center. Trending, ranging, or volatile expansion. Which strategies have edge today vs. which don't.
What's on your radar? — Watchlist tickers with signal strength, ranked by edge score. Not a flood of data, just a ranked list with a reason for each.
How are you doing? — A small performance snapshot. Win rate this week, how closely you're following your system, one AI coaching insight.

The brief is AI-generated each morning from live market data. It reads like a note from a professional analyst, not a table of numbers.

2. Ticker View: One Page, Everything
   When you click a ticker, you get one unified view — no tabs, no page switching:

Interactive candlestick chart (TradingView lightweight-charts) with detected patterns highlighted as zones directly on the chart
Multi-timeframe confluence panel — same ticker on 3 timeframes side by side, with a composite confluence score. Green when all three align, yellow when two do, red when they don't
Signal card — edge score, direction, stop/target levels, expected move, confidence, and a plain-English or technical explanation depending on user preference
Live risk calculator baked in — user inputs account size once, and every signal shows exact share size, dollar risk, and R-multiples automatically
Catalyst strip — a thin bar at the top showing upcoming earnings, recent unusual options flow, short interest changes, and relevant news headlines. No SEC filings at launch — too noisy
Pattern sidebar — detected patterns listed with confidence scores. Click one, chart zooms to it

3. Backtest Lab
   The original idea, but with the visual strategy builder added alongside the prompt:

Two input modes — freeform prompt ("RSI below 30 + MACD convergence, 2R TP, 1R SL") or a visual builder with dropdowns and sliders that auto-syncs with the prompt
Results — equity curve, win rate, EV/expectancy, profit factor, max drawdown, and a regime breakdown (how did this strategy perform in trending vs ranging markets specifically)
Playbook saving — name and save any backtest as a playbook. The signal engine then flags live setups that match your saved playbooks by name
Batch testing — run the same strategy across multiple tickers or time periods in one click to check if edge is real or overfitted

4. Playbook System
   This is the bridge between backtesting and live trading that no tool has nailed:

Each playbook has: its strategy rules, historical stats, current market regime fit score, and your personal win rate when you've actually traded it
When a live signal matches a playbook, it surfaces as "Your MACD pullback setup is triggering on NVDA — historical win rate 64%, regime fit: high"
Over time this becomes your personal trading manual, built from your own data

5. Trade Journal
   The most underbuilt feature in the space, built properly:

Log trades with: ticker, entry/exit, size, which playbook you were using, and a confidence/emotion rating at entry (1–5 scale, just a slider)
AI automatically compares your journal against your backtests and surfaces behavioral patterns weekly: "You exit winners 38% too early on average. Your Tuesday trades underperform all other days by 2.1R."
Paper trading mode — take any live signal as a simulated trade, tracked in real P&L, so you can validate a new playbook before risking real money

6. AI Coach: The Sidebar That Thinks
   Not a generic chatbot. A context-aware analyst that always knows:

What ticker you're looking at
Its current signal and pattern data
Your relevant playbooks
Your journal history and behavioral tendencies
Current market regime

Ask it anything: "Is this a valid setup?" / "What would invalidate this trade?" / "How has this pattern historically performed on QQQ in a trending regime?"
Toggle between plain-English and technical modes. The AI uses web search so it can pull live news, analyst sentiment, and catalyst information on demand.

7. Performance Dashboard
   A weekly/monthly view that answers the only questions that matter for growth:

Are you following your system?
Which playbooks are working and which aren't?
What behavioral patterns are costing you money?
How does your real performance compare to your backtested expectations?

No vanity metrics. Just the signal-to-noise ratio of your own trading.

What's cut vs. your original
Cut: Raw SEC filings — replaced by cleaner institutional activity signals (options flow, short interest, dark pool volume via Unusual Whales API). Separate pages for watchlist, signals, and charts — collapsed into the unified ticker view. Real-time quote polling on all tickers at launch — start with 15-min delayed, add real-time as a premium tier.
Streamlined: The AI chat becomes a true context-aware coach, not a generic assistant. Signal history becomes part of the journal/performance system rather than a standalone page.
Added: Market regime detection as a first-class concept throughout. Multi-timeframe confluence. Risk calculator everywhere. Playbook system. Trade journal with AI behavioral analysis. Paper trading. The daily brief.

What makes it actually different
Every tool gives traders data. This one gives traders self-knowledge. The playbook + journal + AI coach loop means the longer you use it, the more it knows about your specific edge and your specific weaknesses. That compounding personalization is what creates the kind of loyalty and real-world results that spread by word of mouth.
