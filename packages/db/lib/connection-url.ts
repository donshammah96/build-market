export interface ResolveDatabaseUrlOptions {
  env?: Record<string, string | undefined>;
}

/**
 * Resolves the PostgreSQL database connection URL with platform-resilient fallbacks,
 * human-error tolerance (e.g. DATABSE_URL typo), and fail-fast validation against
 * invalid loopback (localhost/127.0.0.1) configurations in hosted serverless runtimes.
 */
export function resolveDatabaseUrl(
  options?: ResolveDatabaseUrlOptions,
): string {
  const env = options?.env ?? process.env;

  const url =
    env.DATABASE_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL ||
    env.SUPABASE_DATABASE_URL ||
    env.DATABSE_URL; // Resilient fallback for common spelling typo

  if (!url) {
    throw new Error(
      "[@build/db] DATABASE_URL is not set. " +
        "Set it to the Supabase Supavisor session-mode pooler URL.",
    );
  }

  if (env.DATABSE_URL && !env.DATABASE_URL) {
    console.warn(
      "[@build/db] WARNING: Detected 'DATABSE_URL' typo in environment variables. " +
        "Using it as fallback, but please correct the spelling to 'DATABASE_URL' in platform settings.",
    );
  }

  const isHosted = Boolean(
    env.VERCEL ||
    env.AWS_LAMBDA_FUNCTION_NAME ||
    (env.NODE_ENV === "production" && !env.ALLOW_LOCALHOST_DB),
  );

  if (isHosted) {
    try {
      const parseableUrl = url.replace(
        /^(postgres|postgresql):\/\//i,
        "http://",
      );
      const parsed = new URL(parseableUrl);
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1"
      ) {
        throw new Error(
          `[@build/db] DATABASE_URL points to loopback host '${parsed.hostname}' in a hosted environment (VERCEL=${Boolean(env.VERCEL)}, NODE_ENV=${env.NODE_ENV}). ` +
            "Serverless functions cannot reach 127.0.0.1. " +
            "Configure DATABASE_URL in Vercel project settings to your remote Supabase Supavisor pooler URL.",
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("[@build/db]")) {
        throw err;
      }
    }
  }

  return url;
}
