# Standard Developer Procedures

This document is the step-by-step guide for working on this project. Read it top to bottom
before your first session. After that, use it as a reference checklist every time you sit down to code.

Two people work on this project. We use Git to share code between us. Think of Git as a shared
Google Doc for code — it tracks every change, who made it, and when. The golden rule:
**always pull before you start, always push when you stop.**

---

## 1. First time setup (do this once, never again)

If you have never worked on this project before on your computer:

**a) Install the prerequisites**

- [Node.js](https://nodejs.org) (v20 or higher) — check by running `node -v` in your terminal
- [Git](https://git-scm.com) — check by running `git -v` in your terminal
- [VS Code](https://code.visualstudio.com) or any code editor you prefer

**b) Clone the project from GitHub**

This downloads the full project to your computer. Run this once in your terminal:

```bash
git clone https://github.com/ianmaser/trading-toolkit.git
cd trading-toolkit
```

**c) Install dependencies**

This installs all the libraries the project needs:

```bash
npm install
```

**d) Set up your environment variables**

The project needs API keys to run. These are never stored in Git (for security reasons).
Ask your partner to share the `.env.local` file with you directly (via iMessage, email, etc.).
Place it in the root of the project folder. It should never be committed to Git.

**e) Confirm everything works**

```bash
npx tsc --noEmit
```

If you see no output, you're good. If you see errors, ask your partner before proceeding.

---

## 2. Starting every session — do this before writing a single line of code

### Step 1 — Get the latest code from GitHub

Someone may have made changes since you last worked. Always pull first:

```bash
git pull origin main
```

You'll see a summary of what changed. If it says "Already up to date" that's fine too.

> **If you see a merge conflict** (Git says two people edited the same file): stop and message
> your partner. Don't try to resolve it alone until you're comfortable with Git.

### Step 2 — Install any new dependencies

If your partner added a new library since your last session, your local copy won't have it yet:

```bash
npm install
```

This is safe to run every time — it does nothing if nothing changed.

### Step 3 — Confirm the codebase is clean

```bash
npx tsc --noEmit
```

No output = no errors. If there are errors, do not start building — fix them first or ask your partner.

### Step 4 — Read the session notes

Open `sessions/` and read the most recent file. This tells you exactly where the last session
left off, what decisions were made, and what to build next.

### Step 5 — Read the build plan for today's work

Open `PLAN.MD` and find the prompt for the feature you're building today. Read it fully before
opening Claude Code. If the feature touches API routes, caching, auth, or BULL-E, also read
the relevant section of `ARCHITECTURE.md`.

---

## 3. Working with Claude Code

- Open Claude Code in your project folder
- Start with: *"Read CLAUDE.md and PLAN.MD. We're building [feature name]. Here's exactly what it needs to do: [paste the prompt from PLAN.MD]"*
- **One prompt at a time** — never ask Claude to build two features in one go
- If something breaks, paste the **full error message** and the **full file contents**, then say: *"Don't rewrite the whole file. Find the specific problem and fix only that."*

---

## 4. Saving your work — do this after every completed prompt

Once a prompt is done and the code compiles (`npx tsc --noEmit` shows no errors):

### Step 1 — Stage your changes

This tells Git which files you want to save:

```bash
git add .
```

> `.env.local` is automatically excluded by `.gitignore` — you will never accidentally commit your API keys.

### Step 2 — Commit your changes

A commit is a named save point. Write a short message describing what you built:

```bash
git commit -m "feat: Phase 1 Prompt 5 — market data service"
```

Commit message format: `feat: Phase {N} Prompt {N} — {short description}`

### Step 3 — Push to GitHub

This uploads your commit so your partner can see it:

```bash
git push origin main
```

You'll see a confirmation that the push succeeded. If you see an error, see the troubleshooting section below.

---

## 5. Ending every session — always do this, even if a phase is not finished

**You must write a session note every time you stop working, even if you only worked for 30 minutes
and didn't finish anything.** Your partner will read this before they start their next session.
It is the handoff note. Without it, they have no idea where you left off.

### Step 1 — Write the session note

Create a new file in `sessions/` named with today's date: `sessions/YYYY-MM-DD.md`

Use this template:

```markdown
# Session — YYYY-MM-DD

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
- [Any choices that aren't in PLAN.MD or ARCHITECTURE.md — e.g. "Decided to use X instead of Y because..."]

## Open questions
- [Anything unresolved that the other person needs to decide or look into]
```

### Step 2 — Commit and push the session note

```bash
git add sessions/
git commit -m "docs: session notes YYYY-MM-DD"
git push origin main
```

---

## 6. Code quality checklist — run before marking any prompt done

- [ ] `npx tsc --noEmit` — zero errors
- [ ] No `any` types
- [ ] No hardcoded URLs, API keys, or secrets — use env vars
- [ ] TypeScript only — no `.js` files
- [ ] All new components have a loading skeleton and an error state
- [ ] All interactive elements have an `aria-label`
- [ ] All API inputs validated with Zod
- [ ] Mobile layout works at 375px width

---

## 7. After completing a full phase

1. Ask Claude to write tests: *"Write tests for everything we just built — happy path, empty states, and error conditions."*
2. Manually run through the full user journey affected by the phase
3. Update the phase status table in `CLAUDE.md` from ⬜ to ✅
4. If it's Friday, run the weekly audit (see below)

---

## 8. Weekly audit — every Friday

Copy and paste this into Claude Code:

> "Review all the files we've built this week. Look for: any hardcoded values that should be env vars, any missing error handling, any component that's missing a loading state, any Supabase query missing RLS, any TypeScript any types. List everything you find and fix them one by one."

---

## 9. Git troubleshooting

**"Push rejected" or "failed to push"**
Someone pushed changes after your last pull. Run:
```bash
git pull origin main
git push origin main
```

**"Merge conflict"**
Two people edited the same file. Message your partner before touching anything.

**"I accidentally committed .env.local"**
Message your partner immediately — this is a security issue and needs to be handled together.

**"I don't know what state my code is in"**
Run `git status` to see what files have changed and whether they're staged.
Run `git log --oneline -10` to see the last 10 commits and what was built.

---

## 10. File map — where things live

| What you're looking for | Where it is |
|---|---|
| What to build next | `PLAN.MD` |
| How the app is wired together | `ARCHITECTURE.md` |
| Rules and stack | `CLAUDE.md` |
| Database tables and columns | `supabase/migrations/001_initial.sql` |
| Shared TypeScript types | `types/` |
| Utility functions | `lib/` |
| React hooks | `hooks/` |
| API services (market data, signals, etc.) | `services/` |
| Page components | `app/dashboard/` |
| Reusable UI components | `components/features/` and `components/ui/` |
| Session handoff notes | `sessions/` |
| Things to revisit later | `TODO/revisit-later.md` |
