/**
 * Edge Environment Inlining Module
 * ============================================================================
 * Defines statically inlinable member expressions for Webpack/Turbopack's
 * DefinePlugin in the Edge runtime (Next.js middleware).
 *
 * CRITICAL ARCHITECTURAL INVARIANT:
 * Getters use direct literal `process.env.VARIABLE_NAME` member expressions.
 * Webpack / Turbopack statically inlines `process.env.FOO` at build time for Edge
 * bundles, while getters ensure Node/Vitest test suites evaluate active process.env.
 *
 * Rotating any secret defined here requires a fresh deployment/compilation pass.
 * See: docs/STAGING-E2E-STAFF-AUTOPSY-V2.md (§4 H-1 & §11 Q5)
 */

export const edgeEnv = {
  // Clerk Authentication
  get clerkPublishableKey(): string {
    const rawPublishableKey =
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
    const configuredFrontendApi =
      process.env.NEXT_PUBLIC_CLERK_FRONTEND_API ?? "";
    const isStagingEnv =
      process.env.DD_ENV === "staging" ||
      (typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
        process.env.NEXT_PUBLIC_APP_URL.includes("staging.buildmarket.app"));

    const frontendApi =
      configuredFrontendApi ||
      (isStagingEnv ? "https://clerk.staging.buildmarket.app" : "");

    if (frontendApi) {
      try {
        const fapiHost = new URL(frontendApi).host;
        if (fapiHost) {
          const encodedHost = (
            typeof Buffer !== "undefined"
              ? Buffer.from(`${fapiHost}$`).toString("base64")
              : btoa(`${fapiHost}$`)
          ).replace(/=+$/, "");
          if (!rawPublishableKey.includes(encodedHost)) {
            const isDev = rawPublishableKey.startsWith("pk_test_");
            return `${isDev ? "pk_test_" : "pk_live_"}${encodedHost}`;
          }
        }
      } catch {
        // safe fallback
      }
    }
    return rawPublishableKey;
  },
  get clerkSecretKey(): string {
    return process.env.CLERK_SECRET_KEY ?? "";
  },
  get clerkFrontendApi(): string {
    return process.env.NEXT_PUBLIC_CLERK_FRONTEND_API ?? "";
  },
  get clerkIsSatellite(): boolean {
    return process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === "true";
  },
  get clerkDomain(): string {
    return process.env.NEXT_PUBLIC_CLERK_DOMAIN ?? "";
  },
  get clerkPrimarySignInUrl(): string {
    return process.env.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL ?? "";
  },
  get clerkSatelliteOrigins(): string[] {
    return (process.env.NEXT_PUBLIC_CLERK_SATELLITE_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get hasClerkSecretKey(): boolean {
    return Boolean(process.env.CLERK_SECRET_KEY);
  },

  // Application & API Origins
  get appUrl(): string {
    return (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      process.env.CLIENT_APP_URL ??
      ""
    );
  },
  get apiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "";
  },

  // Service-to-Service Internal API Security
  get internalServiceSecret(): string {
    return (
      process.env.INTERNAL_SERVICE_SECRET ||
      process.env.INTERNAL_API_SECRET ||
      ""
    );
  },
  get internalApiSecret(): string {
    return (
      process.env.INTERNAL_API_SECRET ||
      process.env.INTERNAL_SERVICE_SECRET ||
      ""
    );
  },

  // Staging Perimeter Protection
  get stagingAuthSecret(): string {
    return process.env.STAGING_AUTH_SECRET ?? "";
  },
  get stagingAuthUser(): string {
    return process.env.STAGING_AUTH_USER ?? "buildmarket";
  },
  get stagingAuthPassword(): string {
    return process.env.STAGING_AUTH_PASSWORD ?? "";
  },
  get isStagingAuthEnabled(): boolean {
    return (
      process.env.DD_ENV === "staging" ||
      process.env.STAGING_AUTH_ENABLED === "true"
    );
  },

  // Environment & Observability
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },
  get ddEnv(): string {
    return process.env.DD_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? "";
  },
  get isDev(): boolean {
    return process.env.NODE_ENV === "development";
  },
  get isCI(): boolean {
    return process.env.CI === "true";
  },
  get isVercelPreview(): boolean {
    return process.env.VERCEL_ENV === "preview";
  },

  // Security & Content Policy
  get cspReportOnly(): boolean {
    return process.env.CSP_REPORT_ONLY === "true";
  },
  get allowCspUnsafeEval(): boolean {
    return process.env.CSP_ALLOW_UNSAFE_EVAL === "true";
  },
  get authBypassEnabled(): boolean {
    return process.env.AUTH_BYPASS_ENABLED === "true";
  },
  // Build & Deployment Telemetry
  get appVersion(): string | null {
    return process.env.NEXT_PUBLIC_APP_VERSION ?? null;
  },
  get buildSha(): string | null {
    return process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  },
  get deploymentId(): string | null {
    return process.env.VERCEL_DEPLOYMENT_ID ?? null;
  },
  get posthogHost(): string {
    return process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";
  },

  // Queue & Cache Infrastructure
  get redisUrl(): string {
    return process.env.REDIS_URL ?? "";
  },
};

export type EdgeEnv = typeof edgeEnv;
