import { envConfig } from "@/app/lib/infrastructure/env";
import type { RegulatorAdapterCredentials } from "./http-regulator-adapter";

/**
 * Loads {BASE_URL, API_KEY, SIGNING_SECRET} for a given authority from
 * typed envConfig using the `REGULATOR_<AUTHORITY>_*` naming convention, e.g.
 * REGULATOR_NCA_BASE_URL, REGULATOR_NCA_API_KEY, REGULATOR_NCA_SIGNING_SECRET.
 *
 * Returns null (rather than throwing) when required env vars are absent so
 * an authority can be deployed without credentials and simply fall back to
 * manual review instead of crashing the worker at boot.
 */
export function loadRegulatorCredentials(
  envPrefix: string,
): RegulatorAdapterCredentials | null {
  const key = envPrefix.toUpperCase() as keyof typeof envConfig.regulators;
  const config = envConfig.regulators[key];

  if (!config) return null;

  const { baseUrl, apiKey, signingSecret } = config;

  if (!baseUrl || !apiKey) return null;

  return { baseUrl, apiKey, signingSecret };
}
