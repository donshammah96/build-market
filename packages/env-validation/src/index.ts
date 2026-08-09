/**
 * @build/env-validation
 * ============================================================================
 * Canonical environment validation engine and satellite invariant validation
 * for the BuildMarket ecosystem (apps/client, apps/admin, apps/verification-ops).
 *
 * This package owns the *contract* the autopsy's Drift 2 asks for: a single
 * copy of the validation primitives (`EnvVar`, `EnvGroup`, `validateEnvGroups`,
 * `validateSatelliteInvariants`) plus the unified `AUTH_DEV_BYPASS` resolver,
 * so per-app env engines can no longer silently diverge from each other.
 *
 * Consuming apps are responsible for their own `EnvGroup[]` variable
 * declarations (variable names/shape differ per app) — this package owns the
 * validation *behavior*, not the per-app variable list.
 */

export type EnvVar = {
  name: string;
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
  errorMessage?: string;
};

export type EnvGroup = {
  name: string;
  description: string;
  variables: EnvVar[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/** Parses boolean environment variables safely. */
export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** Returns true only if `value` parses as a well-formed absolute http(s) URL. */
export function isAbsoluteHttpUrl(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getStringEnv(
  envObj: Record<string, string | undefined>,
  name: string,
  fallback = "",
): string {
  return envObj[name] || fallback;
}

export function getOptionalStringEnv(
  envObj: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const value = getStringEnv(envObj, name);
  return value.length > 0 ? value : undefined;
}

export function getBooleanEnv(
  envObj: Record<string, string | undefined>,
  name: string,
  fallback = false,
): boolean {
  const value = envObj[name];
  return value === undefined ? fallback : toBool(value);
}

/**
 * Validates a set of environment variable groups against current env bindings.
 *
 * This is the canonical "core" of the engine (Drift 2's `validateEnvCore`):
 * each app hands it its own `EnvGroup[]` declarations, and gets back a single
 * shared `valid`/`errors`/`warnings` shape instead of three independently
 * hand-rolled walkers.
 */
export function validateEnvGroups(
  envGroups: EnvGroup[],
  envObj: Record<string, string | undefined> = process.env,
  groupsToValidate: string[] | "all" = "all",
  deferServerOnlyVars: Set<string> = new Set(),
  isBuildPhase = false,
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const targetGroups =
    groupsToValidate === "all"
      ? envGroups
      : envGroups.filter((g) => groupsToValidate.includes(g.name));

  for (const group of targetGroups) {
    for (const variable of group.variables) {
      const value = envObj[variable.name];

      if (variable.required && !value) {
        if (isBuildPhase && deferServerOnlyVars.has(variable.name)) {
          result.warnings.push(
            `[${group.name}] Deferring required server env until runtime: ${variable.name}`,
          );
          continue;
        }
        result.valid = false;
        result.errors.push(
          `[${group.name}] Missing required: ${variable.name}`,
        );
        continue;
      }

      if (!value) {
        if (variable.default) {
          result.warnings.push(
            `[${group.name}] Using default for ${variable.name}: ${variable.default}`,
          );
        }
        continue;
      }

      if (variable.validate && !variable.validate(value)) {
        result.valid = false;
        result.errors.push(
          `[${group.name}] Invalid ${variable.name}: ${variable.errorMessage || "Validation failed"}`,
        );
      }
    }
  }

  return result;
}

/**
 * Alias retained for call sites/docs that refer to the "core" validator by
 * its conceptual name. Same function as `validateEnvGroups` — kept as a
 * named export rather than a rename so existing imports of
 * `validateEnvGroups` (already in review) don't need to churn.
 */
export const validateEnvCore = validateEnvGroups;

export interface SatelliteCheckInput {
  isSatellite: boolean;
  domain?: string | undefined;
  primarySignInUrl?: string | undefined;
  appName: string;
}

/**
 * Checks Clerk satellite configuration invariants.
 * Satellite mode requires both a valid hostname (domain) and an absolute HTTP(S) primary sign-in URL.
 *
 * Per Finding 6: this function trusts `input.primarySignInUrl` at face value.
 * It is the *caller's* (per-app `env.ts`) responsibility to resolve
 * `primarySignInUrl` strictly from `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL`
 * with no fallback to `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (a relative-path
 * variable with a different contractual shape) — otherwise this invariant
 * check silently sees a "set" value and never fires for the exact
 * misconfiguration it exists to catch.
 */
export function validateSatelliteInvariants(
  input: SatelliteCheckInput,
): string[] {
  const issues: string[] = [];
  if (!input.isSatellite) return issues;

  if (!input.domain) {
    issues.push(
      `NEXT_PUBLIC_CLERK_IS_SATELLITE=true in ${input.appName} but NEXT_PUBLIC_CLERK_DOMAIN is unset. ` +
        "Set it to this app's own bare hostname.",
    );
  }

  if (!input.primarySignInUrl) {
    issues.push(
      `NEXT_PUBLIC_CLERK_IS_SATELLITE=true in ${input.appName} but NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL ` +
        "is unset. Set it to the primary app's absolute sign-in URL (e.g. 'https://buildmarket.app/sign-in').",
    );
  } else if (!isAbsoluteHttpUrl(input.primarySignInUrl)) {
    issues.push(
      `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL="${input.primarySignInUrl}" in ${input.appName} is not an ` +
        "absolute http(s) URL. Satellite mode requires a full absolute URL.",
    );
  }

  return issues;
}

/**
 * Standardized auth dev bypass resolver.
 * Enforces strict fail-closed in staging and production profiles.
 *
 * Unifies the three previously-heterogeneous flag names (Drift 4):
 * `AUTH_DEV_BYPASS` (canonical) with backward-compatible fallback from the
 * legacy `DEV_ADMIN_BYPASS` (apps/admin) and `BYPASS_AUTH` (apps/client).
 */
export function resolveDevAuthBypass(
  envObj: Record<string, string | undefined> = process.env,
  isProdLikeProfile = false,
  appName = "app",
): { bypassEnabled: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Unified canonical flag name with fallback to legacy names
  const canonicalBypass = envObj["AUTH_DEV_BYPASS"];
  const legacyAdminBypass = envObj["DEV_ADMIN_BYPASS"];
  const legacyClientBypass = envObj["BYPASS_AUTH"];

  const rawBypass = canonicalBypass ?? legacyAdminBypass ?? legacyClientBypass;
  const bypassEnabled = toBool(rawBypass);

  if (bypassEnabled && isProdLikeProfile) {
    throw new Error(
      `[${appName}] Dev auth bypass (AUTH_DEV_BYPASS / DEV_ADMIN_BYPASS / BYPASS_AUTH) ` +
        "is strictly prohibited in staging/production environments. Unset it before deploying.",
    );
  }

  if ((legacyAdminBypass || legacyClientBypass) && !canonicalBypass) {
    warnings.push(
      `[${appName}] Legacy dev bypass env var used. Consider updating to canonical AUTH_DEV_BYPASS.`,
    );
  }

  return { bypassEnabled, warnings };
}
