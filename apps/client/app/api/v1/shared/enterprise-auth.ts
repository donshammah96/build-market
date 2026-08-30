import { createHash } from "node:crypto";
import { prisma, type EnterpriseApiClient } from "@build/db";
import { checkSlidingWindowRateLimit } from "@build/redis";

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey.trim()).digest("hex");
}

export interface EnterpriseAuthResult {
  client: EnterpriseApiClient;
  authorized: boolean;
  errorStatus?: number;
  errorMessage?: string;
}

/**
 * Authenticates an enterprise API key and validates permissions and rate limits.
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

  const client = await prisma.enterpriseApiClient.findUnique({
    where: { hashedApiKey: hashedKey },
  });

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
