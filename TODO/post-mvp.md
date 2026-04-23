# Post-MVP Feature Backlog

Features confirmed as valuable but intentionally deferred until after the MVP ships. Revisit after reaching stable user base and first revenue milestone.

---

## 1. CSV Data Export

**What it is:** A simple "Export to CSV" button on the journal trade log that downloads all the user's trades as a spreadsheet.

**Why it matters:** TradeZella restricts data export and users explicitly call it out as a lock-in strategy in reviews. A visible export option is a trust signal — it says "your data is yours, always." Traders who've been burned by platforms shutting down specifically look for this before committing long-term. Also useful for users who want to do their own analysis in Excel.

**Scope:** Very low effort. Query journal_trades for the current user, serialize to CSV (symbol, direction, entry_price, exit_price, size, r_multiple, outcome, playbook, emotion, mistake_type, mae_pct, mfe_pct, adherence_score, notes, created_at), trigger a browser download. A single `/api/journal/export` GET route + a button on the journal page.

**Where it fits when built:** Phase 11 (Polish) addition — Prompt 22.

---

## 2. Cross-Analysis Tool

**What it is:** A dedicated analytics panel on the Performance dashboard where the user freely cross-references any two metrics against each other — e.g., emotion score vs P&L, time of day vs win rate, position size vs outcome, setup type vs win rate by day of week. Two dropdowns (X axis, Y axis), rendered as a recharts scatter or bar chart.

**Why it matters:** TradeZella has this and it generates the kind of "look what I found about my trading" insights that get shared on Reddit and X, driving organic acquisition. Power users specifically seek this depth. It also surfaces patterns BULL-E can then reference in coaching.

**Available X/Y dimensions to support:**
- Time of day (hour bucket)
- Day of week
- Emotion score (1–5)
- Position size (dollar or shares)
- R-multiple achieved
- Setup / playbook
- Mistake type
- Win / loss / breakeven
- Direction (long/short)
- Symbol or sector

**Scope:** Medium effort. All the raw data is already in journal_trades. The UI is two dropdowns + a recharts chart + a summary stat (correlation coefficient or average per bucket). Add as a new tab on the Performance dashboard page.

**Where it fits when built:** Phase 9 (Performance dashboard) addition — Prompt 19.

---

## 3. Multi-Account Support

**What it is:** Allow a single EDGE user to maintain multiple named journal accounts (e.g., "Live — IBKR", "Paper", "Prop — FTMO Challenge") and switch between them or view combined stats.

**Why it matters:** Active traders routinely run: a live account, a paper trading account, and one or more prop firm challenge accounts simultaneously. TradeZella limits the Basic plan to 1 account and it's their #2 most cited complaint after the no-trial policy. With PropFirm Sync already in the MVP, the implicit need for multi-account is already there — traders will want their prop challenge trades separate from their live trading stats.

**Scope:** Medium effort. Add a journal_accounts table (id, user_id, name, account_type enum live/paper/prop, is_default boolean). Add journal_account_id FK to journal_trades. Add an account switcher dropdown to the journal page header and performance dashboard filters. Stats respect the selected account filter or show "All accounts" combined view. RLS stays per user_id.

**Design decision for later:** Determine if Starter tier gets 1 account (like TradeZella) or unlimited (differentiation). Free unlimited multi-account would be a notable advantage over every competitor.

**Where it fits when built:** Phase 8 (Journal) DB schema addition — new migration + Prompt 17 UI update.

---

---

## 4. Pattern Detector

**What it is:** A background service that scans candle arrays for classical chart patterns (bull flag, bear flag, ascending triangle, head & shoulders, double top/bottom, wedge). Each detected pattern is returned with a confidence score, the price zone it spans, and a label. On the ticker page, patterns appear in a sidebar list — clicking one scrolls the chart to that zone and draws the annotation.

**Why it matters:** Saves traders hours of manual chart reading. Provides BULL-E with structured pattern context to coach around ("You entered a bull flag breakout at 78% confidence — that's a high-quality setup per your playbook").

**Scope:** Medium effort. Add a `/api/patterns/[symbol]` route. Pattern detection logic runs server-side in TypeScript (no Python service needed — this is geometric math on OHLCV arrays, not indicator math). Wire patterns into the CandlestickChart annotations prop and the ticker page sidebar. Cache results 15min in Redis.

**Where it fits when built:** Phase 5 (Signal Engine) — Prompt 14. Was originally in MVP plan; removed to reduce time-to-ship.

---

## 5. Inline AI Commentary

**What it is:** A subtle AI annotation layer directly on the candlestick chart. When the signal engine generates a signal, a small annotated callout appears at the signal candle: "BULL-E: RSI divergence + volume surge — setup matches your momentum playbook." Clicking the annotation opens BULL-E with full context pre-loaded. Also: a lightweight real-time commentary bar below the chart that updates when the timeframe changes (one sentence, streamed).

**Why it matters:** Moves BULL-E from a chat drawer into the core analysis workflow. Reduces friction — the AI insight appears where the trader is already looking.

