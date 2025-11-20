import type { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'

type Bucket = {
  count: number
  firstHit: number
}

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  ok: boolean
  retryAfterMs?: number
}

let redisClient: Redis | null | undefined

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redisClient = Redis.fromEnv()
    } else {
      redisClient = null
    }
  } catch {
    redisClient = null
  }

  return redisClient
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || ''
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function rateLimitInMemory(identifier: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(identifier)

  if (!bucket || now - bucket.firstHit > windowMs) {
    buckets.set(identifier, { count: 1, firstHit: now })
    return { ok: true }
  }

  bucket.count += 1
  if (bucket.count <= limit) {
    return { ok: true }
  }

  const retryAfterMs = windowMs - (now - bucket.firstHit)
  return { ok: false, retryAfterMs: Math.max(0, retryAfterMs) }
}

export async function rateLimit(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedisClient()
  if (!redis) {
    return rateLimitInMemory(identifier, limit, windowMs)
  }

  const key = `rl:${identifier}`

  try {
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.pexpire(key, windowMs)
      return { ok: true }
    }

    if (current <= limit) {
      return { ok: true }
    }

    const ttlMs = await redis.pttl(key)
    const retryAfterMs = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : windowMs
    return { ok: false, retryAfterMs }
  } catch {
    // On Redis errors, fall back to in-memory buckets
    return rateLimitInMemory(identifier, limit, windowMs)
  }
}

// Helper specifically for login endpoints
export async function checkLoginRateLimit(
  req: NextRequest,
  username?: string,
  limit = 5,
  windowMs = 10 * 60 * 1000
): Promise<RateLimitResult> {
  const ip = getClientIp(req)
  const userPart = username ? `:${String(username).toLowerCase()}` : ''
  const key = `admin-login:${ip}${userPart}`
  return rateLimit(key, limit, windowMs)
}
