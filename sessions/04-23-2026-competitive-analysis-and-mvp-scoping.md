# Session — 04-23-2026 — Competitive Analysis & MVP Scoping

## Who worked on this
Ian

## What was done

This was a pure planning and strategy session. No code was written. The output is a significantly sharper product plan and a full competitive intelligence document.

---

### Phase 4 Explanation

Before starting any build work, Ian asked for a plain-language walkthrough of Phase 4 (Python Backtest Service). Covered:
- What FastAPI is and why we use a separate Python microservice (pandas-ta as single source of truth for all indicator math — live signals and backtests use identical logic)
- What Railway is and how it differs from Vercel (long-running processes, not serverless)
- Why we never hardcode the Python service URL and always use `PYTHON_SERVICE_URL` env var
- How the `/indicators` and `/backtest` endpoints relate to the rest of the app

---

### TraderSync Competitive Analysis

Ian shared the TraderSync app. Ran a full feature-by-feature deep analysis. Key findings documented in `competitive-analysis.md`:

**What TraderSync does well:**
- Broker auto-sync (IBKR, TD, Schwab, Webull, Tradovate) — eliminates manual trade logging
- P&L calendar view — highly shareable, drives organic acquisition
- Detailed journal modal (commissions, tags, custom fields)
- Good mobile app (iOS/Android)

**Where EDGE has structural advantages:**
- Signal engine + backtest lab (TraderSync has none)
- BULL-E AI coaching vs their static "AI Insights" tab
- Playbook system with adherence scoring
- Pre-session game plan tied to playbook rules
- Living Macro Thesis (nothing like it anywhere)
- Pricing: EDGE Starter is free; TraderSync's cheapest paid plan is $29.95/mo with no free tier

**Features ethically incorporated from the TraderSync analysis:**
- Pre-session game plan (daily_plans table + "Today's Game Plan" section on Daily Brief)
- P&L calendar — moved to post-MVP
- Mistake breakdown panel — moved to post-MVP

---

### AlphaQ Competitive Intelligence PDF Integration

Ian's business partner submitted `alphaq_competitive_report.pdf` (8 pages). Fully read and extracted. All relevant data folded into `competitive-analysis.md` and `PLAN.MD`. Key additions:

**Market size data added:**
- TAM: $13.5B (2025), $16.1B projected 2026 at 20% CAGR
- 165M US stock traders
- $302B retail equity inflows in 2025 (+53% YoY)
- SAM: 25–33M active self-directed traders (5+ trades/month)
- ARR projections: 0.1% penetration @ $50/mo ARPU = $15–20M ARR

**Competitor profiles added from PDF:** TradingView, Trade Ideas/Holly AI, AITradingCoach.org/TplusTwo

**Living Macro Thesis:** The PDF described this as "genuine category zero" — the most defensible long-term differentiator. No competitor has anything like it. Ian chose the full version (new phase in PLAN.MD). DB tables deploy at MVP launch so data starts compounding; UI is post-MVP.

**3-tier pricing model adopted from PDF:**
| Tier | Price | Notes |
|---|---|---|
| Starter | $0/mo | Journal (30 trades/mo), watchlist (5), BULL-E (5 msg/day) |
| Pro | $39/mo | Everything unlimited |
| Advisor | $99/mo | Multi-portfolio, team journal, API, priority BULL-E |

---

### TradeZella Deep Dive

Full analysis matching TraderSync depth. Key findings:

**Biggest acquisition weakness:** No free trial, no refund policy — their #1 cited complaint in reviews. EDGE's Starter free tier directly exploits this.