**Scope:** Medium effort. New `/api/commentary/[symbol]` route (non-streaming, short response). CandlestickChart gets a `commentary` annotation type. The BullEChat drawer gets a `preloadedContext` prop so clicking an annotation opens BULL-E mid-thought.

**Where it fits when built:** Phase 6 (BULL-E) — Prompt 16. Was originally in MVP plan; removed to reduce time-to-ship.

---

## 6. Trade Replay

**What it is:** Tick-by-tick playback of a logged trade on the candlestick chart. A "Replay" button on each journal entry loads the chart at the entry candle and plays forward in real time (or at 2x/4x speed), revealing the price action as it happened. A vertical marker tracks the position's entry and exit. BULL-E watches alongside and can comment at key moments.

**Why it matters:** The single most-requested feature across all trading journal Reddit threads. "I need to re-watch what happened" is universal. No competitor (TraderSync, TradeZella, Edgewonk) has trade replay — it would be a genuine category-first feature.

**Scope:** Medium-high effort. Requires: storing entry/exit timestamps on journal_trades (add created_at is already there; need a closed_at column), fetching intraday 1-min candles for the replay window, animating the chart forward frame by frame using lightweight-charts `setVisibleRange` + `update`. BULL-E commentary at key moments is a separate streaming call triggered by candle milestones.

**DB addition needed:** `closed_at timestamptz` column on `journal_trades`.

**Where it fits when built:** Phase 7 (Journal) — Prompt 17b. Was originally in MVP plan; removed to reduce time-to-ship.

---

## 7. PropFirm Sync

**What it is:** A dedicated prop firm challenge tracker. The user inputs their challenge parameters (account size, max daily loss, max total drawdown, profit target, max trading days). EDGE tracks their journal trades against those limits in real time and shows: current drawdown %, daily loss vs limit, profit progress bar, days remaining, and a "Challenge Status" banner (On Track / At Risk / Passed / Failed). BULL-E knows the challenge constraints and coaches around them ("You're at 65% of your daily loss limit — BULL-E recommends stepping away after the next trade regardless of outcome").

**Why it matters:** The prop firm market is massive and growing. FTMO, MyForexFunds, Apex, and dozens of others have millions of active challenge participants. TradeZella has prop firm tracking as a premium feature and it's a key driver of their $29/mo plan conversions. EDGE's Trader Health Score + BULL-E coaching makes prop firm support more powerful than any competitor.

**Scope:** Medium effort. New `prop_challenges` table (id, user_id, name, account_size, max_daily_loss_pct, max_total_drawdown_pct, profit_target_pct, start_date, end_date, status enum active/passed/failed/abandoned). A "Challenges" tab on the Journal page. BULL-E's system prompt includes active challenge constraints when present.

**DB addition needed:** `prop_firm_account_id uuid` FK on `journal_trades` (nullable).

**Where it fits when built:** Phase 7 (Journal) — after Prompt 17. Was originally in MVP plan; removed to reduce time-to-ship.

---

## 8. MAE/MFE Tracking

**What it is:** Maximum Adverse Excursion (MAE) and Maximum Favorable Excursion (MFE) tracking on every trade. MAE = how far against you the trade went before it worked (or stopped out). MFE = the best price you could have exited for. Together they reveal exit quality: are you leaving money on the table, or getting shaken out before the move?

**Why it matters:** This is the metric that separates discretionary traders who improve from those who plateau. TraderSync shows MAE/MFE as a core feature. Edgewonk built their entire product around it. Without MAE/MFE, BULL-E can't coach exit quality — only entry quality.

**Scope:** Medium effort. Add `mae_pct numeric` and `mfe_pct numeric` columns to `journal_trades`. Add MAE/MFE input fields to the journal log modal (optional — can be entered manually or auto-calculated from intraday candles if available). Add MAE/MFE exit quality panel to the Performance dashboard (avg MFE vs avg R captured with BULL-E insight).

**Where it fits when built:** Phase 7 (Journal) — part of Prompt 17. Was removed from MVP to reduce journal complexity at launch.

---

## 9. Advanced Performance Panels

**What it is:** Three additional panels on the Performance dashboard:

**(a) P&L Calendar** — a monthly calendar view showing each trading day as a colored cell: green (profitable), red (losing), gray (no trades). Click a day to drill into its trades. Recharts or CSS grid. Month navigation.

**(b) Mistake Breakdown Panel** — a bar chart of mistake_type frequency across the filtered date range. Shows which error is most costly and most frequent. Only shows when trades have mistake_type set.

**(c) MAE/MFE Exit Quality Panel** — avg MFE vs avg R captured. If avg MFE is significantly higher than avg R, BULL-E shows: "You are leaving X R on the table on average — consider widening your targets or trailing your stop." Only shows when mae_pct/mfe_pct are populated on at least 5 trades. Depends on item 8 (MAE/MFE tracking) shipping first.

**Why it matters:** These are the panels that TraderSync and TradeZella users screenshot and post to Reddit. They drive organic acquisition through "look what I found about my own trading" shareability.

**Scope:** Low-medium effort each (recharts, existing data). P&L Calendar and Mistake Breakdown are independent — ship them first. MAE/MFE panel depends on MAE/MFE tracking (item 8).

