import { RedisCache } from "@build/redis";
import type { ResolvedEntitlements } from "./types.js";

const ENTITLEMENTS_CACHE_NAMESPACE = "entitlements:pro";
const ENTITLEMENTS_CACHE_TTL_SECONDS = 300; // 5 minutes

export class EntitlementsCache {
  private readonly cache: RedisCache<ResolvedEntitlements>;

  constructor(ttlSeconds: number = ENTITLEMENTS_CACHE_TTL_SECONDS) {
    this.cache = new RedisCache<ResolvedEntitlements>(
      ENTITLEMENTS_CACHE_NAMESPACE,
      {
        ttl: ttlSeconds,
      },
    );
  }

  async get(professionalId: string): Promise<ResolvedEntitlements | null> {
    try {
      return await this.cache.get(professionalId);
    } catch {
      return null;
    }
  }

  async set(
    professionalId: string,
    value: ResolvedEntitlements,
  ): Promise<void> {
    try {
      await this.cache.set(professionalId, value);
    } catch {
      // Non-blocking on Redis transient failure
    }
  }

  async invalidate(professionalId: string): Promise<void> {
    try {
      await this.cache.delete(professionalId);
    } catch {
      // Non-blocking
    }
  }

  async clear(): Promise<void> {
    try {
      await this.cache.clear();
    } catch {
      // Non-blocking
    }
  }
}

export const entitlementsCache = new EntitlementsCache();
