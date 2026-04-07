function buildAuditInput(rawEnv) {
  const redisUrl = rawEnv.REDIS_URL;
  const normalizedNodeEnv =
    rawEnv.NODE_ENV === "production" ||
    rawEnv.NODE_ENV === "test" ||
    rawEnv.NODE_ENV === "development"
      ? rawEnv.NODE_ENV
      : "custom";

  let hasRedisUrlUsername = false;
  let hasRedisUrlPassword = false;
  let redisUrlUsesTls = false;

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      hasRedisUrlUsername = Boolean(parsed.username);
      hasRedisUrlPassword = Boolean(parsed.password);
      redisUrlUsesTls = parsed.protocol === "rediss:";
    } catch {
      // Ignore malformed REDIS_URL and rely on discrete flags.
    }
  }

  return {
    nodeEnv: normalizedNodeEnv,
    queueProviderIsRedis: rawEnv.QUEUE_PROVIDER === "REDIS",
    redisEnabled: rawEnv.REDIS_ENABLED === "true",
    cacheRedisEnabled: rawEnv.CACHE_REDIS_ENABLED === "true",
    redisUrlConfigured: Boolean(redisUrl),
    redisHostConfigured: Boolean(rawEnv.REDIS_HOST),
    redisPortConfigured: Boolean(rawEnv.REDIS_PORT),
    redisUsernameConfigured: Boolean(rawEnv.REDIS_USERNAME),
    redisPasswordConfigured: Boolean(rawEnv.REDIS_PASSWORD),
    redisTlsEnabled: rawEnv.REDIS_TLS === "true",
    hasRedisUrlUsername,
    hasRedisUrlPassword,
    redisUrlUsesTls,
    upstashUrlConfigured: Boolean(rawEnv.UPSTASH_REDIS_REST_URL),
    upstashTokenConfigured: Boolean(rawEnv.UPSTASH_REDIS_REST_TOKEN),
  };
}

function getBullMQSummary(auditInput) {
  if (auditInput.redisUrlConfigured) {
    const credentialsConfigured =
      auditInput.hasRedisUrlUsername ||
      auditInput.hasRedisUrlPassword ||
      auditInput.redisUsernameConfigured ||
      auditInput.redisPasswordConfigured;

    return {
      enabled: true,
      source: "REDIS_URL",
      tlsEnabled: auditInput.redisUrlUsesTls || auditInput.redisTlsEnabled,
      credentialsConfigured,
    };
  }

  const hasDiscreteConfig =
    auditInput.redisHostConfigured || auditInput.redisPortConfigured;

  return {
    enabled: hasDiscreteConfig,
    source: hasDiscreteConfig ? "DISCRETE_VARS" : "DEFAULTS_ONLY",
    tlsEnabled: auditInput.redisTlsEnabled,
    credentialsConfigured:
      auditInput.redisUsernameConfigured || auditInput.redisPasswordConfigured,
  };
}

function buildAudit(auditInput) {
  const bullmq = getBullMQSummary(auditInput);
  const queueProviderIsRedis = auditInput.queueProviderIsRedis;
  const sharedRedisEnabled =
    auditInput.redisEnabled || auditInput.cacheRedisEnabled;
  const upstashEnabled = Boolean(
    auditInput.upstashUrlConfigured && auditInput.upstashTokenConfigured,
  );

  return {
    environment: auditInput.nodeEnv,
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
        enabled: auditInput.cacheRedisEnabled,
        reason: auditInput.cacheRedisEnabled
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
        enabled: queueProviderIsRedis && bullmq.enabled,
        provider: queueProviderIsRedis ? "REDIS" : "NON_REDIS",
        reason: queueProviderIsRedis
          ? bullmq.enabled
            ? "QUEUE_PROVIDER=REDIS and BullMQ Redis config is available"
            : "QUEUE_PROVIDER=REDIS but no BullMQ Redis config is available"
          : "QUEUE_PROVIDER is not REDIS, so verification retries do not use Redis",
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

const report = buildAudit(buildAuditInput(process.env));

console.log(JSON.stringify(report, null, 2));
