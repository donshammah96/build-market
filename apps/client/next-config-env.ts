// Keep Next config decoupled from the runtime env graph so tooling imports
// do not execute server-only invariants.
export type NextConfigEnv = {
  nodeEnv: string;
  appUrl: string;
  apiUrl: string;
  clerkFrontendApi?: string;
  analyticsPosthogHost: string;
};

function getRequiredLikeEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function readNextConfigEnv(): NextConfigEnv {
  return {
    nodeEnv: getRequiredLikeEnv("NODE_ENV", "development"),
    appUrl: getRequiredLikeEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3500"),
    apiUrl: getRequiredLikeEnv(
      "NEXT_PUBLIC_API_URL",
      "http://localhost:3500/api",
    ),
    clerkFrontendApi: getOptionalEnv("NEXT_PUBLIC_CLERK_FRONTEND_API"),
    analyticsPosthogHost: getRequiredLikeEnv(
      "NEXT_PUBLIC_POSTHOG_HOST",
      "https://us.i.posthog.com",
    ),
  };
}
