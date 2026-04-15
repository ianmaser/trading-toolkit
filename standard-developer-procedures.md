# Standard Developer Procedures
### AI Trading Toolkit — Developer Onboarding Guide
> **Note:** The app name is not yet finalised. "EDGE" used elsewhere in the codebase is a working placeholder and is subject to change.

This document is the step-by-step guide for working on this project. Read it top to bottom
before your first session. After that, use it as a reference checklist every time you sit down to code.

Two people work on this project. We use Git to share code between us. Think of Git as a shared
Google Doc for code — it tracks every change, who made it, and when. The golden rules:
**never push directly to main. always create a branch. always open a pull request.**

---

## 1. First Time Setup (do this once, never again)

### What is a terminal?

The terminal is a text-based window where you type commands to control your computer. Think of it as texting your computer instructions. Everything is case-sensitive.

- **Mac:** Press `Cmd + Space`, type "Terminal", press Enter
- **Windows:** Press the Windows key, type "PowerShell", press Enter

### a) Install the prerequisites

Install these in order. After each one, close and reopen your terminal.

**Node.js** (the engine that runs the app)
- Download from [nodejs.org](https://nodejs.org) — choose the LTS version
- Verify: type `node -v` in your terminal. You should see something like `v20.18.0`

**Git** (the tool that saves and shares code)
- Download from [git-scm.com](https://git-scm.com)
- Verify: type `git -v`. You should see something like `git version 2.x.x`

**VS Code** (the code editor)
- Download from [code.visualstudio.com](https://code.visualstudio.com)

**Claude Code** (the AI assistant that writes code with you)
- Open VS Code → Extensions panel (four-square icon on the left sidebar)
- Search "Claude Code" and install it
- Or run `npm install -g @anthropic-ai/claude-code` in your terminal

### b) Recommended VS Code extensions

| Extension | What it does |
|---|---|
| **ESLint** | Highlights code errors as you type |
| **Prettier** | Automatically formats code so it stays clean |
| **Tailwind CSS IntelliSense** | Autocompletes CSS class names |
| **GitLens** | Shows who wrote each line and when |

### c) Clone the project from GitHub

```bash
git clone https://github.com/ianmaser/trading-toolkit.git
cd trading-toolkit
code .
```

### d) Install dependencies

```bash
npm install
```

### e) Set up your environment variables

Ask your partner to share the `.env.local` file with you directly (iMessage, email, etc.).
Place it in the root of the project folder. **Never commit it to Git. Never share it publicly.**

### f) Confirm everything works

```bash
npx tsc --noEmit
```

No output = no errors. If you see errors, stop and message your partner before proceeding.

---

## 2. Starting Every Session — do this before writing a single line of code

### Step 1 — Open your terminal in the project folder

In VS Code: top menu → **Terminal** → **New Terminal**.

### Step 2 — Get the latest code from main

```bash
git checkout main
git pull origin main
```

> **If you see "CONFLICT":** stop immediately and message your partner. Do not try to fix it alone.

### Step 3 — Install any new dependencies

```bash
npm install
```

### Step 4 — Confirm the codebase is clean

```bash
npx tsc --noEmit
```

No output = no errors. If there are errors, fix them or ask your partner before starting.

### Step 5 — Create your feature branch

**Never work directly on main.** Before touching any code, create a branch for what you're building:

```bash
git checkout -b feature/phase-01-market-data-service
```

Branch naming format: `feature/phase-{N}-short-description` or `fix/short-description` for bug fixes.

Examples:
- `feature/phase-01-market-data-service`
- `feature/phase-02-watchlist-page`
- `fix/backtest-crash-on-empty-candles`
- `docs/update-architecture-notes`

### Step 6 — Read the session notes

Open `sessions/` and read the most recent file. This tells you exactly where the last session left off, what decisions were made, and what to build next.

### Step 7 — Read the build plan for today's work

Open `PLAN.MD` and find the prompt for the feature you're building. Read it fully before opening Claude Code. If the feature touches API routes, caching, auth, or BULL-E, also skim the relevant section of `ARCHITECTURE.md`.

---

## 3. Working With Claude Code

Claude Code is an AI assistant that writes code alongside you. It does **not** remember previous sessions — you must give it context every time.

**How to start a feature — use this prompt every time:**

> *"Read CLAUDE.md and PLAN.MD. We're building [feature name from PLAN.MD]. Here's exactly what it needs to do: [paste the full prompt text from PLAN.MD]"*

**Rules:**
- **One prompt at a time** — never ask Claude to build two features in one message
- **If something breaks:** paste the full error message and the full file contents, then say: *"Don't rewrite the whole file. Find the specific problem and fix only that."*
- **Never skip the context prompt** — Claude has no memory of previous sessions
- **Ask Claude to write session notes:** *"Record everything we implemented today in a session note titled `04-16-2026-phase-01.md`"*

---

## 4. Saving Your Work — do this after every completed prompt

Once a prompt is done and `npx tsc --noEmit` shows no errors:

### Step 1 — Check what changed

```bash
git status
```

Review every file listed. Make sure you recognise everything before saving.

### Step 2 — Stage your changes

```bash
git add .
```

`.env.local` is automatically excluded — you will never accidentally commit your API keys.

### Step 3 — Commit your changes

```bash
git commit -m "feat: Phase 1 Prompt 5 — market data service"
```

Commit message format: `feat: Phase {N} Prompt {N} — {short description}`

### Step 4 — Push your branch to GitHub

Push to **your branch**, not main:

```bash
git push origin feature/phase-01-market-data-service
```

> First time pushing a new branch? Git may suggest running `git push --set-upstream origin feature/...` — that's fine, run it. You only need to do it once per branch.

---

## 5. Branching, Pull Requests & Code Review

This is one of the most important sections. Every piece of code that enters `main` must go through a pull request — no exceptions. This protects the stable version of the app and ensures both developers have seen every change.

### Why we don't push directly to main

`main` is the stable, working version of the app. It should always be in a state that could be deployed. Every change goes through a branch + pull request so the other person can review it before it becomes part of the official codebase.

**Direct pushes to main are disabled.** If you try, GitHub will reject it.

### Opening a pull request

Once you've pushed your branch and you're ready for review:

1. Go to [github.com/ianmaser/trading-toolkit](https://github.com/ianmaser/trading-toolkit)
2. GitHub will show a banner: **"Compare & pull request"** — click it
3. Fill in the pull request form:

**Title** — same format as your commit messages:
```
feat: Phase 1 Prompt 5 — market data service
```

**Description** — answer these questions:
```
## What was built
- Brief description of what this PR adds or changes

## How to test it
- Step-by-step instructions for your partner to verify it works

## Decisions made
- Any choices that aren't documented in PLAN.MD or ARCHITECTURE.md

## Notes for reviewer
- Anything you're unsure about or want a second opinion on
```

4. Assign your partner as the **Reviewer** (top right of the PR page)
5. Click **"Create pull request"**

### Reviewing a pull request

When your partner opens a PR and assigns you as reviewer:

1. Go to the PR on GitHub and read the description
2. Click **"Files changed"** to see every line that was added or removed
3. Leave comments on specific lines if something needs changing — click the `+` next to any line
4. If you want to test it locally:
```bash
git fetch origin
git checkout feature/phase-01-market-data-service
npm install
npx tsc --noEmit
```
5. When you're happy with the changes, click **"Review changes"** → **"Approve"** → **"Submit review"**

### Merging a pull request

Only merge after the other person has approved it.

1. On the PR page, click **"Squash and merge"** (keeps the commit history clean)
2. Confirm the merge
3. Click **"Delete branch"** — always delete the branch after merging, it's no longer needed

### After a PR is merged — both partners must do this

After any PR is merged into main, both developers should update their local main:

```bash
git checkout main
git pull origin main
```

This keeps both machines in sync. Don't skip this — starting a new branch from a stale main is a common source of conflicts.

---

## 6. Ending Every Session — always do this, even if a phase is not finished

> ⚠️ **IMPORTANT: Claude does not remember your last session.** Every time you open Claude Code, it starts with zero memory of what you built before. Write a session note every time you stop, even if you only worked for 30 minutes and didn't finish anything.

### Step 1 — Ask Claude to write the session note

> *"Record everything we implemented today in a session note titled `MM-DD-YYYY-short-description.md`"*

Examples: `04-16-2026-phase-01-market-data.md` · `04-17-2026-backtest-bugfix.md`

```markdown
# Session — MM-DD-YYYY — [Title]

## Who worked on this
[Your name]

## What was built
- Prompt X: [what you built and where the files are]

## What is NOT finished yet
- [e.g. "Started Prompt 6 but Redis caching not wired up yet"]

## Left off at
- [Exactly what the next person should do first]
- [What branch are you on? Is there a PR open?]

## Decisions made
- [Choices not in PLAN.MD or ARCHITECTURE.md]

## Open questions
- [Anything unresolved the other person needs to decide]
```

### Step 2 — Commit, push, and open a PR

```bash
git add sessions/
git commit -m "docs: session notes MM-DD-YYYY"
git push origin your-branch-name
```

Then open a pull request if your work is ready for review (see Section 5).
If you're mid-feature and not ready for review, just push the branch so your partner can see where you are.

---

## 7. Code Quality Checklist — run before marking any prompt done

- [ ] `npx tsc --noEmit` — zero errors, no output
- [ ] No `any` types in any new code
- [ ] No hardcoded URLs, API keys, or secrets — use env vars
- [ ] TypeScript only — no `.js` files created
- [ ] All new UI components have a loading skeleton and an error state
- [ ] All buttons and interactive elements have an `aria-label`
- [ ] All API inputs validated with Zod
- [ ] Mobile layout works at 375px width

---

## 8. After Completing a Full Phase

1. Ask Claude: *"Write tests for everything we just built — happy path, empty states, and error conditions."*
2. Manually click through the full user journey affected by the phase
3. Open `CLAUDE.md` and update the phase from ⬜ to ✅
4. Open a pull request and have your partner review before merging to main
5. If it's Friday, run the weekly audit (see below)

---

## 9. Weekly Audit — every Friday

Copy and paste this into Claude Code:

> *"Review all the files we've built this week. Look for: any hardcoded values that should be env vars, any missing error handling, any component that's missing a loading state, any Supabase query missing RLS, any TypeScript any types. List everything you find and fix them one by one."*

---

## 10. Git Troubleshooting

**"Push rejected" or "failed to push to main"**
You should not be pushing to main directly — create a branch and open a PR instead (see Section 5).

**"My push to my branch was rejected"**
Someone else may have pushed to your branch. Pull first:
```bash
git pull origin your-branch-name
git push origin your-branch-name
```

**"CONFLICT" when pulling**
Two people edited the same file. Stop and message your partner — resolve it together.

**"I accidentally committed .env.local"**
Message your partner immediately. This is a security issue that needs to be handled together before the commit reaches GitHub.

**"I don't know what state my code is in"**
```bash
git status                  # shows changed files
git branch                  # shows which branch you're on
git log --oneline -10       # shows last 10 commits
```

**"I want to undo my last commit (before pushing)"**
```bash
git reset --soft HEAD~1
```
Un-commits your last save but keeps all your changes. Only use before pushing. If already pushed, message your partner first.

---

## 11. File Map — where things live

| What you're looking for | Where it is |
|---|---|
| What to build next | `PLAN.MD` |
| How the app is wired together | `ARCHITECTURE.md` |
| Rules, stack, current phase | `CLAUDE.md` |
| Database tables and columns | `supabase/migrations/001_initial.sql` |
| Shared TypeScript types | `types/` |
| Utility functions (auth, cache, rate limiting) | `lib/` |
| React hooks (data fetching) | `hooks/` |
| API services (market data, signals, etc.) | `services/` |
| Page components | `app/dashboard/` |
| Reusable UI components | `components/features/` and `components/ui/` |
| Session handoff notes | `sessions/` |
| Things flagged to revisit | `TODO/revisit-later.md` |
| API keys (never in Git) | `.env.local` — shared privately with partner |
