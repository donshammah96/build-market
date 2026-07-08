import { getRedisClient } from "@build/redis";

const ALLOWLIST = [
  "correlationId",
  "operationName",
  "actorRole",
  "outcome",
  "httpStatus",
  "durationMs",
  "domainError",
  "resourceType",
  "resourceId",
];

export async function pushDemoLog(
  logPayload: Record<string, any>,
): Promise<void> {
  const redacted: Record<string, any> = {};

  // Redact log payload to include only allowlisted fields (ADR-005 compliant)
  for (const key of ALLOWLIST) {
    if (logPayload[key] !== undefined && logPayload[key] !== null) {
      redacted[key] = logPayload[key];
    }
  }

  // Add human-readable timestamp
  redacted.timestamp = new Date().toISOString();

  try {
    const redis = getRedisClient();
    // Cap list at 100 items (lpush + ltrim)
    await redis.lpush("demo:logs", JSON.stringify(redacted));
    await redis.ltrim("demo:logs", 0, 99);
  } catch (err) {
    // Graceful memory fallback when Redis is unconfigured or offline (local dev)
    const g = global as any;
    g._demoLogs = g._demoLogs || [];
    g._demoLogs.unshift(redacted);
    if (g._demoLogs.length > 100) {
      g._demoLogs = g._demoLogs.slice(0, 100);
    }
  }
}
