import {
  createRedisClient,
  disconnectRedis,
  getConnectionStatus,
  getServerInfo,
  isRedisHealthy,
} from "./index.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isRedisEnabled(): boolean {
  return (
    process.env.REDIS_ENABLED === "true" ||
    process.env.CACHE_REDIS_ENABLED === "true"
  );
}

async function main(): Promise<void> {
  const host = getRequiredEnv("REDIS_HOST");
  const port = Number(getRequiredEnv("REDIS_PORT"));
  const family =
    process.env.REDIS_FAMILY === "4" || process.env.REDIS_FAMILY === "6"
      ? Number(process.env.REDIS_FAMILY)
      : undefined;
  const username = process.env.REDIS_USERNAME?.trim() || undefined;
  const db = Number(process.env.REDIS_DB || "0");
  const tls = process.env.REDIS_TLS === "true";

  if (Number.isNaN(port)) {
    throw new Error("REDIS_PORT must be a valid number");
  }

  if (Number.isNaN(db)) {
    throw new Error("REDIS_DB must be a valid number");
  }

  if (!isRedisEnabled()) {
    throw new Error(
      "Redis is disabled. Set REDIS_ENABLED=true or CACHE_REDIS_ENABLED=true before running the healthcheck.",
    );
  }

  console.log(
    JSON.stringify(
      {
        stage: "config",
        host,
        port,
        family,
        username,
        db,
        tls,
      },
      null,
      2,
    ),
  );

  await createRedisClient(undefined, { verbose: true });

  const healthy = await isRedisHealthy();
  const status = getConnectionStatus();
  const serverInfo = await getServerInfo();

  console.log(
    JSON.stringify(
      {
        stage: "result",
        healthy,
        status,
        server: {
          redis_version: serverInfo.redis_version,
          redis_mode: serverInfo.redis_mode,
          role: serverInfo.role,
        },
      },
      null,
      2,
    ),
  );

  if (!healthy) {
    process.exitCode = 1;
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      JSON.stringify(
        {
          stage: "error",
          message,
          status: getConnectionStatus(),
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
  } finally {
    await disconnectRedis();
  }
})();
