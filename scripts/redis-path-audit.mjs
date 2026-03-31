function parseIntOrDefault(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getBullMQSummary(env) {
  const redisUrl = env.REDIS_URL;

  if (redisUrl) {
    const parsed = new URL(redisUrl);

    return {
      enabled: true,
      source: "REDIS_URL",
      host: parsed.hostname || "localhost",
      port: parseIntOrDefault(parsed.port, 6379),
      username: parsed.username || env.REDIS_USERNAME || undefined,
      db: parseIntOrDefault(parsed.pathname.replace(/^\//, ""), 0),
      tls: parsed.protocol === "rediss:" || env.REDIS_TLS === "true",
      hasPassword: Boolean(parsed.password || env.REDIS_PASSWORD),
    };
  }

  const hasDiscreteConfig = Boolean(env.REDIS_HOST || env.REDIS_PORT);

  return {
    enabled: hasDiscreteConfig,
    source: hasDiscreteConfig ? "DISCRETE_VARS" : "DEFAULTS_ONLY",
    host: env.REDIS_HOST || "localhost",
    port: parseIntOrDefault(env.REDIS_PORT, 6379),
    username: env.REDIS_USERNAME || undefined,
    db: parseIntOrDefault(env.REDIS_DB, 0),
    tls: env.REDIS_TLS === "true",
    hasPassword: Boolean(env.REDIS_PASSWORD),
  };
}

function buildAudit(env) {
  const bullmq = getBullMQSummary(env);
  const queueProvider = env.QUEUE_PROVIDER || "MEMORY";
  const sharedRedisEnabled =
    env.REDIS_ENABLED === "true" || env.CACHE_REDIS_ENABLED === "true";
  const upstashEnabled = Boolean(
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
  );

  return {
    environment: env.NODE_ENV || "development",
    bullmq,
    paths: [
      {
        id: "shared-redis-client",
        enabled: sharedRedisEnabled,
        reason: sharedRedisEnabled
          ? "REDIS_ENABLED or CACHE_REDIS_ENABLED is true"
          : "Shared Redis client returns noop unless REDIS_ENABLED or CACHE_REDIS_ENABLED is true",
      },
      {
        id: "resilience-l2-cache",
        enabled: env.CACHE_REDIS_ENABLED === "true",
        reason:
          env.CACHE_REDIS_ENABLED === "true"
            ? "CACHE_REDIS_ENABLED is true"
            : "Resilience Redis cache is off unless CACHE_REDIS_ENABLED is true",
      },
      {
        id: "client-gdpr-export-bullmq",
        enabled: bullmq.enabled,
        reason: bullmq.enabled
          ? `BullMQ connection is configured via ${bullmq.source}`
          : "No REDIS_URL or REDIS_HOST/REDIS_PORT present for BullMQ queues",
      },
      {
        id: "client-compliance-bullmq-workers",
        enabled: bullmq.enabled,
        reason: bullmq.enabled
          ? `BullMQ connection is configured via ${bullmq.source}; worker bootstrap still depends on separate process startup`
          : "No Redis config for BullMQ workers",
      },
      {
        id: "admin-gdpr-bullmq",
        enabled: bullmq.enabled,
        reason: bullmq.enabled
          ? `Admin queues now use the shared BullMQ config via ${bullmq.source}`
          : "No Redis config for admin BullMQ queues",
      },
      {
        id: "admin-verification-retry-queue",
        enabled: queueProvider === "REDIS" && bullmq.enabled,
        provider: queueProvider,
        reason:
          queueProvider === "REDIS"
            ? bullmq.enabled
              ? "QUEUE_PROVIDER=REDIS and BullMQ Redis config is available"
              : "QUEUE_PROVIDER=REDIS but no BullMQ Redis config is available"
            : `QUEUE_PROVIDER=${queueProvider}, so verification retries do not use Redis`,
      },
      {
        id: "client-password-reset-rate-limit",
        enabled: upstashEnabled,
        reason: upstashEnabled
          ? "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both set"
          : "Upstash Redis credentials are incomplete or missing",
      },
    ],
  };
}

const report = buildAudit(process.env);

console.log(JSON.stringify(report, null, 2));
