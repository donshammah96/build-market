import { randomUUID } from "node:crypto";
import { getRedisClient } from "./client.js";

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = now - windowMs

redis.call("ZREMRANGEBYSCORE", key, 0, windowStart)

local current = redis.call("ZCARD", key)
local allowed = 0
if current < limit then
  redis.call("ZADD", key, now, member)
  current = current + 1
  allowed = 1
end

redis.call("PEXPIRE", key, windowMs)

local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
local reset = now + windowMs
if oldest[2] then
  reset = tonumber(oldest[2]) + windowMs
end

local remaining = limit - current
if remaining < 0 then
  remaining = 0
end

return { allowed, limit, remaining, reset }
`;

export interface SlidingWindowRateLimitParams {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
  member?: string;
}

export interface SlidingWindowRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

function toInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizePositive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }

  return Math.trunc(value);
}

/**
 * Redis-backed sliding-window limiter.
 *
 * Uses a sorted set keyed by timestamp so boundary bursts are smoothed versus
 * fixed-window counters, and relies on key TTL for cleanup.
 */
export async function checkSlidingWindowRateLimit(
  params: SlidingWindowRateLimitParams,
): Promise<SlidingWindowRateLimitResult> {
  const key = params.key.trim();
  if (!key) {
    throw new Error("key must be a non-empty string");
  }

  const limit = normalizePositive(params.limit, "limit");
  const windowMs = normalizePositive(params.windowMs, "windowMs");
  const nowMs = params.nowMs ?? Date.now();
  const member = params.member ?? `${nowMs}-${randomUUID()}`;

  const redis = getRedisClient();
  const raw = (await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    key,
    String(nowMs),
    String(windowMs),
    String(limit),
    member,
  )) as unknown;

  if (!Array.isArray(raw) || raw.length < 4) {
    throw new Error("Unexpected Redis sliding-window response");
  }

  return {
    success: toInteger(raw[0], 0) === 1,
    limit: toInteger(raw[1], limit),
    remaining: Math.max(0, toInteger(raw[2], 0)),
    reset: toInteger(raw[3], nowMs + windowMs),
  };
}
