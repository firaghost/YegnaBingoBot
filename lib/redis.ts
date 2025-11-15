// [ADDED FOR CAPACITY FIX]
// Minimal Redis client factory with safe fallback to no-op when Redis is unavailable.
import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || ''
  if (!url) {
    return null
  }
  try {
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableAutoPipelining: true
    })
    // Connect in background
    redis.connect().catch(() => {})
    return redis
  } catch {
    return null
  }
}

export async function safeRedis<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  const r = getRedis()
  if (!r) return fallback
  try {
    return await fn(r)
  } catch {
    return fallback
  }
}
