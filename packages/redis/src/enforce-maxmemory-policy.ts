import {
  createRedisClient,
  disconnectRedis,
  getServerInfo,
  getConnectionStatus,
} from "./index.js";

const DEFAULT_REQUIRED_MAXMEMORY_POLICY = "noeviction";

function getRequiredPolicy(): string {
  return (
    process.env.REDIS_REQUIRED_MAXMEMORY_POLICY ||
    DEFAULT_REQUIRED_MAXMEMORY_POLICY
  )
    .trim()
    .toLowerCase();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRuntimeConfigRestricted(errorMessage: string): boolean {
  return /unsupported config parameter|noperm|unknown command/i.test(
    errorMessage,
  );
}

async function main(): Promise<void> {
  const requiredPolicy = getRequiredPolicy();

  const client = await createRedisClient(undefined, { verbose: true });
  const before = await getServerInfo();
  const beforePolicy = (before.maxmemory_policy || "unknown").toLowerCase();

  console.log(
    JSON.stringify(
      {
        stage: "before",
        requiredPolicy,
        detectedPolicy: beforePolicy,
      },
      null,
      2,
    ),
  );

  if (beforePolicy !== requiredPolicy) {
    try {
      await client.config("SET", "maxmemory-policy", requiredPolicy);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      if (isRuntimeConfigRestricted(errorMessage)) {
        throw new Error(
          `Unable to set maxmemory-policy at runtime (${errorMessage}). ` +
            "This Redis deployment restricts CONFIG SET. " +
            "Configure maxmemory_policy=noeviction in your Redis provider control plane or server config, then retry.",
        );
      }

      throw error;
    }
  }

  const after = await getServerInfo();
  const afterPolicy = (after.maxmemory_policy || "unknown").toLowerCase();

  let rewriteApplied = false;
  let rewriteError: string | null = null;

  try {
    await client.config("REWRITE");
    rewriteApplied = true;
  } catch (error) {
    rewriteError = error instanceof Error ? error.message : String(error);
  }

  console.log(
    JSON.stringify(
      {
        stage: "after",
        requiredPolicy,
        detectedPolicy: afterPolicy,
        rewriteApplied,
        rewriteError,
      },
      null,
      2,
    ),
  );

  if (afterPolicy !== requiredPolicy) {
    throw new Error(
      `Redis maxmemory_policy is '${afterPolicy}', expected '${requiredPolicy}'. ` +
        "Update provider/server policy to noeviction to prevent BullMQ job eviction under memory pressure.",
    );
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    const message = getErrorMessage(error);

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
