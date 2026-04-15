# Standard Developer Procedures
### EDGE Trading Toolkit — Developer Onboarding Guide

This document is the step-by-step guide for working on this project. Read it top to bottom
before your first session. After that, use it as a reference checklist every time you sit down to code.

Two people work on this project. We use Git to share code between us. Think of Git as a shared
Google Doc for code — it tracks every change, who made it, and when. The golden rule:
**always pull before you start, always push when you stop.**

---

## 1. First time setup (do this once, never again)

### What is a terminal?

The terminal is a text-based window where you type commands to control your computer. You will use
it to run the project and interact with Git. Everything you type here is case-sensitive.

- **Mac:** Press `Cmd + Space`, type "Terminal", press Enter
- **Windows:** Press the Windows key, type "PowerShell", press Enter

### a) Install the prerequisites

Install these in order. After each one, close and reopen your terminal.

**Node.js** (the engine that runs the app)
- Download from [nodejs.org](https://nodejs.org) — choose the LTS version
- Verify it worked: type `node -v` in your terminal. You should see something like `v20.18.0`

**Git** (the tool that saves and shares code)
- Download from [git-scm.com](https://git-scm.com)
- Verify it worked: type `git -v` in your terminal. You should see something like `git version 2.x.x`

**VS Code** (the code editor)
- Download from [code.visualstudio.com](https://code.visualstudio.com)
- This is where you will read and review code

**Claude Code** (the AI assistant that writes code with you)
- Once VS Code is installed, open it
- Open the Extensions panel (the four-square icon on the left sidebar)
- Search for "Claude Code" and install it
- Alternatively: open your terminal and run `npm install -g @anthropic-ai/claude-code`

### b) Recommended VS Code extensions

Open VS Code, go to the Extensions panel, and install these:

| Extension | What it does |
|---|---|
| **ESLint** | Highlights code errors as you type |
| **Prettier** | Automatically formats code so it stays clean |
| **Tailwind CSS IntelliSense** | Autocompletes CSS class names |
| **GitLens** | Shows who wrote each line and when |

### c) Clone the project from GitHub

"Cloning" downloads the full project to your computer. You only do this once.

Open your terminal and run these two commands, one at a time:

```bash
git clone https://github.com/ianmaser/trading-toolkit.git
cd trading-toolkit
```

The first command downloads the project. The second command navigates into the project folder.

### d) Open the project in VS Code

```bash
code .
```

This opens the entire project in VS Code. You should see all the project files in the left sidebar.

### e) Install dependencies

"Dependencies" are the libraries and packages the project needs to run. This downloads them all:

```bash
npm install
```

This may take a minute. You will see a lot of text scrolling by — that is normal.

### f) Set up your environment variables

The project needs API keys (secret passwords for external services) to run. For security reasons
these are **never stored in Git** — if they were, anyone could see them on GitHub.

Ask your partner to share the `.env.local` file with you directly (iMessage, email, etc.).
Place it in the root of the project folder (the same level as `package.json`).

> ⚠️ Never share this file publicly. Never commit it to Git. The project is already configured
> to exclude it automatically, but you should know what it is and why.

### g) Confirm everything works

```bash
npx tsc --noEmit
```

If you see **no output at all**, you're good — the codebase is clean and you're ready to go.
If you see red error messages, stop and message your partner before doing anything else.

---

## 2. Starting every session — do this before writing a single line of code

Think of this as your pre-flight checklist. It takes 2 minutes and prevents hours of headaches.

### Step 1 — Open your terminal in the project folder

In VS Code: go to the top menu → **Terminal** → **New Terminal**. This opens a terminal
already pointed at the project folder — you don't need to navigate anywhere.

### Step 2 — Get the latest code from GitHub

Your partner may have made changes since you last worked. Always pull first:

```bash
git pull origin main
```

You'll see a summary of what changed. "Already up to date" is fine — it just means nothing changed.

> ⚠️ **If you see "CONFLICT"** in the output: stop immediately and message your partner.
> A conflict means two people edited the same file at the same time. Do not try to fix it
> alone until you are comfortable with Git.

### Step 3 — Install any new dependencies

If your partner added a new library, your local copy won't have it yet. This is safe to run every time:

```bash
npm install
```

### Step 4 — Confirm the codebase is clean

```bash
npx tsc --noEmit
```

No output = no errors. If there are errors, do not start building — fix them first or ask your partner.

### Step 5 — Read the session notes

Open the `sessions/` folder in VS Code and read the most recent file. It tells you exactly where
the last session left off, what was built, and what to do next.

### Step 6 — Read the build plan for today's work

Open `PLAN.MD` and find the prompt for the feature you're building today. Read it fully before
opening Claude Code. If the feature touches API routes, caching, auth, or BULL-E, also skim
the relevant section of `ARCHITECTURE.md`.

---

## 3. Working with Claude Code

Claude Code is an AI assistant that writes code alongside you. It reads the project files,
understands the architecture, and builds features based on your instructions.

### How to open it

- In VS Code: click the Claude icon in the left sidebar
- Or run `claude` in your terminal from the project folder

### How to start a feature

Always begin a session with this prompt — copy it exactly and fill in the blanks:

> *"Read CLAUDE.md and PLAN.MD. We're building [feature name from PLAN.MD]. Here's exactly what it needs to do: [paste the full prompt text from PLAN.MD]"*

This gives Claude the full context it needs before writing a single line of code.

### Rules for working with Claude

- **One prompt at a time** — never ask Claude to build two features in one message. You will get worse results.
- **If something breaks:** paste the full error message and the full contents of the broken file, then say: *"Don't rewrite the whole file. Find the specific problem and fix only that."*
- **Never skip the context prompt** — Claude does not remember previous sessions. Starting without context is like asking someone to continue a conversation they weren't in.

### How to ask Claude to record a session note

At the end of your session, tell Claude:

> *"Record everything we've implemented today in a session note titled `04-15-2026-phase-01.md`"*

Replace the date and title with today's date and a short description of what you worked on.
Claude will create the file in the `sessions/` folder automatically.

---

## 4. Saving your work — do this after every completed prompt

Once a prompt is done and `npx tsc --noEmit` shows no errors, save your work to GitHub.

### Step 1 — Check what changed

```bash
git status
```

This shows you every file that was added or modified. Review it — make sure you recognise everything listed.

### Step 2 — Stage your changes

"Staging" tells Git which files you want to include in this save:

```bash
git add .
```

The `.` means "everything in the project folder". The `.env.local` file is automatically excluded
by the project's `.gitignore` — you will never accidentally commit your API keys.

### Step 3 — Commit your changes

A commit is a named save point with a description of what changed:

```bash
git commit -m "feat: Phase 1 Prompt 5 — market data service"
```

**Commit message format:** `feat: Phase {N} Prompt {N} — {short description}`

Keep the message short and clear. Someone reading the Git history should understand what this
commit contains without opening any files.

### Step 4 — Push to GitHub

This uploads your commit so your partner can see it:

```bash
git push origin main
```

You'll see output ending in something like `main -> main`. That means it worked.
If you see an error, check the troubleshooting section below.

---

## 5. Ending every session — always do this, even if a phase is not finished

> ⚠️ **IMPORTANT: Claude does not remember your last session.** Every time you open Claude Code,
> it starts with zero memory of what you built before. The only way it knows what happened is if
> you tell it — and the only way your partner knows is if you write it down.
>
> **Write a session note every time you stop working, even if you only worked for 30 minutes
> and didn't finish anything.**

### Step 1 — Ask Claude to write the session note

Tell Claude:

> *"Record everything we've implemented today in a session note titled `MM-DD-YYYY-short-description.md`"*

Examples of good titles:
- `04-15-2026-phase-00-initial-setup.md`
- `04-16-2026-phase-01-market-data.md`
- `04-17-2026-backtest-bugfix.md`

Claude will create the file in `sessions/` using this template:

```markdown
# Session — MM-DD-YYYY — [Title]

## Who worked on this
[Your name]

## What was built
- Prompt X: [what you built and where the files are]
- Prompt Y: [what you built and where the files are]

## What is NOT finished yet
- [Be specific — e.g. "Started Prompt 6 but the Redis caching logic is not wired up yet"]

## Left off at
- [Exactly what the next person should do first when they sit down]
- [e.g. "Next step is to wire useCandles hook into the WatchlistPage component"]

## Decisions made
- [Any choices that aren't in PLAN.MD or ARCHITECTURE.md]
- [e.g. "Decided to use X instead of Y because..."]

## Open questions
- [Anything unresolved that the other person needs to decide or look into]
```

### Step 2 — Commit and push the session note

```bash
git add sessions/
git commit -m "docs: session notes MM-DD-YYYY"
git push origin main
```

---

## 6. Code quality checklist — run before marking any prompt done

Before you tell Claude a prompt is finished, go through this list:

- [ ] `npx tsc --noEmit` — zero errors, no output
- [ ] No `any` types in any new code
- [ ] No hardcoded URLs, API keys, or secrets — everything is in `.env.local`
- [ ] TypeScript only — no `.js` files created
- [ ] All new UI components have a loading skeleton and an error state
- [ ] All buttons and interactive elements have an `aria-label`
- [ ] All API inputs are validated with Zod
- [ ] Mobile layout looks correct at 375px width

---

## 7. After completing a full phase

1. Ask Claude: *"Write tests for everything we just built — happy path, empty states, and error conditions."*
2. Manually click through the full user journey affected by the phase and confirm it works
3. Open `CLAUDE.md` and update the phase status from ⬜ to ✅
4. Commit, push, write your session note
5. If it's Friday, run the weekly audit (see below)

---

## 8. Weekly audit — every Friday

Copy and paste this exactly into Claude Code:

> *"Review all the files we've built this week. Look for: any hardcoded values that should be env vars, any missing error handling, any component that's missing a loading state, any Supabase query missing RLS, any TypeScript any types. List everything you find and fix them one by one."*

This keeps the codebase clean as it grows and prevents technical debt from accumulating.

---

## 9. Git troubleshooting

**"Push rejected" or "failed to push"**

Your partner pushed something after your last pull. Fix it by pulling first:
```bash
git pull origin main
git push origin main
```

**"CONFLICT" when pulling**

Two people edited the same file. Do not touch anything. Message your partner — resolve it together.

**"I accidentally committed .env.local"**

Message your partner immediately. This is a security issue that needs to be handled together
before the commit reaches GitHub.

**"I don't know what state my code is in"**

```bash
git status
```
Shows every file that has changed and whether it's staged.

```bash
git log --oneline -10
```
Shows the last 10 commits and their descriptions — useful for understanding what was built recently.

**"I want to undo my last commit (before pushing)"**

```bash
git reset --soft HEAD~1
```
This un-commits your last save but keeps all your changes. Only use this before pushing.
If you've already pushed, message your partner first.

---

## 10. File map — where things live

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
| API keys (never in Git) | `.env.local` (shared privately with partner) |
