// Upstash is a serverless Redis provider. Unlike a traditional Redis server that requires
// a persistent TCP connection, Upstash exposes Redis over a plain HTTP REST API.
// This makes it compatible with Next.js API routes, which are stateless and short-lived —
// they can't hold open database connections between requests.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Create a Redis client that communicates with Upstash over HTTP.
// Credentials come from env vars — never hardcode these.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Sliding window rate limiting: unlike a fixed window (which resets at a hard clock
// boundary like "top of the hour"), a sliding window counts requests in the last N
// minutes relative to right now. This prevents a user from firing 20 requests at
// 11:59 and another 20 at 12:01 by gaming the reset boundary.
//
// Each limiter stores its counters in Redis under a unique `prefix` key so chat and
// signals counts are tracked independently.
// `analytics: true` sends usage data to the Upstash dashboard for monitoring.

// 20 AI (chat) requests per user per hour
const chatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'rl:chat',   // Redis keys will look like "rl:chat:<userId>"
  analytics: true,
})

// 60 signal requests per user per hour
const signalsLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: 'rl:signals', // Redis keys will look like "rl:signals:<userId>"
  analytics: true,
})

// A discriminated union type — TypeScript's way of expressing "either this shape or
// that shape". The `allowed` boolean acts as the discriminant: callers check
// `result.allowed` first, and TypeScript then knows which variant they're working with.
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number; message: string }

// Converts the `reset` timestamp returned by Upstash (milliseconds since Unix epoch
// when the oldest request in the window expires) into a human-readable minutes count.
// Math.max(1, ...) ensures we never show "0 minutes" to the user.
function minutesUntilReset(resetMs: number): number {
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000 / 60))
}

// Checks whether the given user is within the chat rate limit.
// Call this at the top of /api/chat before doing any Claude API work.
// Returns { allowed: true } or an object with a user-facing message and retry time.
//
// `.limit(userId)` atomically increments the user's counter in Redis and returns:
//   - `success`: whether they are under the limit
//   - `reset`: epoch ms when the oldest tracked request will expire (freeing a slot)
export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  const { success, reset } = await chatLimiter.limit(userId)
  if (success) return { allowed: true }

  const retryAfterMinutes = minutesUntilReset(reset)
  return {
    allowed: false,
    retryAfterMinutes,
    message: `You've reached your limit of 20 AI requests per hour. BULL-E needs a breather — try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'}.`,
  }
}

// Checks whether the given user is within the signals rate limit.
// Call this at the top of /api/signals/[symbol] before fetching market data.
export async function checkSignalsRateLimit(userId: string): Promise<RateLimitResult> {
  const { success, reset } = await signalsLimiter.limit(userId)
  if (success) return { allowed: true }

  const retryAfterMinutes = minutesUntilReset(reset)
  return {
    allowed: false,
    retryAfterMinutes,
    message: `You've reached your limit of 60 signal requests per hour. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'}.`,
  }
}
