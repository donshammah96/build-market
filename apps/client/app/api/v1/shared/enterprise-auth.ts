import { scryptSync } from "node:crypto";
import { prisma, type EnterpriseApiClient } from "@build/db";
import { checkSlidingWindowRateLimit } from "@build/redis";
import { env } from "@/app/lib/infrastructure/env";

export function hashApiKey(apiKey: string, explicitSecret?: string): string {
  const secret =
    explicitSecret ||
    env.services.enterpriseApiKeyHashSecret ||
    "buildmarket_enterprise_api_key_default_hash_secret";
  return scryptSync(apiKey.trim(), secret, 32).toString("hex");
}

export interface EnterpriseAuthResult {
  client: EnterpriseApiClient;
  authorized: boolean;
  errorStatus?: number;
  errorMessage?: string;
}

/**
 * Authenticates an enterprise API key and validates permissions and rate limits.
 * Supports zero-downtime secret rotation via fallback verification and lazy re-hashing.
 */
export async function authenticateEnterpriseClient(
  authHeader: string | null,
  requiredScope: string,
): Promise<EnterpriseAuthResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      client: null as unknown as EnterpriseApiClient,
      authorized: false,
      errorStatus: 401,
      errorMessage:
        "Missing or malformed Authorization header. Expected: Bearer <apiKey>",
    };
  }

  const rawKey = authHeader.substring(7).trim();
  const hashedKey = hashApiKey(rawKey);

  let client = await prisma.enterpriseApiClient.findUnique({
    where: { hashedApiKey: hashedKey },
  });

  // Fallback to previous secret during secret rotation / migration
  if (!client && env.services.enterpriseApiKeyPreviousHashSecret) {
    const fallbackHashedKey = hashApiKey(
      rawKey,
      env.services.enterpriseApiKeyPreviousHashSecret,
    );
    const fallbackClient = await prisma.enterpriseApiClient.findUnique({
      where: { hashedApiKey: fallbackHashedKey },
    });

    if (fallbackClient) {
      if (fallbackClient.isActive && fallbackClient.revokedAt === null) {
        // Transparently migrate record to current hash
        try {
          await prisma.enterpriseApiClient.update({
            where: { id: fallbackClient.id },
            data: { hashedApiKey: hashedKey },
          });
        } catch {
          // Non-blocking: if concurrent request already updated the record, proceed
        }
      }
      client = fallbackClient;
    }
  }

  if (!client || !client.isActive || client.revokedAt !== null) {
    return {
      client: null as unknown as EnterpriseApiClient,
      authorized: false,
      errorStatus: 403,
      errorMessage: "Invalid, deactivated, or revoked API key",
    };
  }

  // Check required scope
  if (!client.scopes.includes(requiredScope) && !client.scopes.includes("*")) {
    return {
      client,
      authorized: false,
      errorStatus: 403,
      errorMessage: `API key lacks required scope '${requiredScope}'`,
    };
  }

  // Rate Limiter check (per-client rate limiting in Redis)
  try {
    const rateLimitRes = await checkSlidingWindowRateLimit({
      key: `enterprise_api:${client.id}`,
      limit: client.rateLimitRpm,
      windowMs: 60 * 1000,
    });

    if (!rateLimitRes.success) {
      return {
        client,
        authorized: false,
        errorStatus: 429,
        errorMessage: `Rate limit exceeded. Your plan allows ${client.rateLimitRpm} requests per minute.`,
      };
    }
  } catch {
    // Gracefully continue if Redis rate limiter is unconfigured in test/dev
  }

  return {
    client,
    authorized: true,
  };
}