**Where it fits when built:** Phase 8 (Performance dashboard) — Prompt 19 additions.

---

## 10. Trader Health Score

**What it is:** A composite 0–100 behavioral discipline score shown in the Performance dashboard header. Four equally-weighted components (25% each):
1. System adherence — average adherence_score across trades
2. Mistake discipline — inverse of the % of trades tagged with a rule-breaking mistake_type
3. Emotion-outcome alignment — correlation between calm scores (4–5) and wins vs fearful scores (1–2) and losses
4. Game plan adherence — % of days where the user stayed within daily_plan max_loss and max_trades limits

Displayed as a circular gauge with color gradient (0–40 red / 41–70 amber / 71–100 green) and a one-line BULL-E interpretation: "Your discipline improved 12 points this month — fewer oversized entries after losses." Only shown when 10+ trades exist in the selected date range.

**Why it matters:** TradeZella's version of this (called "Trader Score") is one of their most-screenshot features. It gamifies discipline. EDGE's version is more nuanced (game plan adherence + emotion-outcome correlation are novel inputs no competitor uses).

**Scope:** Medium effort. Pure calculation from existing journal_trades, daily_plans, and daily_journal data — no new DB schema needed.

**Where it fits when built:** Phase 8 (Performance dashboard) — Prompt 19 addition.

---

## 11. Living Macro Thesis UI

**Note:** The DB tables (macro_theses, sector_theses, position_theses) are deployed at MVP launch in Phase 10. Data starts compounding immediately. The UI below ships post-MVP.

**What it is:** A dedicated Thesis page at `app/dashboard/thesis/page.tsx`:
- **Macro Thesis card** — editable title + regime dropdown (trending/ranging/volatile/stagflation) + narrative textarea. One active thesis per user (is_active=true). Saving a new thesis triggers a server action that flags all linked sector_theses and position_theses for review. BULL-E banner: "Your macro thesis changed — X positions may need review."
- **Sector Thesis cards** — grid of cards per sector: name, direction badge (long/short/neutral), thesis content, linked position count, yellow "Needs Review" badge if flagged. Add/edit/remove inline. "Acknowledge" button clears the flag.
- **Position Thesis list** — all position_theses with symbol, direction, thesis note, linked sector, trade outcome if linked to a journal_trade. Flagged positions show yellow "Needs Review". Click navigates to `/dashboard/ticker/[symbol]`.
- Loading skeletons + empty state explaining what a macro thesis is and why it makes BULL-E more useful.

**BULL-E integration (activates with this UI):** BULL-E's system prompt adds: active macro thesis (title + content), sector theses (sector, direction, content, flagged status), position_theses for the currently viewed ticker. This gives BULL-E full investment worldview context — not just trade history.

**AI Research Synthesis (ships with this UI):** "Synthesize Research" button in the BULL-E drawer. Opens a textarea modal: "Paste article, earnings transcript, or analyst note here." On submit, sends the pasted content + full thesis context to Claude: "Read this research. Identify how it confirms, challenges, or changes this trader's macro thesis and sector positions. Flag any positions that may need review." Streams inline in chat. Zero competitors offer anything like this.

**Sidebar:** Add "Thesis" nav item between Watchlist and Backtest Lab.

**Types/hooks:** `types/thesis.ts` (MacroThesis, SectorThesis, PositionThesis) + `hooks/useThesis.ts` (useMacroThesis, useSectorTheses, usePositionTheses, mutations).

**Where it fits when built:** New phase between Daily Brief and Settings — approximately Day 16 of a post-MVP sprint.

---

## 12. Community Playbook Library

**What it is:** A public library of community-submitted playbooks. Users can browse playbooks by strategy type, asset class, and win rate. They can fork a playbook into their own account as a starting point. A "Submit to Library" button on saved playbooks opens a review flow.

**Why it matters:** Viral growth mechanism — traders share playbooks on Reddit/X with a link back to EDGE. Also accelerates time-to-value for new users who don't have their own strategy yet.

**Scope:** Medium effort. Add `is_public boolean` and `fork_count int` to playbooks table. New `/dashboard/library` page with filter + search. Forking copies the playbook row to the new user's account. Moderation queue to prevent abuse.

**Where it fits when built:** Phase 5 (Backtest Lab) — Prompt 12 addition. Was originally in MVP plan; removed to reduce scope.

---

## Notes

- **Ship order:** CSV Export → Advanced Performance Panels (P&L Calendar + Mistake Breakdown) → MAE/MFE Tracking → Living Macro Thesis UI → everything else.
- CSV Export is the quickest win and ships as a single PR.
- P&L Calendar and Mistake Breakdown are independent of each other — ship them together in a "Performance Update" release.
- MAE/MFE exit quality panel depends on MAE/MFE tracking shipping first.
- Trader Health Score and Cross-Analysis are "Power User" additions — ship after initial retention data shows what users actually want.
- Living Macro Thesis UI is the highest-value post-MVP feature long-term (competitive moat). Prioritize after the base product has traction.
- Revisit this list after Phase 11 (Settings + Polish) is complete.
