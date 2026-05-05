FILE: lib/rateLimit.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Provides two exported async functions — `checkChatRateLimit` and `checkSignalsRateLimit`
— that API routes call before doing any real work. Each function checks whether the
requesting user has exceeded their per-hour request quota and returns a typed result
the route can act on. Limits are enforced using Upstash Redis (serverless Redis over
HTTP) so the counters persist across all serverless function instances.

HOW IT WORKS (step by step):
1. A single `Redis` client is created at module load time, connecting to Upstash via
   HTTP using credentials from environment variables. Because Upstash uses REST (not a
   TCP socket), this works inside stateless Next.js API route handlers that cannot hold
   persistent connections.
2. Two `Ratelimit` instances are created — one for chat (20 req/hr) and one for
   signals (60 req/hr). Each uses a **sliding window** algorithm and writes to separate
   Redis key namespaces via the `prefix` field so their counters never interfere.
3. When an API route calls `checkChatRateLimit(userId)`, it calls
   `chatLimiter.limit(userId)`. Upstash atomically increments a counter keyed to that
   userId in Redis and returns `{ success, reset }`.
   - `success`: true if the user is under the limit.
   - `reset`: epoch milliseconds when the oldest request in the window expires,
     freeing a slot.
4. If `success` is false, `minutesUntilReset` converts the `reset` timestamp into a
   human-readable minute count (minimum 1) and a user-facing error message is returned.
5. API routes check `result.allowed` and return a 429 response with the message if
   false, or proceed with their work if true.

KEY CONCEPTS USED:
- **Upstash Redis**: A serverless Redis service accessible via HTTP REST instead of a
  persistent TCP connection. This is required in Next.js API routes because each
  invocation is a fresh, short-lived process with no connection pooling.
- **Sliding window rate limiting**: Counts requests in the last N minutes relative to
  right now (not from a fixed clock boundary). This prevents users from doubling their
  effective quota by firing requests just before and just after an hourly reset.
- **Discriminated union (`RateLimitResult`)**: A TypeScript pattern where a shared
  field (`allowed`) tells TypeScript which variant of a type you have. Callers can
  safely access `result.message` only inside the `else` branch where TypeScript knows
  `allowed` is false.
- **Atomic increment**: Upstash's `.limit()` reads and writes the counter in a single
  Redis transaction, so concurrent requests from the same user can't race past the limit.

INPUTS AND OUTPUTS:
- Inputs: `userId` string (the authenticated user's Supabase UUID). Must come from
  the verified server-side session — never trust a client-supplied userId for limiting.
- Outputs: `Promise<RateLimitResult>` — either `{ allowed: true }` or
  `{ allowed: false, retryAfterMinutes: number, message: string }`.

WHAT TO CHECK IF SOMETHING BREAKS:
- All users hitting 429 immediately: check `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` env vars are set correctly. A misconfigured client may
  throw, causing the route to fail in a way that looks like rate limiting.
- Counters not resetting: confirm the `prefix` values are unique per limiter and the
  Upstash database hasn't been accidentally flushed or switched.
- `minutesUntilReset` returning 1 when limit should be close to expiring: the `reset`
  value from Upstash is in milliseconds — ensure no unit conversion bugs are introduced.

DEPENDENCIES:
- `@upstash/ratelimit` (Ratelimit): Upstash's rate limiting library. Wraps Redis with
  sliding/fixed window algorithms and handles atomic counter logic.
- `@upstash/redis` (Redis): HTTP-based Redis client for Upstash. Works in serverless
  environments where persistent TCP connections are not available.
