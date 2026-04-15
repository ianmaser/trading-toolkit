import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 20 AI (chat) requests per user per hour
const chatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'rl:chat',
  analytics: true,
})

// 60 signal requests per user per hour
const signalsLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: 'rl:signals',
  analytics: true,
})

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number; message: string }

function minutesUntilReset(resetMs: number): number {
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000 / 60))
}

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