**What TradeZella does better than TraderSync:**
- Always-on AI on all tiers starting at $29/mo (not just premium)
- Trader Score (behavioral discipline composite metric)
- Multi-account support (live/paper/prop — their #2 most requested feature)
- Cross-analysis tool (any two metrics on X/Y axes — generates viral "look what I found" screenshots)

**Features incorporated from TradeZella analysis:**
- Trader Health Score (behavioral discipline composite) — moved to post-MVP
- Cross-analysis tool — added to post-mvp.md (already had it partially considered)
- Multi-account support — added to post-mvp.md

---

### AITradingCoach.org / TplusTwo Deep Dive

Launched November 2025. Currently free.

**Their fatal structural flaw:** No persistent memory across sessions. Every conversation starts cold — no trade history, no playbook, no context. EDGE's advantage is made explicit in the UI via the BULL-E caption: "Remembers your last 30 trades, your playbook rules, and your onboarding profile."

**Features incorporated:**
- Trader Assessment onboarding (5-step questionnaire on first login, answers feed BULL-E from day one) — added to Phase 11 (Polish), Prompt 22. Ships before AITradingCoach's planned v2 "Trader Assessment Module."

---

### Competitor Gap Analysis — What EDGE Was Missing

After all three deep dives, identified additional gaps none of the competitors address:
- **BULL-E's coaching is generic without onboarding data** — Trader Assessment fixes this
- **No pre-session structure** — game plan section fixes this (already added from TraderSync analysis)
- **No thesis layer connecting trades to worldview** — Living Macro Thesis is the long-term fix

---

### MVP Rescoping

With the plan grown to ~24 prompts, Ian asked for honest senior-engineer scoping of what's truly MVP vs post-launch. Approved the following rescoping:

**Removed from MVP → post-mvp.md:**
- Pattern Detector (Prompt 14)
- Inline AI Commentary (Prompt 16)
- Trade Replay (Prompt 17b)
- PropFirm Sync (was in Prompt 17)
- MAE/MFE tracking (was in Prompt 17)
- P&L calendar, mistake breakdown, MAE/MFE exit quality panel, Trader Health Score (were in Prompt 19)
- Living Macro Thesis UI (Phase 10 — DB schema ships at MVP, UI is post-MVP)
- AI Research Synthesis (post-MVP add-on to Living Macro Thesis UI)
- BULL-E thesis-aware context (activates when Living Macro Thesis UI ships)
- Community Playbook Library (was in Prompt 12)

**MVP plan is now 17 prompts across 17 days.** Every remaining phase has been updated to reflect the tighter scope.

---

## Files created or modified

| File | Change |
|---|---|
| `competitive-analysis.md` | Created from scratch. Full 8-section competitive intelligence document (market size, 2x2 landscape map, 7 competitor profiles, feature gap matrix, 3-tier pricing, GTM, risk matrix, one-sentence position) |
| `PLAN.MD` | Major restructuring — Community Playbook Library removed (Prompt 12), Pattern Detector → post-MVP (Prompt 14), BULL-E simplified — thesis context + AI Research Synthesis removed (Prompt 15), Inline Commentary → post-MVP (Prompt 16), Journal simplified — MAE/MFE + PropFirm Sync removed (Prompt 17), Performance dashboard trimmed — 4 competitive additions removed (Prompt 19), Phase 10 Living Macro Thesis → DB-only migration (no UI), Order of Operations updated to reflect true MVP |
| `TODO/post-mvp.md` | Expanded from 3 items to 12 — full specs for all deferred features including Trade Replay, PropFirm Sync, MAE/MFE, advanced performance panels, Trader Health Score, Living Macro Thesis UI (with BULL-E integration + AI Research Synthesis), Community Playbook Library |

---

## Key decisions made

- **Living Macro Thesis:** DB tables ship at MVP; UI is post-MVP. Data compounds from day one.
- **Trader Assessment onboarding:** Ships in MVP Phase 11 — competes directly against AITradingCoach's unreleased v2 feature.
- **Pricing:** 3-tier model adopted ($0 / $39 / $99). Free tier is the primary acquisition strategy — no trial needed, data lock-in builds naturally.
- **BULL-E's key differentiator made explicit in UI:** Caption line under the chat header: "Remembers your last 30 trades, your playbook rules, and your onboarding profile."
- **Plan tier rate limiting:** Starter = 5 BULL-E messages/day; Pro/Advisor = 300/day. Enforced in `/api/chat` via `checkChatRateLimit(userId, planTier)`.
- **Post-MVP ship order:** CSV Export → P&L Calendar + Mistake Breakdown → MAE/MFE Tracking → Living Macro Thesis UI → everything else.

---

## Competitive position (final)

> "EDGE is the only trading platform where your macro thesis and your trade journal are the same document — and an AI coach reads both before talking to you."

12–18 month window to establish category leadership before better-funded competitors respond. Priority: ship the full MVP, build the free user base, get thesis data compounding.

---

## What is NOT finished
- Nothing from today's planning scope is unfinished ✅

## Left off at
- All planning complete ✅
- **Next session starts at Phase 4, Prompt 10 — Python Backtest Service**
- Set up the Python FastAPI service in `python-service/`
- Read `PLAN.MD` Prompt 10 before starting
- No code has been written for Phase 4 yet
