// [ADDED FOR CAPACITY FIX]
// Centralized capacity manager backed by Redis with safe in-memory fallback.
// Tracks globally active games to prevent CPU overload.

import { safeRedis } from '../lib/redis'

const ACTIVE_SET = 'game:active_rooms'
const ACTIVE_COUNT = 'game:active_count'
const SLOT_TTL_SEC = 60 * 10 // 10 minutes safety TTL to auto-recover from leaks

// In-memory fallback
const memActive = new Set<string>()

function maxActiveGames(): number {
  const val = parseInt(process.env.MAX_ACTIVE_GAMES || '5', 10)
  return Number.isFinite(val) && val > 0 ? val : 5
}

function queueDelayMs(): number {
  // 1–3 seconds randomized
  return 1000 + Math.floor(Math.random() * 2000)
}

export async function currentActiveCount(): Promise<number> {
  return safeRedis(async (r) => {
    const count = await r.get(ACTIVE_COUNT)
    if (count !== null) return parseInt(count, 10) || 0
    // Fallback to set cardinality if counter not present
    const scard = await r.scard(ACTIVE_SET)
    // Try to backfill counter
    await r.set(ACTIVE_COUNT, String(scard), 'EX', SLOT_TTL_SEC)
    return scard
  }, memActive.size)
}

export async function isAtCapacity(): Promise<boolean> {
  const count = await currentActiveCount()
  return count >= maxActiveGames()
}

export async function acquireSlot(gameId: string): Promise<boolean> {
  return safeRedis(async (r) => {
    // SADD + SCARD is effectively atomic for capacity check here; if we exceed, roll back.
    const added = await r.sadd(ACTIVE_SET, gameId)
    // Set TTL on a side key to bound memory in serverless Redis
    await r.setex(`${ACTIVE_SET}:ttl:${gameId}`, SLOT_TTL_SEC, '1')
    let size: number
    if (added) {
      size = await r.incr(ACTIVE_COUNT)
      await r.expire(ACTIVE_COUNT, SLOT_TTL_SEC)
    } else {
      size = parseInt((await r.get(ACTIVE_COUNT)) || '0', 10) || (await r.scard(ACTIVE_SET))
    }
    if (size > maxActiveGames()) {
      // rollback
      if (added) {
        await r.srem(ACTIVE_SET, gameId)
        await r.decr(ACTIVE_COUNT)
      }
      return false
    }
    return added === 1 || size <= maxActiveGames()
  }, (() => { // fallback
    memActive.add(gameId)
    if (memActive.size > maxActiveGames()) {
      memActive.delete(gameId)
      return false
    }
    return true
  })())
}

export async function releaseSlot(gameId: string): Promise<void> {
  await safeRedis(async (r) => {
    const removed = await r.srem(ACTIVE_SET, gameId)
    if (removed) {
      const newVal = await r.decr(ACTIVE_COUNT)
      if ((newVal || 0) < 0) await r.set(ACTIVE_COUNT, '0')
    }
  }, undefined as any)
  memActive.delete(gameId)
}

export async function acquireOrWait(gameId: string): Promise<boolean> {
  const ok = await acquireSlot(gameId)
  if (ok) return true
  // queue briefly 1–3s then retry once
  await new Promise((res) => setTimeout(res, queueDelayMs()))
  return acquireSlot(gameId)
}
