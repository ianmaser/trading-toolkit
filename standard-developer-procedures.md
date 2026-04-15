# Standard Developer Procedures

## Starting a session

1. Read `CLAUDE.md` — confirms the stack, rules, and current phase
2. Read the relevant prompt(s) from `PLAN.MD` for what you're building today
3. Read `ARCHITECTURE.md` if the feature touches API routes, caching, auth, or BULL-E
4. Check `sessions/` for any notes from the previous session
5. Run `npx tsc --noEmit` to confirm the codebase compiles clean before touching anything

---

## Building a feature

- One prompt from `PLAN.MD` at a time — never combine two
- Before writing a new file, check if a relevant type exists in `types/` or a util in `lib/`
- New shared types go in `types/` — never define interfaces inline in components or services
- New API routes: check `ARCHITECTURE.md` route map first to confirm the route doesn't already exist
- Any route calling AI or signals: import and call the appropriate rate limiter from `lib/rateLimit.ts`
- Any Supabase query: verify the table and columns against `supabase/migrations/001_initial.sql`

---

## Code quality checklist (run before marking a prompt done)

- [ ] `npx tsc --noEmit` — zero errors
- [ ] No `any` types introduced
- [ ] No hardcoded URLs, API keys, or secrets
- [ ] No JavaScript — TypeScript only
- [ ] All new components have a loading skeleton and error state
- [ ] All interactive elements have an `aria-label`
- [ ] All API inputs validated with Zod
- [ ] Mobile layout works at 375px

---

## After completing a phase

1. Ask Claude to write tests: happy path, empty states, error conditions
2. Run the full user journey affected by the phase manually
3. Run the weekly audit if it's Friday (see below)
4. Commit with a descriptive message referencing the phase and prompt number
5. Push to `origin/main`
6. Update the phase status in `CLAUDE.md` feature map
7. Write a session note in `sessions/` (see format below)

---

## Weekly audit (every Friday)

Ask Claude:

> "Review all the files we've built this week. Look for: any hardcoded values that should be env vars, any missing error handling, any component that's missing a loading state, any Supabase query missing RLS, any TypeScript any types. List everything you find and fix them one by one."

---

## When something breaks

- Paste the **full error** and the **full file** — not a snippet
- Say: "Don't rewrite the whole file. Find the specific problem and fix only that."
- Never use `--no-verify` to skip hooks
- Never use `git reset --hard` without confirming with the user first

---

## Git conventions

- Commit after each completed prompt — not at the end of the day
- Commit message format: `feat: Phase {N} Prompt {N} — {short description}`
- Always push to `origin/main` after committing
- Never commit `.env.local` or any file containing secrets (already covered by `.gitignore`)

---

## Session notes format (`sessions/`)

Create a file named `sessions/YYYY-MM-DD.md` at the end of each working session:

```markdown
# Session — YYYY-MM-DD

## What was built
- Prompt X: [description]
- Prompt Y: [description]

## Decisions made
- [Any architectural or design decisions that aren't in PLAN.MD or ARCHITECTURE.md]

## Left off at
- [Exactly where to pick up next session]

## Open questions
- [Anything unresolved that needs a decision]
```
